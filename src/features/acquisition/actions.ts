"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/features/auth/session";
import {
  createAssetSchema,
  updateAssetSchema,
  updateEndpointSchema,
} from "./validation";
export type AssetFormState = { error?: string; success?: string };
export async function createAsset(
  _: AssetFormState,
  form: FormData,
): Promise<AssetFormState> {
  const { supabase } = await requireUser();
  const parsed = createAssetSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { data, error } = await supabase.rpc("create_acquisition_asset", {
    p_store_id: parsed.data.store_id,
    p_name: parsed.data.name,
  });
  if (error || !data)
    return {
      error:
        "作成できませんでした。店舗の権限・状態・Google口コミURLをご確認ください。",
    };
  revalidatePath("/acquisition");
  redirect(`/acquisition/${data}`);
}
export async function updateAsset(
  _: AssetFormState,
  form: FormData,
): Promise<AssetFormState> {
  const { supabase } = await requireUser();
  const parsed = updateAssetSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "販促物名と状態を確認してください。" };
  const { id, ...values } = parsed.data;
  const { error } = await supabase
    .from("acquisition_assets")
    .update(values)
    .eq("id", id)
    .select("id")
    .single();
  if (error)
    return { error: "更新できませんでした。権限と入力内容をご確認ください。" };
  revalidatePath("/acquisition");
  revalidatePath(`/acquisition/${id}`);
  return {
    success:
      values.status === "inactive"
        ? "停止しました。NFC・QRの両方から遷移しなくなります。"
        : "保存しました。",
  };
}
export async function updateEndpoint(
  _: AssetFormState,
  form: FormData,
): Promise<AssetFormState> {
  const { supabase } = await requireUser();
  const parsed = updateEndpointSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "入口の指定が不正です。" };
  const { id, asset_id, status } = parsed.data;
  const { error } = await supabase
    .from("acquisition_endpoints")
    .update({ status })
    .eq("id", id)
    .eq("acquisition_asset_id", asset_id)
    .select("id")
    .single();
  if (error) return { error: "入口の状態を変更できませんでした。" };
  revalidatePath("/acquisition");
  revalidatePath(`/acquisition/${asset_id}`);
  return { success: "入口の状態を変更しました。" };
}
