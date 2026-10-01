import Link from "next/link";
import {
  listAssets,
  assetCounts,
  PAGE_SIZE,
} from "@/features/acquisition/repository";
import { listStores } from "@/features/stores/repository";
import { isGoogleReviewUrl } from "@/lib/validation/google-review-url";
import { siteUrl } from "@/lib/env";
import { endpointUrl } from "@/features/acquisition/urls";
import { CopyUrl } from "@/components/copy-url";
import { CreateAssetForm } from "@/components/asset-forms";
export default async function Acquisition({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const query = await searchParams;
  const page = Math.min(
    100000,
    Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1),
  );
  const [{ assets, count }, stores] = await Promise.all([
    listAssets(page),
    listStores(),
  ]);
  const counts = await assetCounts(assets.map((a) => a.id));
  const origin = siteUrl();
  return (
    <>
      <p className="eyebrow">ACQUISITION</p>
      <h1>集客導線</h1>
      <p className="subtitle">
        NFC・QRからGoogle口コミ投稿ページへの導線を管理します。
      </p>
      <div className="store-grid">
        <section>
          <h2>
            販促物 <span className="count">{count}</span>
          </h2>
          {!assets.length && (
            <section className="card empty">
              <h3>
                {count
                  ? "このページに販促物はありません"
                  : "最初の販促物を作成しましょう"}
              </h3>
              <p>設置場所ごとに作成すると、導線の利用状況を比較できます。</p>
            </section>
          )}
          {assets.map((asset) => {
            const c = counts.find((c) => c.asset_id === asset.id) ?? {
              nfc: 0,
              qr: 0,
              total: 0,
            };
            return (
              <article className="card" key={asset.id}>
                <div className="row">
                  <h3>{asset.name}</h3>
                  <span className="badge">
                    {asset.status === "active" ? "有効" : "停止"}
                  </span>
                </div>
                <p>
                  {asset.stores.name}
                  {asset.stores.status === "inactive" ? "（店舗停止中）" : ""}
                </p>
                {(["nfc", "qr"] as const).map((type) => {
                  const e = asset.acquisition_endpoints.find(
                    (e) => e.type === type,
                  );
                  return (
                    e && (
                      <section className="endpoint-row" key={e.id}>
                        <div className="row">
                          <strong>
                            {type.toUpperCase()}{" "}
                            {e.status === "inactive" ? "（停止）" : ""}
                          </strong>
                          <span>アクセス {c[type].toLocaleString()}回</span>
                        </div>
                        <CopyUrl
                          url={endpointUrl(origin, type, e.short_code)}
                          label={`${asset.id}-${type}-url`}
                        />
                      </section>
                    )
                  );
                })}
                <div className="store-footer">
                  <strong>合計 {c.total.toLocaleString()}回</strong>
                  <Link className="text-link" href={`/acquisition/${asset.id}`}>
                    詳細・QR画像 →
                  </Link>
                </div>
              </article>
            );
          })}
          <div className="pagination">
            {page > 1 && (
              <Link
                className="secondary"
                href={`/acquisition?page=${page - 1}`}
              >
                前へ
              </Link>
            )}
            <span>
              {page} / {Math.max(1, Math.ceil(count / PAGE_SIZE))}
            </span>
            {page * PAGE_SIZE < count && (
              <Link
                className="secondary"
                href={`/acquisition?page=${page + 1}`}
              >
                次へ
              </Link>
            )}
          </div>
          <p className="hint">
            アクセス数は全期間の累計です。口コミの投稿数ではありません。
          </p>
        </section>
        <section className="card">
          <h2>新しい販促物</h2>
          <CreateAssetForm
            stores={stores.map((s) => ({
              id: s.id,
              name: s.name,
              ready:
                s.status === "active" &&
                isGoogleReviewUrl(s.google_review_url ?? ""),
            }))}
          />
        </section>
      </div>
    </>
  );
}
