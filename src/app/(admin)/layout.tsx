import Link from "next/link";
import { requireUser } from "@/features/auth/session";
import { signOut } from "@/features/auth/actions";
const links = [
  ["/", "ダッシュボード"],
  ["/reviews", "口コミ"],
  ["/acquisition", "集客導線"],
  ["/analytics", "分析"],
  ["/stores", "店舗設定"],
];
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireUser();
  return (
    <div className="shell">
      <a className="skip" href="#main">
        本文へ移動
      </a>
      <aside>
        <Link className="brand" href="/">
          Review<span>Channel</span>
        </Link>
        <p className="eyebrow">WORKSPACE</p>
        <nav aria-label="メインナビゲーション">
          {links.map(([href, label]) => (
            <Link key={href} href={href}>
              {label}
              <span aria-hidden>›</span>
            </Link>
          ))}
        </nav>
        <div className="account">
          <p>{user.email}</p>
          <form action={signOut}>
            <button className="secondary">ログアウト</button>
          </form>
        </div>
      </aside>
      <main id="main">
        <header className="topbar">
          <span>店舗管理ワークスペース</span>
          <span className="badge">Phase 2</span>
        </header>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
export const dynamic = "force-dynamic";
