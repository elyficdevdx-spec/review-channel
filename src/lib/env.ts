export function isConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase configuration missing");
  return { url, key };
}
export function siteUrl() {
  if (!process.env.NEXT_PUBLIC_SITE_URL)
    throw new Error("NEXT_PUBLIC_SITE_URL missing");
  return new URL(process.env.NEXT_PUBLIC_SITE_URL).origin;
}
