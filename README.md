# Tiny-TID v2 - 茨木駅特化版

JR西日本の列車走行位置情報を表示するWebアプリケーション（茨木駅特化）

## 📋 概要

**Ver 2.0** は茨木駅に特化したクライアント・サーバーモデルです。

- 🚉 **茨木駅固定**: 駅選択不要
- 🚄 **全路線対応**: 近畿エリアの全路線から茨木駅通過列車を自動抽出
- ⚡ **10秒更新**: リアルタイムで列車位置を追跡
- 🔔 **接近アラーム**: 列車接近時に通知（Ver1機能継承）
- 🎙️ **音声読み上げ**: TTS機能（Ver1機能継承）

## 🏗️ アーキテクチャ

```
Frontend (Vanilla JS) ←→ Backend (FastAPI) ←→ JR West API
     ↓                         ↓
localStorage            30秒キャッシュ
```

詳細は [ARCHITECTURE_V2.md](./ARCHITECTURE_V2.md) を参照

## 🚀 セットアップ

### 必要環境

- **Backend**: Python 3.10+
- **Frontend**: モダンブラウザ（Chrome/Firefox/Safari推奨）

### バックエンド起動

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

APIドキュメント: http://localhost:8001/docs

### フロントエンド起動

```bash
cd frontend
python -m http.server 8000
```

アクセス: http://localhost:8000

## 📁 ディレクトリ構造

```
Tiny-TID/
├── frontend/           # Nginx公開ディレクトリ
│   ├── old/           # Ver1実装（保存用）
│   ├── assets/        # Ver2実装
│   └── index.html     # メインページ
│
├── backend/           # FastAPI バックエンド
│   ├── main.py        # エントリーポイント
│   ├── api/           # APIエンドポイント
│   ├── services/      # ビジネスロジック
│   └── models/        # データモデル
│
├── ARCHITECTURE_V2.md # アーキテクチャ設計書
└── README.md          # このファイル
```

## 🔌 API エンドポイント

### GET /api/trains

茨木駅通過列車一覧

```json
{
  "station_code": "0610226",
  "station_name": "茨木",
  "updated_at": "2026-01-22T15:45:30+09:00",
  "trains": [
    {
      "id": "JR-Kyoto:1234M",
      "line_name": "JR京都線",
      "type": "新快速",
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

### GET /api/lines

茨木駅通過路線一覧

### GET /api/station-info

茨木駅情報

### GET /health

ヘルスチェック

## 🛠️ 開発

### バックエンドのテスト

```bash
cd backend
python -m pytest tests/  # TODO: テスト追加予定
```

### ログレベル変更

```python
# backend/main.py
logging.basicConfig(level=logging.DEBUG)  # DEBUGに変更
```

## 📦 本番デプロイ

### Nginxリバースプロキシ設定

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

### Systemdサービス設定

```ini
[Unit]
Description=Tiny-TID API
After=network.target

[Service]
User=www-data
WorkingDirectory=/var/www/tiny-tid/backend
Environment="PATH=/var/www/tiny-tid/backend/venv/bin"
ExecStart=/var/www/tiny-tid/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8001
Restart=always

[Install]
WantedBy=multi-user.target
```

## 🔄 Ver1からの移行

Ver1の実装は `frontend/old/` に保存されています。

主な変更点:
- ✅ 駅選択機能を削除（茨木駅固定）
- ✅ サーバー側で全路線データ集約
- ✅ クライアントは10秒ごとにREST API をポーリング
- ✅ 列車種別フィルタUI追加（TODO）

## 📝 TODO

- [x] フロントエンドUI実装（茨木駅特化版）
- [x] 列車種別フィルタUI
- [x] Ver1アラーム機能の移植
- [ ] Ver1 TTS機能の移植（将来対応）
- [ ] ユニットテスト追加
- [ ] Docker対応

## ✅ 実装完了

- ✅ FastAPI バックエンド
- ✅ 茨木駅特化フロントエンド
- ✅ 列車種別フィルタ機能
- ✅ 接近アラーム機能
- ✅ 音声再生機能（iOS対応）
- ✅ localStorage設定管理
- ✅ 10秒自動更新

## 📄 ライセンス

MIT License

## 🙏 謝辞

- JR西日本 列車走行位置API
- FastAPI
- Uvicorn
