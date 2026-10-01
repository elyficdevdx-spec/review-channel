import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import {
  getAsset,
  assetCounts,
  recentAccesses,
} from "@/features/acquisition/repository";
import { endpointUrl } from "@/features/acquisition/urls";
import { siteUrl } from "@/lib/env";
import { CopyUrl } from "@/components/copy-url";
import { EditAssetForm, EndpointStatusForm } from "@/components/asset-forms";
import { AccessStats } from "@/components/access-stats";
import { displayTime } from "@/features/analytics/period";
export default async function AssetDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const asset = await getAsset(id);
  if (!asset) notFound();
  const [counts, recent] = await Promise.all([
    assetCounts([id]),
    recentAccesses(id),
  ]);
  const origin = siteUrl();
  return (
    <>
      <Link className="text-link" href="/acquisition">
        ← 集客導線
      </Link>
      <h1>{asset.name}</h1>
      <p className="subtitle">
        {asset.stores.name} · {asset.status === "active" ? "有効" : "停止"} ·
        全期間の累計
      </p>
      {(asset.status !== "active" || asset.stores.status !== "active") && (
        <p className="notice">
          販促物または店舗が停止中のため、NFC・QRからの遷移は停止しています。
        </p>
      )}
      <AccessStats counts={counts[0] ?? { nfc: 0, qr: 0, total: 0 }} />
      <div className="endpoint-grid">
        {(["nfc", "qr"] as const).map((type) => {
          const e = asset.acquisition_endpoints.find((e) => e.type === type);
          if (!e) return null;
          return (
            <section className="card" key={type}>
              <div className="row">
                <h2>{type.toUpperCase()}専用URL</h2>
                <span className="badge">
                  {e.status === "active" ? "有効" : "停止"}
                </span>
              </div>
              <p>
                {type === "nfc"
                  ? "NFCタグにこのURLを書き込んでください。"
                  : "印刷したQRコードを、店頭のカードやスタンドに設置してください。"}
              </p>
              {type === "qr" && (
                <div className="qr-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/acquisition/${id}/qr`}
                    width={320}
                    height={320}
                    alt={`${asset.name}のQR専用URL`}
                  />
                  <a
                    className="secondary"
                    href={`/acquisition/${id}/qr?download=1`}
                    download
                  >
                    QR画像をダウンロード（SVG）
                  </a>
                </div>
              )}
              <CopyUrl
                url={endpointUrl(origin, type, e.short_code)}
                label={`${type}-url`}
              />
              <p className="hint destination">遷移先：{e.destination_url}</p>
              <EndpointStatusForm endpoint={e} />
            </section>
          );
        })}
      </div>
      <div className="store-grid">
        <section className="card">
          <h2>最近のアクセス</h2>
          <p className="hint">
            最新20件・日本時間。Googleへの到達や口コミ投稿を確認した記録ではありません。
          </p>
          {recent.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>アクセス日時</th>
                    <th>方式</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((log) => (
                    <tr key={log.id}>
                      <td>{displayTime(log.accessed_at)}</td>
                      <td>{log.access_method.toUpperCase()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>まだアクセスはありません。</p>
          )}
        </section>
        <section className="card">
          <h2>販促物の設定</h2>
          <EditAssetForm asset={asset} />
          <p className="hint destination">
            遷移先は店舗設定と連動します。
            <Link href={`/stores/${asset.store_id}`} className="text-link">
              店舗設定を開く →
            </Link>
          </p>
        </section>
      </div>
    </>
  );
}
