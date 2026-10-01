import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Review Channel | 店舗管理",
  description: "店舗とお客様をつなぐ口コミ導線の管理",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
