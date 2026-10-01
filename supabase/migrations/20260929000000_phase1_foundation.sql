-- Phase 1: application identity, internal stores, and membership.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function private.valid_review_url(value text)
returns boolean language sql immutable set search_path = '' as $$
  select value ~ '^https://g[.]page/[A-Za-z0-9_-]+/review$'
    or value ~ '^https://search[.]google[.]com/local/writereview[?]placeid=[A-Za-z0-9_%-]+$';
$$;

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  address text not null check (char_length(btrim(address)) between 1 and 500),
  google_account_id text,
  google_location_id text,
  google_review_url text not null check (char_length(google_review_url) <= 2048 and private.valid_review_url(google_review_url)),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.store_users (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner')),
  created_at timestamptz not null default now(),
  unique(store_id, user_id)
);
create index store_users_user_store_idx on public.store_users(user_id, store_id);

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger profiles_updated before update on public.profiles for each row execute function private.touch_updated_at();
create trigger stores_updated before update on public.stores for each row execute function private.touch_updated_at();

create function private.create_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin insert into public.profiles(id) values (new.id) on conflict do nothing; return new; end;
$$;
create trigger auth_user_created after insert on auth.users for each row execute function private.create_profile();
insert into public.profiles(id) select id from auth.users on conflict do nothing;

-- Membership lookup bypasses its own table's RLS to avoid recursive policies.
create function private.is_store_owner(target_store_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.store_users where store_id = target_store_id and user_id = (select auth.uid()) and role = 'owner');
$$;

alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.store_users enable row level security;
revoke all on public.profiles, public.stores, public.store_users from anon, authenticated;
grant select on public.profiles, public.stores, public.store_users to authenticated;
grant update(display_name) on public.profiles to authenticated;
grant update(name, address, google_review_url, status) on public.stores to authenticated;
create policy profiles_read_self on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_self on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy stores_read_member on public.stores for select to authenticated using (private.is_store_owner(id));
create policy stores_update_owner on public.stores for update to authenticated using (private.is_store_owner(id)) with check (private.is_store_owner(id));
create policy memberships_read_member on public.store_users for select to authenticated using (private.is_store_owner(store_id));

-- Atomic creation: clients cannot insert arbitrary memberships, choose an owner,
-- or create an orphan store. No service_role credential is needed by the app.
create function public.create_store(p_name text, p_address text, p_google_review_url text, p_status text default 'active')
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_id uuid; current_user_id uuid := auth.uid();
begin
 if current_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
 insert into public.stores(name,address,google_review_url,status)
 values(btrim(p_name),btrim(p_address),btrim(p_google_review_url),p_status) returning id into new_id;
 insert into public.store_users(store_id,user_id,role) values(new_id,current_user_id,'owner');
 return new_id;
end;
$$;
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_store_owner(uuid), private.valid_review_url(text) to authenticated;
revoke all on function public.create_store(text,text,text,text) from public, anon;
grant execute on function public.create_store(text,text,text,text) to authenticated;
commit;
