# Tiny-TID v2 セットアップガイド

## 環境要件

- **Python**: 3.10以上（推奨: 3.13）
- **uv**: Python環境管理ツール
- **モダンブラウザ**: Chrome / Firefox / Safari

## セットアップ手順

### 1. バックエンドのセットアップ

```bash
cd backend

# uv環境の作成（初回のみ）
uv venv

# 依存関係のインストール
uv pip install -r requirements.txt

# サーバー起動
uv run uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

バックエンドが起動すると:
- API: http://localhost:8001
- ドキュメント: http://localhost:8001/docs
- ヘルスチェック: http://localhost:8001/health

### 2. フロントエンドのセットアップ

別のターミナルで:

```bash
cd frontend

# HTTPサーバー起動（開発用）
python -m http.server 8000
```

フロントエンドにアクセス:
- メインページ: http://localhost:8000/index.html

## 動作確認

### バックエンドAPI

```bash
# ヘルスチェック
curl http://localhost:8001/health

# 茨木駅情報
curl http://localhost:8001/api/station-info

# 茨木駅通過列車一覧
curl http://localhost:8001/api/trains

# 路線一覧
curl http://localhost:8001/api/lines
```

### フロントエンド

1. ブラウザで http://localhost:8000/index.html にアクセス
2. 列車情報が10秒ごとに自動更新される
3. フィルタ設定で列車種別を絞り込める
4. アラーム設定で接近通知を有効化できる

## 設定

### 列車種別フィルタ

以下の種別でフィルタリング可能:
- 普通 (local)
- 快速 (rapid)
- 新快速 (special_rapid)
- 特急 (limited_express)

### アラーム設定

1. 「アラーム設定」セクションを開く
2. 上り/下り別に有効化
3. 種別ごとに個別設定可能
4. 音声再生にはブラウザの許可が必要（初回のみ）

設定はlocalStorageに自動保存されます。

## トラブルシューティング

### バックエンドが起動しない

```bash
# Python バージョン確認
python --version  # 3.10以上が必要

# 依存関係を再インストール
cd backend
uv pip install --upgrade -r requirements.txt
```

### フロントエンドでAPIエラー

- バックエンド（:8001）が起動しているか確認
- ブラウザのコンソールでエラー内容を確認
- CORSエラーの場合は `backend/config.py` の `CORS_ORIGINS` を確認

### 音声が鳴らない

- ブラウザが音声再生をブロックしている可能性
- 「音声を有効にする」ボタンをクリック
- ブラウザの設定で音声再生を許可

## 本番デプロイ

### Nginxリバースプロキシ

```nginx
server {
    listen 80;
    server_name ibaraki-tid.example.com;

    root /var/www/tiny-tid/frontend;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Systemdサービス

```ini
[Unit]
Description=Tiny-TID API
After=network.target

[Service]
User=www-data
WorkingDirectory=/var/www/tiny-tid/backend
Environment="PATH=/var/www/tiny-tid/backend/.venv/bin"
ExecStart=/var/www/tiny-tid/backend/.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8001
Restart=always

[Install]
WantedBy=multi-user.target
```

## 開発情報

### ディレクトリ構造

```
Tiny-TID/
├── backend/                 # FastAPI バックエンド
│   ├── main.py             # エントリーポイント
│   ├── config.py           # 設定ファイル
│   ├── api/                # APIエンドポイント
│   │   ├── trains.py
│   │   ├── lines.py
│   │   └── station.py
│   └── services/           # ビジネスロジック
│       ├── aggregator.py   # データ集約
│       ├── jrwest_client.py # JR西API クライアント
│       ├── ibaraki_filter.py # 茨木駅フィルタ
│       └── cache.py        # キャッシュ管理
│
└── frontend/               # フロントエンド
    ├── index.html          # メインページ
    ├── assets/
    │   ├── css/
    │   │   ├── main.css
    │   │   └── v2-styles.css
    │   ├── js/v2/          # v2実装
    │   │   ├── init.js     # 初期化
    │   │   ├── api-client.js # API通信
    │   │   ├── settings.js # 設定管理
    │   │   ├── alarm.js    # アラーム制御
    │   │   ├── audio.js    # 音声再生
    │   │   └── render.js   # UI描画
    │   └── sound/
    │       └── alarm.mp3   # アラーム音
    │
    └── old/                # Ver1実装（参考用）
```

### APIレスポンス例

**GET /api/trains**
```json
{
  "station_code": "0610226",
  "station_name": "茨木",
  "updated_at": "2026-01-22T15:30:00+09:00",
  "trains": [
    {
      "id": "JR-Kyoto:1234M",
      "number": "1234M",
      "line_name": "JR京都線",
      "type": "新快速",
      "train_type": "special_rapid",
      "destination": "姫路",
      "direction": "down",
      "position": {
        "current": "高槻 → 茨木"
      },
      "delay_minutes": 0
    }
  ]
}
```

## サポート

- **Issue**: https://github.com/anthropics/claude-code/issues
- **ドキュメント**: README.md, ARCHITECTURE_V2.md
