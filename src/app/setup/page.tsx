import Link from "next/link";
import { isConfigured } from "@/lib/env";
import { redirect } from "next/navigation";
export default function Setup() {
  if (isConfigured()) redirect("/login");
  return (
    <main className="auth-page">
      <section className="card auth-card">
        <p className="brand">
          Review<span>Channel</span>
        </p>
        <h1>接続設定が必要です</h1>
        <p>管理者がSupabaseの接続情報を設定すると、店舗管理を開始できます。</p>
        <p className="hint">設定手順はプロジェクトのREADMEをご確認ください。</p>
        <Link className="text-link" href="/login">
          設定後にログインへ →
        </Link>
      </section>
    </main>
  );
}
export const dynamic = "force-dynamic";
