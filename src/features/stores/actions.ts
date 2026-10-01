"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth/session";
import { storeSchema } from "./validation";
export type FormState = { error?: string; success?: string };
export async function saveStore(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const { supabase } = await requireUser();
  const parsed = storeSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const id = form.get("id");
  if (id && !z.uuid().safeParse(id).success)
    return { error: "店舗IDが不正です。" };
  const s = parsed.data;
  const result = id
    ? await supabase.from("stores").update(s).eq("id", id).select("id").single()
    : await supabase.rpc("create_store", {
        p_name: s.name,
        p_address: s.address,
        p_google_review_url: s.google_review_url,
        p_status: s.status,
      });
  if (result.error)
    return { error: "保存できませんでした。権限と入力内容をご確認ください。" };
  revalidatePath("/stores");
  revalidatePath("/acquisition", "layout");
  revalidatePath("/");
  return { success: id ? "店舗情報を更新しました。" : "店舗を登録しました。" };
}
