# Tiny-TID (ver6 — Cloudflare Workers + Rust)

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
npm install                                   # wrangler / esbuild
npx wrangler d1 migrations apply tiny-tid --local
python dev_proxy.py 8001 .                    # ローカル上流プロキシ(workerdの外部fetch回避用)
node node_modules/wrangler/bin/wrangler.js dev --port 8787
# .dev.vars の UPSTREAM_ORIGIN を http://127.0.0.1:8001 に設定して起動すること

cargo test -p tid-core                        # ドメインロジックのテスト
pwsh ./build-legacy.ps1                       # JS変更後のlegacyバンドル再生成
```

初回のスナップショットは `/api/view` 初アクセス時に遅延構築される(本番は毎日03:00 JSTのCronで再構築)。

## 本番デプロイ

1. `npx wrangler d1 create tiny-tid` / `npx wrangler kv namespace create SNAPSHOTS` → `wrangler.jsonc` のIDを更新
2. `npx wrangler d1 migrations apply tiny-tid --remote`
3. `npx wrangler secret put VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`(鍵は `npx web-push generate-vapid-keys`)
4. `npx wrangler deploy`

## API

- `GET /api/view?station=<コード|駅名>&pass=hide|show` — 統合・正規化済みビューモデル
- `POST/DELETE /api/push/subscriptions` — 接近通知の購読(背景通知は最短1分精度のCron)

## 設計メモ

- 駅の同一性は `(路線ID, 駅コード)`。数値コードはエリア横断で再利用されるため、路線間接続は `transfer[]` / `design.upside/downside` の明示リンクのみで結ぶ(v2グラフ)。
- 背景通知の重複抑制は D1(`last_notified_key` + 3分窓)。フォアグラウンドの音声アラームは従来どおりクライアント側(10秒ポーリング)。
- `sample/westjr` の `STOP_TRAINS` により stopTrains 数値 = カテゴリID の対応を確認済み。
