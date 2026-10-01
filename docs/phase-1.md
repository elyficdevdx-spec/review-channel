# Phase 1 実装記録

## 現状確認

作業ルートには複数の既存プロジェクトが存在し、開かれていた `unitory` はFlutterアプリだった。今回の新規SaaSは `review-channel/` に分離した。既存プロジェクトのソース・DB設定・migrationは変更していない。

## 追加したもの

- 基盤: `package.json` / lockfile / Next.js・TypeScript・ESLint・Tailwind設定 / `.env.example` / `.nvmrc`
- DB: `supabase/migrations/20260929000000_phase1_foundation.sql`
- 認証: `src/features/auth/*`, `src/lib/supabase/server.ts`, `src/proxy.ts`, `src/app/auth/confirm/route.ts`, `src/app/login/page.tsx`
- 店舗: `src/features/stores/*`, `src/components/store-form.tsx`, `src/app/(admin)/stores/*`
- UI: `src/app/layout.tsx`, `src/app/globals.css`, `src/app/(admin)/*`, エラー・404・設定案内ページ
- 検証: `tests/validation.test.ts`, `tests/database.test.ts`
- 手順と設計: `README.md`, `docs/architecture.md`

## DB変更

`profiles` / `stores` / `store_users` を追加。主キーはUUID。RLS、明示的GRANT、Auth登録時profile生成、updated_at更新、原子的な店舗作成RPCを追加。リモートDBには未適用。

## 手動設定

専用Supabaseプロジェクト、環境変数3項目、migrationの適用、Email Authと確認メールテンプレート、Site URL/Redirect URLsが必要。具体的な値や秘密鍵は埋め込んでいない。Vercel設定もREADMEに記載。

## 次に行うこと

まず実Supabaseで2ユーザーによる認証・メール確認・店舗分離の受け入れ確認。その後Phase 2で販促物・NFC/QR endpoint・QR画像、Phase 3でリダイレクトとアクセスログ、Phase 4で期間別ダッシュボード・分析を追加する。

## 検証結果

Node.js 22.21.0でproduction build・ESLint・TypeScriptチェックに成功。4テストが成功（RLSテスト内ではユーザー分離、列の変更制限、匿名アクセス拒否、無効URL拒否、所属作成失敗時のロールバックを検証）。ビルド済みサーバーのHTTP確認では `/setup` が200、接続情報未設定時の `/stores`・`/login` が `/setup` へ307で遷移することを確認した。

Dockerは未起動のためローカルSupabaseスタックは実行していない。実Supabaseのメール送信・Cookieセッション・PostgRESTを含む統合確認、ブラウザでの視覚確認、本番デプロイは未実行。
