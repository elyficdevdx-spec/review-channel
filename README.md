# Review Channel — Phase 2

店舗向け口コミ導線SaaS。Next.js App Router / TypeScript / Tailwind CSS / Supabase Auth・PostgreSQL・RLS、Vercel向けの通常のNext.jsアプリです。`unitory` 等の既存プロジェクトは変更していません。

## 利用できる機能

- Phase 1のメール認証・店舗登録／編集・owner権限を維持
- 販促物を店舗・名前から作成し、NFC／QR専用URLを原子的に発行
- 集客導線一覧（20件ずつ）・詳細・名前変更・有効／停止
- URLコピー、QR表示・SVGダウンロード、NFCタグへの書き込み用URL
- 公開URL → 状態チェック → DB記録 → Google口コミ投稿URLへ302
- 全期間アクセス数、最近20件、今日／7日／30日、店舗別・販促物別の分析
- 実データのみのダッシュボードと日別グラフ。0件は0表示

口コミ取得・Google OAuth・AI・MEO・課金は未実装です。**計測するのは口コミ投稿ページへの導線の利用回数であり、口コミ投稿数ではありません。**

## 起動

Node.js 22.13以上の22系を使用します。

```sh
nvm use
npm ci
cp .env.example .env.local
```

| 環境変数                               | 用途                                                                                                           |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | 専用SupabaseプロジェクトのURL                                                                                  |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable key、管理画面は利用者のセッションでRLSを適用                                                       |
| `NEXT_PUBLIC_SITE_URL`                 | 発行URLのorigin。本番は公開HTTPSドメイン、ローカルは `http://localhost:3000`                                   |
| `SUPABASE_SERVICE_ROLE_KEY`            | **サーバー限定**。同じSupabaseプロジェクトのlegacy `service_role` JWT。公開リダイレクト専用RPCを呼ぶために使用 |

`service_role` は管理者権限のキーです。`NEXT_PUBLIC_` を付けず、`.env.local` とVercelのサーバー環境変数にのみ保存します。クライアント・NFC・QR・URLに含めません。アプリの公開リダイレクト処理だけが読み、管理画面のDBアクセスには使いません。

### Supabase migration

Phase 1適用済みなら、**Phase 2のmigrationだけ**を追加適用します。

```text
supabase/migrations/20260929000000_phase1_foundation.sql
supabase/migrations/20260930000000_phase2_acquisition.sql
```

新規DBにはこの順で適用します。SQL Editorでファイル内容を実行するか、CLIを初期化・専用プロジェクトにlinkした上で差分を確認して `supabase db push` を実行してください。ビルド時にはDB変更を自動実行しません。`unitory` 用のDBには適用しないでください。

Supabase Data APIで `public` を公開し、`private` は公開しないでください。標準の `anon` / `authenticated` / `service_role` ロールが必要です。Phase 2の公開解決RPCは `service_role` だけが実行可能です。一般顧客にSupabaseのキーやテーブル読み取り権限を渡す必要はありません。

### Auth設定（Phase 1から変更なし）

1. Email provider・Confirm emailを有効にし、最低パスワード長を8以上に設定。
2. Authentication → URL ConfigurationのSite URLを `NEXT_PUBLIC_SITE_URL` に合わせ、Redirect URLsに利用するoriginの `/auth/confirm` を登録。
3. Confirm signupメールテンプレートのリンクを次に設定。

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email"
  >メールアドレスを確認</a
>
```

本番メール送信にはSMTP設定を行ってください。

```sh
npm run dev
```

設定変更後は再起動します。接続情報未設定時は設定案内、DB未適用や取得失敗時はエラーを表示します。架空データにはフォールバックしません。

### Google口コミURL

店舗設定からGoogleの「クチコミを増やす」等で取得した口コミ投稿用リンクを登録します。Phase 2で現在の `/r/ID/review` 形式を追加しました。

- `https://g.page/r/STORE_ID/review`
- `https://g.page/SHORT_NAME/review`
- `https://search.google.com/local/writereview?placeid=PLACE_ID`

HTTPS・厳密なホストとパスをアプリ／DBの双方で検証します。任意のクエリ、一般の地図共有URL、`google.com/url`、`maps.app.goo.gl`、`share.google` は許可しません。Googleが発行した**口コミ投稿用URL**を使用してください。Googleの所有権確認や到達性検証は行いません。

