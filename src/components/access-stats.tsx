import type { Counts, Summary } from "@/features/analytics/repository";
import { periodDays } from "@/features/analytics/period";
export function AccessStats({ counts }: { counts: Counts }) {
  return (
    <div className="stats access-stats">
      {[
        ["NFC", counts.nfc],
        ["QR", counts.qr],
        ["合計アクセス", counts.total],
      ].map(([label, value]) => (
        <section className="card" key={label}>
          <p>{label}</p>
          <strong className="number">
            {Number(value).toLocaleString("ja-JP")}
            <small>回</small>
          </strong>
        </section>
      ))}
    </div>
  );
}
export function AccessTrend({
  daily,
  from,
  to,
}: {
  daily: Summary["daily"];
  from: string;
  to: string;
}) {
  const points = periodDays(from, to).map((day) => ({
    day,
    total: daily.find((d) => d.day === day)?.total ?? 0,
  }));
  const max = Math.max(1, ...points.map((p) => p.total));
  return (
    <section className="card">
      <h2>日別アクセス推移</h2>
      <div
        className="trend"
        role="img"
        aria-label={points.map((p) => `${p.day}: ${p.total}回`).join("、")}
      >
        {points.map((p) => (
          <div
            className="trend-column"
            key={p.day}
            title={`${p.day}: ${p.total}回`}
          >
            <span
              className="trend-bar"
              style={{ height: `${(p.total / max) * 130}px` }}
            />
            <span className="trend-label">{p.day.slice(5)}</span>
          </div>
        ))}
      </div>
      <p className="hint">
        日本時間（JST）。導線の利用回数であり、Google口コミの投稿数ではありません。
      </p>
    </section>
  );
}
