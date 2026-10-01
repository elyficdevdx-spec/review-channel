# Phase 2 実装記録

## 1. 変更・追加ファイル

変更対象は `review-channel` のみ。`unitory` には一切変更していない。Phase 1 migrationは編集せず、追加migrationで拡張した。

| 対象                                                                           | 内容                                                        |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| `supabase/migrations/20260930000000_phase2_acquisition.sql`                    | 新規テーブル・RLS・RPC・トリガー・集計                      |
| `src/features/acquisition/*`                                                   | 販促物の型・検証・DBアクセス・Server Actions・URL/QR生成    |
| `src/features/redirect/*`                                                      | 独立可能なリダイレクトservice・gateway・server-only handler |
| `src/features/analytics/*`                                                     | JST期間計算・実DB集計                                       |
| `src/lib/validation/google-review-url.ts`                                      | URL許可形式を共通化・現行g.page形式を追加                   |
| `src/app/r/nfc/[shortCode]/route.ts`, `src/app/r/qr/[shortCode]/route.ts`      | 公開GET／HEAD                                               |
| `src/app/(admin)/acquisition/page.tsx`                                         | 一覧・作成・累計・コピー・ページ送り                        |
| `src/app/(admin)/acquisition/[id]/page.tsx`                                    | 詳細・QR・停止・最近のアクセス                              |
| `src/app/(admin)/acquisition/[id]/qr/route.ts`                                 | 認証付きSVG表示／ダウンロード                               |
| `src/app/(admin)/page.tsx`, `analytics/page.tsx`                               | 実データKPI・日別グラフ・期間／店舗別分析                   |
| `src/components/{asset-forms,copy-url,access-stats}.tsx`                       | フォーム・コピー・数値／グラフ                              |
| `src/features/stores/{validation,actions}.ts`, `src/components/store-form.tsx` | validator再利用・URL編集後の画面更新・案内                  |
| `src/app/globals.css`, `src/app/(admin)/layout.tsx`                            | レスポンシブ拡張・Phase表示                                 |
| `tests/{phase2-database,redirect,qr-period}.test.ts`                           | DB・リダイレクト・QR・集計テスト                            |
| `scripts/test-redirect-http.ts`                                                | 実Next.js Route HandlerのローカルHTTP統合試験               |
| `.env.example`, `package.json`, `package-lock.json`, `README.md`, `docs/*`     | 環境変数・QR/テスト依存・手順                               |

## 2. Migration

- `acquisition_assets`：store FK、名前、active/inactive、日時
- `acquisition_endpoints`：asset FK、nfc/qr、ランダムshort_code UNIQUE、destination、状態、日時、asset/type UNIQUE
- `access_logs`：endpoint/asset/storeの整合FK、方式、日時、UA、nullable ip_hash、redirected_at
- 新規3テーブルにRLS。列ごとの更新権限とINDEXを追加
- `create_acquisition_asset`：所有確認、店舗状態／URL確認、asset＋2endpointを原子的に作成
- `resolve_and_log_redirect`：service_role限定、状態／type／URL検証とログ記録を1回で実行
- `asset_access_counts` / `access_summary`：ユーザーRLS適用のDB集計
- 店舗URL変更時のendpoint同期トリガー、Google URL validator拡張

## 3. 機能

販促物作成から専用URL発行、QR画像、公開アクセス記録、Googleへの302までを実装。詳細画面で販促物／個別入口を停止できる。店舗停止も反映する。ダッシュボードと分析は実ログのみ。Google API等の対象外機能は追加していない。

## 4. セキュリティ

RLS・列GRANT・所有確認RPC・原子的作成・short_code UNIQUE／122ビット乱数・URL allowlist・service_roleのserver-only隔離・公開レスポンスの最小化・IP非取得・HEAD非計測・no-storeを実装。管理画面は既存の認証とCSRFを考慮したServer Actionsを維持。

Rate Limitを注入する境界は用意したが、分散制限は未導入。ログ保持ポリシー／bot除外も次の運用段階で決める。

## 5. テスト

自動テストはPGliteとローカルHTTP fixtureを使用。実Supabaseの認証情報・外部Googleへの通信・本番データは使用していない。

- Phase 1既存テスト継続
- asset作成／別short_code／UNIQUE制約／衝突再試行失敗時の原子性
- QR作成途中に強制失敗させ、assetとNFC endpointも残らないこと
- NFC・QRの記録と正しいURLへの302
- type不一致・停止endpoint／asset／store・不存在の拒否
- 他店舗の各テーブル・集計の読み取り／更新／作成拒否、匿名アクセス拒否
- 店舗URL編集の同期と発行URL維持
- 1000件超の正確な集計、JST日付境界、0件表示
- 生成QR画像の実デコード、自社QR URLの確認
- Route Handlerを実HTTPで呼び、302／404／405／503、ログ記録、Auth非呼び出しを確認

最終結果（Node.js 22.21.0）：24テスト成功、Lint・TypeScript・整形チェック・production build成功。最終ビルドに対するHTTP統合試験も成功。クライアント用 `.next/static` にサーバー専用キーの参照や公開解決RPC処理が含まれないことを確認した。

未実施：実Supabaseへのmigration適用、実Auth/PostgRESTでの受け入れ試験、ブラウザでの視覚確認、物理NFC／印刷QR試験、Vercel公開。設定情報を捏造せず、ローカルfixtureで検証可能な範囲を完了した。

## 6. 必要なSupabase設定

Phase 2 migrationを追加適用し、サーバー環境へ `SUPABASE_SERVICE_ROLE_KEY` を追加。既存のURL・publishable key・Site URL、Auth設定は維持。`private` schemaをData APIへ公開しない。詳細はREADME参照。

## 7. 実機確認

公開HTTPSの自社originを設定し、販促物を作成。QRをスマートフォンで読み、NFCタグにはNFC専用URLをURLレコードとして書き込む。方式別アクセス増加、停止、店舗URL変更を確認。PCのlocalhost URLは実機配布しない。手順はREADMEに記載。

## 8. 次のPhase

実Supabase・メール認証・2ユーザーでの受け入れ確認と、NFCタグ／印刷QRの実機試験を行う。公開運用に合わせてRate Limit・監視・ログ保持・bot扱いを整え、その後GBP連携を独立した認可モデルで追加する。
