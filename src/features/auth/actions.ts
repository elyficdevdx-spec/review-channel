"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/env";
export type AuthState = { error?: string; success?: string };
export async function authenticate(
  _: AuthState,
  form: FormData,
): Promise<AuthState> {
  const parsed = z
    .object({
      email: z.email(),
      password: z.string().min(8).max(128),
      mode: z.enum(["login", "signup"]),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return {
      error: "メールアドレスと8文字以上のパスワードを入力してください。",
    };
  const { email, password, mode } = parsed.data;
  const supabase = await createClient();
  if (mode === "signup") {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: siteUrl() + "/auth/confirm" },
    });
    if (error)
      return {
        error:
          "登録できませんでした。入力内容を確認するか、時間をおいてお試しください。",
      };
    return {
      success:
        "確認メールをご確認ください。登録済みの場合はログインしてください。",
    };
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error)
    return {
      error: "メールアドレス・パスワード・メール確認状況をご確認ください。",
    };
  redirect("/stores");
}
export async function signOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error("ログアウトできませんでした。");
  redirect("/login");
}
