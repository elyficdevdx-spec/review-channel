import "server-only";
import { requireUser } from "@/features/auth/session";
import type { Store } from "./validation";
export async function listStores(): Promise<Store[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error("店舗情報を取得できませんでした。");
  return data ?? [];
}
