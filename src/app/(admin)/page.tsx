import Link from "next/link";
import { listStores } from "@/features/stores/repository";
import { accessSummary } from "@/features/analytics/repository";
import { periodRange, jstDay } from "@/features/analytics/period";
import { AccessTrend } from "@/components/access-stats";
export default async function Dashboard() {
  const now = new Date();
  const range = periodRange("30d", now);
  const week = jstDay(periodRange("7d", now).from);
  const today = jstDay(now);
  const [stores, summary] = await Promise.all([
    listStores(),
    accessSummary(range.from, range.to),
  ]);
  const todayCount = summary.daily.find((d) => d.day === today)?.total ?? 0;
  const weekCount = summary.daily
    .filter((d) => d.day >= week)
    .reduce((sum, d) => sum + d.total, 0);
  const cards = [
    ["今日のアクセス", todayCount],
    ["過去7日", weekCount],
    ["過去30日", summary.totals.total],
    ["NFC（30日）", summary.totals.nfc],
    ["QR（30日）", summary.totals.qr],
  ] as const;
  return (
    <>
      <p className="eyebrow">OVERVIEW</p>
      <h1>ダッシュボード</h1>
      <p className="subtitle">
        口コミ投稿ページへの導線の利用状況。各期間は本日を含む日本時間の集計です。
      </p>
      <div className="stats dashboard-stats">
        {cards.map(([label, value]) => (
          <section className="card" key={label}>
            <p>{label}</p>
            <strong className="number">
              {value.toLocaleString()}
              <small>回</small>
            </strong>
          </section>
        ))}
      </div>
      <AccessTrend daily={summary.daily} from={range.from} to={range.to} />
      <section className="card">
        <div className="row">
          <h2>登録店舗 {stores.length}店舗</h2>
          <Link href="/stores" className="text-link">
            店舗設定 →
          </Link>
        </div>
        <p>
          有効な店舗：{stores.filter((s) => s.status === "active").length}店舗
        </p>
        <Link
          className="primary inline"
          href={stores.length ? "/acquisition" : "/stores"}
        >
          {stores.length ? "集客導線を管理する →" : "最初の店舗を登録する →"}
        </Link>
      </section>
      <section className="card">
        <h2>
          Google口コミ <span className="badge">Coming Soon</span>
        </h2>
        <p>
          アクセス数は口コミ投稿数ではありません。口コミの取得・分析は今後追加予定です。
        </p>
      </section>
    </>
  );
}
