import { redirect } from "next/navigation";
import { isConfigured } from "@/lib/env";
import { AuthForm } from "@/components/auth-form";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ confirmation?: string }>;
}) {
  if (!isConfigured()) redirect("/setup");
  const params = await searchParams;
  return (
    <main className="auth-page">
      <section className="card auth-card">
        <p className="brand">
          Review<span>Channel</span>
        </p>
        <h1>店舗の口コミ導線を、ひとつに。</h1>
        <p className="subtitle">アカウントにログインして店舗を管理します。</p>
        {params.confirmation === "failed" && (
          <p className="error" role="alert">
            確認リンクが無効か、有効期限が切れています。
          </p>
        )}
        <AuthForm />
      </section>
    </main>
  );
}
export const dynamic = "force-dynamic";
