import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/features/auth/session";
import { StoreForm } from "@/components/store-form";
export default async function EditStore({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("店舗情報を取得できませんでした。");
  if (!data) notFound();
  return (
    <>
      <Link className="text-link" href="/stores">
        ← 店舗一覧
      </Link>
      <h1>店舗情報を編集</h1>
      <section className="card edit">
        <StoreForm store={data} />
      </section>
    </>
  );
}
