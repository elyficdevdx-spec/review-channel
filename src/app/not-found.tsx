import Link from "next/link";
export default function NotFound() {
  return (
    <main className="auth-page">
      <section className="card">
        <h1>ページが見つかりません</h1>
        <p>ページが存在しないか、アクセス権限がありません。</p>
        <Link href="/stores">店舗一覧へ</Link>
      </section>
    </main>
  );
}
