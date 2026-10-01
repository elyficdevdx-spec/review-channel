import "server-only";
import { requireUser } from "@/features/auth/session";
export type Counts = { nfc: number; qr: number; total: number };
export type Summary = {
  totals: Counts;
  stores: (Counts & { id: string; name: string })[];
  assets: (Counts & { id: string; name: string; store_id: string })[];
  daily: (Counts & { day: string })[];
};
export async function accessSummary(
  from: string,
  to: string,
  storeId?: string,
  assetId?: string,
): Promise<Summary> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("access_summary", {
    p_from: from,
    p_to: to,
    p_store_id: storeId ?? null,
    p_asset_id: assetId ?? null,
  });
  if (error || !data) throw new Error("アクセス集計を取得できませんでした。");
  return data as Summary;
}
