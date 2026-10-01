import "server-only";
import { requireUser } from "@/features/auth/session";
import type { Asset, AccessCount, RecentAccess } from "./types";
const selection =
  "id,store_id,name,status,created_at,stores!inner(name,status),acquisition_endpoints(id,acquisition_asset_id,type,short_code,destination_url,status)";
export const PAGE_SIZE = 20;
export async function listAssets(page = 1) {
  const { supabase } = await requireUser();
  const { data, error, count } = await supabase
    .from("acquisition_assets")
    .select(selection, { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (error) throw new Error("販促物を取得できませんでした。");
  return { assets: (data ?? []) as unknown as Asset[], count: count ?? 0 };
}
export async function getAsset(id: string) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("acquisition_assets")
    .select(selection)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("販促物を取得できませんでした。");
  return data as unknown as Asset | null;
}
export async function assetCounts(ids: string[]): Promise<AccessCount[]> {
  if (!ids.length) return [];
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("asset_access_counts", {
    p_asset_ids: ids,
  });
  if (error) throw new Error("アクセス集計を取得できませんでした。");
  return data ?? [];
}
export async function recentAccesses(id: string): Promise<RecentAccess[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("access_logs")
    .select("id,access_method,accessed_at,redirected_at")
    .eq("acquisition_asset_id", id)
    .order("accessed_at", { ascending: false })
    .order("id")
    .limit(20);
  if (error) throw new Error("アクセス履歴を取得できませんでした。");
  return data ?? [];
}
