# Phase 2 アーキテクチャ

## 境界

```text
src/app/(admin)             認証必須の店舗・販促物・分析UI
src/app/r/{nfc,qr}/…        公開Route Handler（管理レイアウト外）
src/features/auth          SaaSのAuth・requireUser
src/features/stores        店舗管理
src/features/acquisition   販促物操作・repository・URL/QR生成
src/features/redirect      HTTP応答・注入可能なRPC gateway・server-only設定
src/features/analytics     集計repository・日本時間の期間境界
src/lib/validation         Google口コミURLの共通allowlist
src/lib/supabase            利用者セッションでのDBアクセス
supabase/migrations        RLS・権限・制約・トランザクション・集計
```

SaaS認証と将来のGoogle Business Profile OAuthは独立した概念。GBP/OpenAI/Stripe処理は追加していない。公開リダイレクトのserviceはReact・Next.js・Cookieに依存せず、Web標準Request/Responseと注入したgatewayで動く。独立サービス化の際はhandlerと設定の移動で対応できる。

## データと書き込み権限

`profiles ← store_users → stores → acquisition_assets → acquisition_endpoints → access_logs`

- Phase 1テーブルと認証を維持。内部UUIDが主キー。Google IDは外部参照。
- assetは店舗に属する。ownerのみSELECT・名前／状態UPDATE。直接INSERTは禁止し、所有確認付きRPCから作成する。
- endpointはasset内のtypeが一意。short_codeは122ランダムビットのUUID v4を32桁hexに変換し、全endpointでUNIQUE。衝突時は最大5回再試行し、失敗時は作成全体をロールバック。
- endpointは状態のみownerが変更可能。assetへの紐付け・type・short_code・destinationはクライアントから変更できない。
- access_logsは店舗所属によるSELECTのみ。匿名・authenticatedによるINSERT・UPDATE・DELETEは禁止。複合FKでendpoint/asset/typeとasset/storeの整合を保証。
- created_at / updated_atはDBで管理。店舗URL編集のトリガーでendpoint URLを原子的に同期。作成RPCは店舗行にSHAREロックを取り、URL更新と競合して古いURLをコピーすることを防ぐ。
- owner以外のロールはPhase 1同様未導入。将来追加時は制約とRLSを同時拡張する。

## 公開アクセスと管理画面の分離

管理UI・Server Actionsは `requireUser()` で確認したユーザーセッションを使いRLSを適用。Next.js Server ActionsのPOST・Origin照合を維持し、任意HTMLを挿入しない。

公開RouteはProxy matcherから除外され、セッションを読まない。サーバー限定キーで `resolve_and_log_redirect` のみを呼ぶ。RPCのEXECUTEは `service_role` のみ。公開訪問者がSupabase RESTを直接使ってテーブルを列挙したり、任意のログをINSERTしたりする権限はない。

RPCは指定したtypeとランダムshort_codeから有効なendpoint・asset・storeを照合し、店舗URLとの一致とallowlistも検証する。ログの全FKや日時はDBが生成し、HTTPからID・時刻・IPハッシュを受け取らない。返却値は検証済みdestinationの文字列かNULLだけ。

1 DB往復の後に302を返す。独立したログ保存呼び出しや非同期のベストエフォート記録にはしない。DB失敗時は503で安全に止める。停止操作の完了後に開始したアクセスは拒否するが、すでに処理中のアクセスまで取り消す保証はしない。

`service_role` 自体は広い権限を持つため、環境変数とserver-only handlerに隔離。より強い運用分離が必要になれば、Redirect Service用の限定DBロール／秘密鍵と実行環境に分ける。

## URL・IP・QR

共通TS validatorとSQL validatorは同じallowlist。現在の `g.page/r/ID/review` と旧形式、placeid形式に対応。外部URLをサーバーから展開しないためSSRF経路は作らない。destinationを書き換え可能な汎用オープンリダイレクトにはしない。

発行URLは設定済み `NEXT_PUBLIC_SITE_URL` から生成し、リクエストのHostを信用しない。本番originはHTTPSを要求する。QRには自社 `/r/qr/` URLのみを埋め込む。表示／SVGダウンロードは認証・RLSで保護し、ログ計測を発生させない。SVGはQRライブラリで生成し、店舗名等をXMLに補間しない。

IPヘッダーは読まず、ip_hashはNULL。User-AgentはNULL文字除去・512文字制限。公開エラーHTMLには入力値・例外・DB情報を表示せず、CSP・no-store・noindexを付ける。HEADは明示的405として計測しない。

## 集計の意味

UTCのtimestamptzで保存、日本時間（Asia/Tokyo）の日付区切りで今日／7日／30日を算出。7日は今日＋過去6日、30日は今日＋過去29日。上端は現在時刻未満。NFC/QRのダッシュボードカードは過去30日。販促物詳細・一覧は全期間。

`asset_access_counts` と `access_summary` はsecurity invokerでRLSに従い、DBで集計してから返す。PostgRESTの1000行制限でアクセス数が切り捨てられない。件数0の店舗／販促物も返す。店舗・asset別の絞り込みをRPCで提供する。

ログはHTTPリダイレクトの準備時点を表し、bot・再訪を含む。実際のGoogle表示・口コミ投稿・ユニーク顧客を示さない。タイムアウト・接続中断でもログがすでにcommitされた場合がある。

## 次の運用段階

- 実SupabaseのAuth/PostgRESTを通した受け入れ試験、物理NFC／印刷QRの検証
- 地理的なリージョン配置とコールドスタートを含む実測、障害監視
- `allowRequest` インターフェースに分散Rate Limitを接続。WAF／bot除外ポリシーも決定
- ログ保持期間・削除ジョブ・プライバシー表示、増加時のパーティション／集計最適化
- その後、別フェーズでGBP接続資格情報・口コミ取得を導入し、SaaSログインと分離

参照: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)、[DB関数と実行権限](https://supabase.com/docs/guides/database/functions)、[Googleの口コミリンク発行案内](https://support.google.com/business/answer/16816815?hl=en-GB)。
