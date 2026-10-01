import Link from "next/link";
import { listStores } from "@/features/stores/repository";
import { StoreForm } from "@/components/store-form";
export default async function Stores() {
  const stores = await listStores();
  return (
    <>
      <p className="eyebrow">STORES</p>
      <h1>店舗設定</h1>
      <p className="subtitle">
        所属する店舗の基本情報と口コミURLを管理します。
      </p>
      <div className="store-grid">
        <section>
          <h2>
            登録店舗 <span className="count">{stores.length}</span>
          </h2>
          {stores.length === 0 ? (
            <div className="card empty">
              <h3>まだ店舗がありません</h3>
              <p>新しい店舗を登録してください。</p>
            </div>
          ) : (
            stores.map((s) => (
              <article className="card store" key={s.id}>
                <div className="row">
                  <h3>{s.name}</h3>
                  <span className="badge">
                    {s.status === "active" ? "有効" : "停止"}
                  </span>
                </div>
                <p>{s.address}</p>
                <a
                  className="text-link"
                  href={s.google_review_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Google口コミページ ↗
                </a>
                <div className="store-footer">
                  <span>オーナー</span>
                  <Link href={"/stores/" + s.id}>店舗情報を編集 →</Link>
                </div>
              </article>
            ))
          )}
        </section>
        <section className="card">
          <h2>新しい店舗を登録</h2>
          <StoreForm />
        </section>
      </div>
    </>
  );
}
