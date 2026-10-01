"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="card">
      <h1>データを読み込めませんでした</h1>
      <p>
        時間をおいて再度お試しください。解消しない場合は管理者にお問い合わせください。
      </p>
      <button className="primary" onClick={reset}>
        再読み込み
      </button>
    </section>
  );
}
