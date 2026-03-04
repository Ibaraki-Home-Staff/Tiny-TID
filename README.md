# Tiny-TID (Plain HTML/CSS/JS)

このテンプレートは、プレーンなHTML/CSS/JSで作る小規模サイト向けの、わかりやすいフォルダ構成例です。共通ヘッダー/フッターをコンポーネント化し、ページから読み込みます。

## フォルダ構成
- `index.html` … トップページ（エリア・路線選択）
- `TID.html` … 運行情報ページ（ルート直下）
- `pages/` … 下層ページ（今は未使用）
- `components/` … 共通パーツ（`header.html`/`footer.html`）
- `assets/css/` … CSS（`main.css`がエントリ、他は分割）
- `assets/js/` … JS（`main.js`がエントリ、`area.js` 等）
- `assets/img/` … 画像アセット

## 利用方法（デプロイ）
JR西日本のAPIはCORSヘッダーを返さないため、フロント（ブラウザ）から直接 `https://www.train-guide.westjr.co.jp/api/v3/` を fetch するとブロックされます。以下のいずれかで「同一オリジンに見せるプロキシ」を用意してください。

- Cloudflare Workers（推奨）
  - ルート: `example.com/api/v3/*` を Workers のルートに設定
  - Workerで `https://www.train-guide.westjr.co.jp/api/v3/*` にそのまま中継（GETのみ）
  - これにより、フロントは相対パス `/api/v3/...` を fetch するだけでCORS対象外になります
- Apache の mod_proxy（利用可能なレンタルサーバーのみ）
  - `.htaccess` に `RewriteRule ^api/v3/(.*)$ https://www.train-guide.westjr.co.jp/api/v3/$1 [P,L]`
  - サーバーで mod_rewrite, mod_proxy, mod_proxy_http が有効であることが前提

フロント側のコードは既に `API_BASE = '/api/v3/'` を利用しています（`assets/js/area.js`）。
- 別パス/サブドメインを使う場合は、`assets/js/main.js` より前に以下を挿入し上書きできます:
  - `<script>window.TID_API_BASE = 'https://sub.example.com/api/v3/';</script>`

## ローカル確認
- 単純な静的配信でOK（例: `python -m http.server 8000`）
- ただし、プロキシが無いローカルでは本番APIへの fetch はCORSで失敗します
- 動作確認は「プロキシが効く本番ドメイン」で行うか、ローカルサンプルJSON（`area_*.json`）で代替してください

## 古いブラウザ向け（Legacy Bundle）
- このリポジトリは `assets/js/runtime-loader.js` で `modern/legacy` を自動判定し、右下バッジで現在モードを表示します。
- modern非対応環境では `assets/js/legacy-*.js` を読み込みます（module未対応環境向け）。
- JSを変更したら、以下でバンドルを再生成してください。
  - `pwsh ./build-legacy.ps1`

## ページ追加手順
1. `pages/` に `foo.html` を作成（`<base href="/">` と `/assets/...` の絶対パスを維持）
2. `components/header.html` のナビにリンクを追加

## カスタマイズ
- 色や余白: `assets/css/variables.css`
- 基本タイポ/リンク: `assets/css/base.css`
- ヘッダー/フッターやレスポンシブ: `assets/css/layout.css`
- ボタン等UI部品: `assets/css/components.css`
