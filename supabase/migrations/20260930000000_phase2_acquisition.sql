begin;
-- Preserve Phase 1 forms and add the current /r/<id>/review format.
create or replace function private.valid_review_url(value text)
returns boolean language sql immutable set search_path = '' as $$
 select value ~ '^https://g[.]page/(r/)?[A-Za-z0-9_-]+/review$'
   or value ~ '^https://search[.]google[.]com/local/writereview[?]placeid=[A-Za-z0-9_%-]+$';
$$;

create table public.acquisition_assets (
 id uuid primary key default gen_random_uuid(),
 store_id uuid not null references public.stores(id) on delete cascade,
 name text not null check (char_length(btrim(name)) between 1 and 120),
 status text not null default 'active' check (status in ('active','inactive')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(id, store_id)
);
create table public.acquisition_endpoints (
 id uuid primary key default gen_random_uuid(),
 acquisition_asset_id uuid not null references public.acquisition_assets(id) on delete cascade,
 type text not null check (type in ('nfc','qr')),
 -- UUID v4 without hyphens: 122 random bits, generated in the DB.
 short_code text not null default replace(gen_random_uuid()::text, '-', '')
   check (short_code ~ '^[a-f0-9]{32}$') unique,
 destination_url text not null check (char_length(destination_url) <= 2048 and private.valid_review_url(destination_url)),
 status text not null default 'active' check (status in ('active','inactive')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(acquisition_asset_id, type),
 unique(id, acquisition_asset_id, type)
);
create table public.access_logs (
 id uuid primary key default gen_random_uuid(),
 acquisition_endpoint_id uuid not null,
 acquisition_asset_id uuid not null,
 store_id uuid not null,
 access_method text not null check (access_method in ('nfc','qr')),
 accessed_at timestamptz not null default clock_timestamp(),
 user_agent text check (char_length(user_agent) <= 512),
 ip_hash text check (ip_hash is null or ip_hash ~ '^[a-f0-9]{64}$'),
 redirected_at timestamptz not null,
 foreign key(acquisition_endpoint_id, acquisition_asset_id, access_method)
   references public.acquisition_endpoints(id, acquisition_asset_id, type) on delete cascade,
 foreign key(acquisition_asset_id, store_id)
   references public.acquisition_assets(id, store_id) on delete cascade,
 check (redirected_at >= accessed_at)
);
create index assets_store_created_idx on public.acquisition_assets(store_id,created_at desc);
create index logs_store_time_idx on public.access_logs(store_id,accessed_at desc);
create index logs_asset_time_idx on public.access_logs(acquisition_asset_id,accessed_at desc);
create index logs_endpoint_time_idx on public.access_logs(acquisition_endpoint_id,accessed_at desc);
create trigger assets_updated before update on public.acquisition_assets for each row execute function private.touch_updated_at();
create trigger endpoints_updated before update on public.acquisition_endpoints for each row execute function private.touch_updated_at();

alter table public.acquisition_assets enable row level security;
alter table public.acquisition_endpoints enable row level security;
alter table public.access_logs enable row level security;
revoke all on public.acquisition_assets, public.acquisition_endpoints, public.access_logs from anon, authenticated;
grant select on public.acquisition_assets, public.acquisition_endpoints, public.access_logs to authenticated;
grant update(name,status) on public.acquisition_assets to authenticated;
grant update(status) on public.acquisition_endpoints to authenticated;
create policy assets_read on public.acquisition_assets for select to authenticated using(private.is_store_owner(store_id));
create policy assets_update on public.acquisition_assets for update to authenticated using(private.is_store_owner(store_id)) with check(private.is_store_owner(store_id));
create policy endpoints_read on public.acquisition_endpoints for select to authenticated using(exists(select 1 from public.acquisition_assets a where a.id=acquisition_asset_id and private.is_store_owner(a.store_id)));
create policy endpoints_update on public.acquisition_endpoints for update to authenticated using(exists(select 1 from public.acquisition_assets a where a.id=acquisition_asset_id and private.is_store_owner(a.store_id))) with check(exists(select 1 from public.acquisition_assets a where a.id=acquisition_asset_id and private.is_store_owner(a.store_id)));
create policy logs_read on public.access_logs for select to authenticated using(private.is_store_owner(store_id));
-- Creation is only via the checked transactional RPC, never independent inserts.
create function public.create_acquisition_asset(p_store_id uuid,p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare s public.stores; new_id uuid; endpoint_type text; attempt integer;
begin
 if auth.uid() is null or not private.is_store_owner(p_store_id) then
   raise exception 'Store not available' using errcode='42501';
 end if;
 -- Serialize with store URL edits so a concurrent creation never copies a stale URL.
 select * into s from public.stores where id=p_store_id for share;
 if s.status <> 'active' or s.google_review_url is null or not private.valid_review_url(s.google_review_url) then
   raise exception 'Store review URL unavailable' using errcode='22023';
 end if;
 insert into public.acquisition_assets(store_id,name) values(p_store_id,btrim(p_name)) returning id into new_id;
 foreach endpoint_type in array array['nfc','qr'] loop
   attempt := 0;
   loop
     begin
       insert into public.acquisition_endpoints(acquisition_asset_id,type,destination_url)
         values(new_id,endpoint_type,s.google_review_url);
       exit;
     exception when unique_violation then
       attempt := attempt+1;
       if attempt >= 5 then raise; end if;
     end;
   end loop;
 end loop;
 return new_id;
end;
$$;
revoke all on function public.create_acquisition_asset(uuid,text) from public, anon, authenticated;
grant execute on function public.create_acquisition_asset(uuid,text) to authenticated;

create function private.sync_review_destinations() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 update public.acquisition_endpoints e set destination_url=new.google_review_url
 from public.acquisition_assets a where e.acquisition_asset_id=a.id and a.store_id=new.id;
 return new;
end;
$$;
revoke all on function private.sync_review_destinations() from public, anon, authenticated;
create trigger store_review_url_changed after update of google_review_url on public.stores
 for each row when (old.google_review_url is distinct from new.google_review_url)
 execute function private.sync_review_destinations();

-- Server-only entry point: no table or membership data is returned to visitors.
-- One DB roundtrip resolves the route and records the redirect being prepared.
create function public.resolve_and_log_redirect(p_type text,p_short_code text,p_user_agent text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare target record; ts timestamptz;
begin
 if p_type is null or p_type not in ('nfc','qr') or p_short_code is null or p_short_code !~ '^[a-f0-9]{32}$' then return null; end if;
 select e.id as endpoint_id,a.id as asset_id,s.id as store_id,e.destination_url into target
 from public.acquisition_endpoints e
 join public.acquisition_assets a on a.id=e.acquisition_asset_id
 join public.stores s on s.id=a.store_id
 where e.short_code=p_short_code and e.type=p_type
 and e.status='active' and a.status='active' and s.status='active'
 and e.destination_url=s.google_review_url and private.valid_review_url(e.destination_url);
 if not found then return null; end if;
 ts := clock_timestamp();
 insert into public.access_logs(acquisition_endpoint_id,acquisition_asset_id,store_id,access_method,accessed_at,user_agent,ip_hash,redirected_at)
 values(target.endpoint_id,target.asset_id,target.store_id,p_type,ts,left(p_user_agent,512),null,ts);
 return target.destination_url;
end;
$$;
revoke all on function public.resolve_and_log_redirect(text,text,text) from public, anon, authenticated;
grant execute on function public.resolve_and_log_redirect(text,text,text) to service_role;

-- Invoker functions preserve caller RLS and aggregate before PostgREST row limits.
create function public.asset_access_counts(p_asset_ids uuid[])
returns table(asset_id uuid,nfc bigint,qr bigint,total bigint)
language sql stable security invoker set search_path = '' as $$
 select a.id,count(l.id) filter(where l.access_method='nfc'),count(l.id) filter(where l.access_method='qr'),count(l.id)
 from public.acquisition_assets a left join public.access_logs l on l.acquisition_asset_id=a.id
 where a.id=any(p_asset_ids) group by a.id;
$$;
revoke all on function public.asset_access_counts(uuid[]) from public, anon, authenticated;
grant execute on function public.asset_access_counts(uuid[]) to authenticated;

create function public.access_summary(p_from timestamptz,p_to timestamptz,p_store_id uuid default null,p_asset_id uuid default null)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb;
begin
 if p_from is null or p_to is null or p_to < p_from or p_to-p_from > interval '31 days' then
   raise exception 'Invalid period' using errcode='22023';
 end if;
 with filtered as materialized (
   select * from public.access_logs where accessed_at>=p_from and accessed_at<p_to
     and (p_store_id is null or store_id=p_store_id) and (p_asset_id is null or acquisition_asset_id=p_asset_id)
 ), totals as (
   select count(*) filter(where access_method='nfc') as nfc,count(*) filter(where access_method='qr') as qr,count(*) as total from filtered
 ), by_store as (
   select s.id,s.name,count(l.id) filter(where l.access_method='nfc') as nfc,count(l.id) filter(where l.access_method='qr') as qr,count(l.id) as total
   from public.stores s left join filtered l on l.store_id=s.id
   where (p_store_id is null or s.id=p_store_id)
   and (p_asset_id is null or exists(select 1 from public.acquisition_assets a where a.id=p_asset_id and a.store_id=s.id))
   group by s.id,s.name
 ), by_asset as (
   select a.id,a.name,a.store_id,count(l.id) filter(where l.access_method='nfc') as nfc,count(l.id) filter(where l.access_method='qr') as qr,count(l.id) as total
   from public.acquisition_assets a left join filtered l on l.acquisition_asset_id=a.id
   where (p_store_id is null or a.store_id=p_store_id) and (p_asset_id is null or a.id=p_asset_id)
   group by a.id,a.name,a.store_id
 ), daily as (
   select to_char(accessed_at at time zone 'Asia/Tokyo','YYYY-MM-DD') as day,
     count(*) filter(where access_method='nfc') as nfc,count(*) filter(where access_method='qr') as qr,count(*) as total
   from filtered group by 1
 )
 select jsonb_build_object('totals',(select to_jsonb(t) from totals t),
   'stores',coalesce((select jsonb_agg(to_jsonb(s) order by s.name,s.id) from by_store s),'[]'::jsonb),
   'assets',coalesce((select jsonb_agg(to_jsonb(a) order by a.name,a.id) from by_asset a),'[]'::jsonb),
   'daily',coalesce((select jsonb_agg(to_jsonb(d) order by d.day) from daily d),'[]'::jsonb)) into result;
 return result;
end;
$$;
revoke all on function public.access_summary(timestamptz,timestamptz,uuid,uuid) from public, anon, authenticated;
grant execute on function public.access_summary(timestamptz,timestamptz,uuid,uuid) to authenticated;
commit;
