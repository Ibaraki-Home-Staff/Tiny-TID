# Tiny-TID (ver6 — Rust core + Cloudflare / SORAHOST backends)

JR西日本の列車走行位置を表示する Super-TID 風ビューア。ver6 からバックエンドを Cloudflare Workers(Rust / workers-rs)に移行し、クライアントは表示専用になった。

## 構成

```
crates/tid-core/    ドメインロジック(純Rust、CF非依存)
                    model / category / network(v2路線網グラフ) / view / alarm / traffic
crates/tid-worker/  workers-rs glue(routes / upstream / network_job / cron / push / util)
public/             デプロイ対象の静的サイト(index.html, assets/, service-worker.js, manifest)
old/                旧フルフローのアーカイブ(デプロイ対象外)
migrations/         D1スキーマ(subscriptions / network_snapshot)
sample/westjr/      参考ライブラリ(非同梱データの抽出元、gitignore対象)
VER6-PLAN.md        移行計画
```

## 開発コマンド

```bash
bun install                                     # wrangler / esbuild
bunx wrangler d1 migrations apply tiny-tid --local
python dev_proxy.py 8001 .                    # ローカル上流プロキシ(workerdの外部fetch回避用)
bunx wrangler dev --port 8787
# .dev.vars の UPSTREAM_ORIGIN を http://127.0.0.1:8001 に設定して起動すること

cargo test -p tid-core                        # ドメインロジックのテスト
pwsh ./build-legacy.ps1                       # JS変更後のlegacyバンドル再生成
```
または `dev-local.bat` でプロキシ+Workerをまとめて起動/停止(`status`/`stop` 付き)。
初回のみ: `rustup target add wasm32-unknown-unknown` と `cargo install worker-build` が必要。

初回のスナップショットは `/api/view` 初アクセス時に遅延構築される(本番は毎日03:00 JSTのCronで再構築)。

## 本番デプロイ

`ver6` への push で `.github/workflows/ver6.yml` が check → CF deploy を自動実行する。
D1 は CI が自動発行する(`ci/provision_d1.py`: 同名があれば再利用)。
GitHub Environment `Cloudflare` に以下の Secrets を登録する。Secrets 未登録なら
deploy は理由付き skip される。トークン類は一度しか表示されないため失くしたら再発行すること。

| Secret | 用途 | 権限・形式 |
|---|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | 対象アカウント | 32桁hex。dash の Workers & Pages 概要や URL で確認([公式手順](https://developers.cloudflare.com/fundamentals/account/find-account-and-zone-ids/)) |
| `CLOUDFLARE_API_TOKEN` | deploy・D1発行・migrate・secrets登録 | Account 権限: `D1: Read` (list/解決)・`D1: Write` (create/migrate)・`Workers Scripts: Read`・`Workers Scripts: Write` (deploy/secret put)。対象アカウントに範囲指定すること([公式手順](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/))。独自ドメインを使う場合のみ追加で Zone 権限 `Workers Routes: Edit` を対象ゾーンに付与すること(routes 登録の list/create に必要)。初回だけ workers.dev サブドメインが無効なら dash で有効化すること |
| `VAPID_PRIVATE_KEY` (任意) | 背景Pushの署名鍵 | base64url 43文字(32B無填充)。`bunx web-push generate-vapid-keys` の privateKey をそのまま登録 |
| `VAPID_SUBJECT` (任意) | Push送信元表示 | `mailto:連絡先` 形式。JWT の sub クレームに入り、通知の送信者として使われる |

VAPID 2件なしでも閲覧系は動作し、背景通知のみ不動になる。漏洩時は鍵を作り直して
Secrets を更新し、workflow を再実行する(手動なら `secret put` のみで反映、コード再デプロイ不要)。ユーザーの再購読は不要。

手動デプロイは従来通り `bunx wrangler deploy`。

## API

- `GET /api/view?station=<コード|駅名>&pass=hide|show` — 統合・正規化済みビューモデル
- `POST/DELETE /api/push/subscriptions` — 接近通知の購読(背景通知は最短1分精度のCron)

## 設計メモ

- 駅の同一性は `(路線ID, 駅コード)`。数値コードはエリア横断で再利用されるため、路線間接続は `transfer[]` / `design.upside/downside` の明示リンクのみで結ぶ(v2グラフ)。
- 背景通知の重複抑制は D1(`last_notified_key` + 3分窓)。フォアグラウンドの音声アラームは従来どおりクライアント側(10秒ポーリング)。
- `sample/westjr` の `STOP_TRAINS` により stopTrains 数値 = カテゴリID の対応を確認済み。

## バックエンド分岐(CF / SORAHOST)

ドメインは `crates/tid-core` に一本化し、API契約(`/api/view`, `/api/areas`,
`/api/stations`, `/api/push/subscriptions`)を両バックエンドで共有する。
フロント(`public/`)は相対 `/api` 参照のため無変更でどちらの backend でも動く。

| 項目 | Cloudflare (従来) | SORAHOST |
|---|---|---|
| 実装 | `crates/tid-worker` (workers-rs) | `server/` (Node + tid-core WASM) |
| 永続化 | D1 (`migrations/`) | SQLite (`DATA_DIR/tiny-tid.sqlite3`、スキーマは migrations と1:1 + `stale_cache`) |
| 上流キャッシュ | メモリ保持+期限切れfallback(全6線で約48KB、KV廃止) | メモリ + SQLite `stale_cache`(再起動後も stale 返し可) |
| 定期実行 | cron trigger (毎分Push/日次03:00 JST再構築) | プロセス内タイマ (`server/src/scheduler.js`、同等間隔) |
| デプロイ | `bunx wrangler deploy` | `sorahost deploy` (`sorahost.json`, nodeモード) |

### SORAHOST 開発

```bash
pwsh ./build-wasm.ps1   # tid-core 変更時のみ再生成 (要 wasm-bindgen-cli 0.2.127、Cargo.lock に合わせること)
cd server && npm install
PORT=8787 DATA_DIR=../data node src/server.js  # リポジトリ直下で実行する場合は node server/src/server.js
# 動作確認: /api/areas, /api/view?station=茨木, /api/stations?line=kyoto
```

環境変数は `wrangler.jsonc` の vars と同名(`UPSTREAM_ORIGIN`, `FIXED_*`,
`LINE_SCOPE`) + `PORT`(PteWorker が注入)/`HOST`(既定127.0.0.1)/
`DATA_DIR`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT`(任意 `VAPID_PUBLIC_KEY`、
なければ秘密鍵から導出)。Node 22 以上が必要(`node:sqlite` 使用)。
注意: CF 側に KV はない(実測 48KB のため isolate メモリ L1 + PoP 共有 edge
cache L2、上流 6 線の取得は並列 fan-out)。SORAHOST 側のみ再起動耐性のた
め SQLite に stale を残す。