店舗URLを編集すると既存endpointのdestinationを同一トランザクションで同期します。**既に発行したNFC／QRのURLや画像を作り直す必要はありません。**

Phase 1の店舗URLは必須のままです。販促物作成画面でもURLの有無・形式・店舗の有効状態を再確認し、不足時は店舗設定に誘導します。

## 公開リダイレクト

`GET /r/nfc/[shortCode]` と `GET /r/qr/[shortCode]` は管理画面・ログイン・Cookie更新を通らず、DBへの1回のRPCでendpoint・asset・storeを確認し、ログを保存して302を返します。

- type不一致、存在しないコード、停止中、許可されない遷移先：404の安全な案内
- DB／ログ保存エラー、キー未設定、2.5秒のDB通信タイムアウト：503、Googleには転送しない
- HEAD：405、ログを増やさない
- すべてno-store。中間画面・外部URL解決・Google API呼び出しなし

`redirected_at` はサーバーが302を準備した時刻です。Googleへの到達や投稿完了の証明ではありません。通信タイムアウト時はDB側で記録済みの可能性があります。サーバー内の自動再試行はしません。

生IPを取得・保存しません。`ip_hash` はNULL。User-Agentのみ最大512文字で記録し、管理画面の最近の履歴には方式と日時だけを表示します。

同じ人の再アクセス・bot・リンクプレビューのGETも計上されます。ユニーク人数や確定コンバージョンではありません。`allowRequest` を差し替えられる構造ですが、分散Rate Limit／bot除外は未実装です。

## NFC／QRを実機で試す

1. migrationと環境変数を設定し、Vercel等の**公開HTTPS URL**にデプロイ。`NEXT_PUBLIC_SITE_URL` をそのoriginに設定します。プレビューのパスワード保護等は一般顧客のアクセスを妨げるため、実機確認時の公開URLはログイン不要にします。
2. 店舗を登録し、Google口コミ投稿URLと店舗状態「有効」を確認。
3. `/acquisition` で店舗と販促物名を指定して作成。
4. 詳細のQRをスマートフォンのカメラで読む。Google口コミ投稿ページに移動し、詳細のQRアクセスが増えることを確認。SVGをダウンロードして印刷し、印刷物でも試します。
5. NFC対応タグへ、タグ書き込みアプリで **NFC専用URLをURLレコードとして**書き込む。スマートフォンをタッチしてGoogleへ移動し、NFCアクセスだけが増えることを確認。QR専用URLと取り違えないでください。
6. 販促物を「停止」に変更し、NFC・QRとも404案内になることを確認。再度有効化した後、入口ごとの停止と店舗停止も確認。
7. 店舗のGoogle口コミURLを別の有効な投稿用URLに変更し、同じタグ・QRで変更後のページへ移動することを確認。
8. 別アカウントで他店舗の販促物・QR画像・ログが見えないことを確認。

スマートフォンからの `localhost` はPCではなくスマートフォン自身を指します。PCのローカルURLをNFC／QRへ書き込んで実機用として配布しないでください。

## 検証コマンド

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:http
```

- `npm test`: Phase 1回帰、PGlite（PostgreSQL）上の両migration・RLS・RPC・ロールバック、入力・URL検証、期間境界、実QR画像のデコード。
- `npm run test:http`: ビルド済みNext.jsをローカル起動し、テスト専用RPCサーバーとPGliteへ接続。実Route Handlerの302／404／405／503、ログ記録、Auth呼び出しがないことを検証。テスト用のURL・キーは子プロセス内のみ。本番値や外部サービスは使いません。終了時に停止します。

PGliteのテストはAuthテーブルと `auth.uid()` の契約を再現します。実SupabaseのAuth・PostgREST・メールを含む統合確認や実機確認の代替ではありません。

## Vercel

Root Directoryは `review-channel`（このフォルダ単体のリポジトリならルート）、FrameworkはNext.js、Node.jsは22.x。環境変数4つを設定し、migration適用後にデプロイしてください。SupabaseとVercelの実行リージョンを近づけるとリダイレクトの通信遅延を減らせます。公開後に実測してください。

Supabase設定・リモートDBへの適用・Vercelデプロイ・実機NFC試験は未実行です。

詳細：[Phase 2変更・検証記録](docs/phase-2.md) / [設計](docs/architecture.md) / [Phase 1記録](docs/phase-1.md)
