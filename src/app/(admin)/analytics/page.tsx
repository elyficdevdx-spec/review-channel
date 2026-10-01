import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { accessSummary } from "@/features/analytics/repository";
import { periodRange, type Period } from "@/features/analytics/period";
import { listStores } from "@/features/stores/repository";
import { AccessStats, AccessTrend } from "@/components/access-stats";
export default async function Analytics({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; store?: string }>;
}) {
  const q = await searchParams;
  const period: Period =
    q.period === "today" || q.period === "7d" ? q.period : "30d";
  if (q.store && !z.uuid().safeParse(q.store).success) notFound();
  const range = periodRange(period);
  const [summary, stores] = await Promise.all([
    accessSummary(range.from, range.to, q.store || undefined),
    listStores(),
  ]);
  if (q.store && !stores.some((s) => s.id === q.store)) notFound();
  return (
    <>
      <p className="eyebrow">ANALYTICS</p>
      <h1>アクセス分析</h1>
      <p className="subtitle">
        口コミ投稿ページへの導線が利用された回数を表示します。口コミ投稿数とは異なります。
      </p>
      <form className="card filter-form" method="get">
        <label>
          期間
          <select name="period" defaultValue={period}>
            <option value="today">今日</option>
            <option value="7d">過去7日</option>
            <option value="30d">過去30日</option>
          </select>
        </label>
        <label>
          店舗
          <select name="store" defaultValue={q.store ?? ""}>
            <option value="">すべての所属店舗</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <button className="primary">表示する</button>
      </form>
      <p className="hint">
        本日を含む日本時間の集計。再アクセスも1回として計上します。
      </p>
      <AccessStats counts={summary.totals} />
      <AccessTrend daily={summary.daily} from={range.from} to={range.to} />
      <section className="card">
        <h2>店舗別アクセス</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>店舗</th>
                <th>NFC</th>
                <th>QR</th>
                <th>合計</th>
              </tr>
            </thead>
            <tbody>
              {summary.stores.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.nfc.toLocaleString()}</td>
                  <td>{s.qr.toLocaleString()}</td>
                  <td>{s.total.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!summary.stores.length && <p>店舗が登録されていません。</p>}
      </section>
      <section className="card">
        <h2>販促物別アクセス</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>販促物 / 店舗</th>
                <th>NFC</th>
                <th>QR</th>
                <th>合計</th>
              </tr>
            </thead>
            <tbody>
              {summary.assets.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link className="text-link" href={`/acquisition/${a.id}`}>
                      {a.name}
                    </Link>
                    <br />
                    <span className="hint">
                      {stores.find((s) => s.id === a.store_id)?.name}
                    </span>
                  </td>
                  <td>{a.nfc.toLocaleString()}</td>
                  <td>{a.qr.toLocaleString()}</td>
                  <td>{a.total.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!summary.assets.length && <p>販促物が登録されていません。</p>}
      </section>
    </>
  );
}
