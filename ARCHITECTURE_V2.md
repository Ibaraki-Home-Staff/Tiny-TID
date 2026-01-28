# Tiny-TID v2 アーキテクチャ設計書

## 概要

**茨木駅特化版 - クライアント・サーバーモデル**

Ver1からの主な変更:
- ❌ **削除**: 駅選択機能（茨木駅固定）
- ❌ **削除**: エリア選択機能（近畿固定）
- ✅ **追加**: FastAPIバックエンド
- ✅ **追加**: 列車種別フィルタUI
- ✅ **改善**: サーバー側で全路線データ集約→茨木駅通過列車のみ抽出

## システム構成

```
┌──────────────────────────────────────────────────┐
│         Browser (Frontend)                       │
│  ┌────────────────────────────────────────────┐ │
│  │ 茨木駅特化 UI (index.html)                 │ │
│  │ ┌──────────────────────────────────────┐  │ │
│  │ │ 列車種別フィルタ                     │  │ │
│  │ │ □ 普通 □ 快速 □ 新快速 □ 特急     │  │ │
│  │ └──────────────────────────────────────┘  │ │
│  │ ┌──────────────────────────────────────┐  │ │
│  │ │ 接近アラーム設定（Ver1流用）         │  │ │
│  │ │ 上り: [駅X分前] 下り: [駅X分前]     │  │ │
│  │ └──────────────────────────────────────┘  │ │
│  │ ┌──────────────────────────────────────┐  │ │
│  │ │ 列車一覧表示                         │  │ │
│  │ │ 上り | 下り                          │  │ │
│  │ └──────────────────────────────────────┘  │ │
│  └────────────┬───────────────────────────────┘ │
│               │ 10秒ごとに fetch()               │
│  localStorage │ GET /api/trains                  │
│  (設定保存)    │                                 │
└───────────────┼──────────────────────────────────┘
                │
                │ HTTP/JSON
                │
┌───────────────▼──────────────────────────────────┐
│      FastAPI Backend (Python 3.10+)              │
│  ┌────────────────────────────────────────────┐ │
│  │ API Endpoints                              │ │
│  │                                            │ │
│  │ GET /api/trains                            │ │
│  │  → 茨木駅通過列車リスト（全路線）          │ │
│  │  Response:                                 │ │
│  │  {                                         │ │
│  │    "station_code": "0610226",              │ │
│  │    "station_name": "茨木",                 │ │
│  │    "updated_at": "ISO8601",                │ │
│  │    "trains": [...]                         │ │
│  │  }                                         │ │
│  │                                            │ │
│  │ GET /api/lines                             │ │
│  │  → 茨木駅通過路線リスト                    │ │
│  │  Response:                                 │ │
│  │  {                                         │ │
│  │    "lines": [                              │ │
│  │      {"id": "JR-Kyoto", "name": "京都線"},│ │
│  │      ...                                   │ │
│  │    ]                                       │ │
│  │  }                                         │ │
│  │                                            │ │
│  │ GET /api/station-info                      │ │
│  │  → 茨木駅情報                              │ │
│  │                                            │ │
│  │ GET /health                                │ │
│  │  → ヘルスチェック                          │ │
│  └────────────┬───────────────────────────────┘ │
│               │                                  │
│  ┌────────────▼───────────────────────────────┐ │
│  │ JR West API Aggregator Service            │ │
│  │                                            │ │
│  │ - 近畿エリア全路線データ並列取得           │ │
│  │   (JR-Kyoto, JR-Kosei, JR-Kobe, etc.)     │ │
│  │ - 茨木駅コード: 0610226                    │ │
│  │ - 各路線の列車位置を解析                   │ │
│  │ - 茨木駅を含む区間の列車のみ抽出           │ │
│  │ - 30秒キャッシュ（メモリ内）               │ │
│  └────────────┬───────────────────────────────┘ │
│               │                                  │
│  ┌────────────▼───────────────────────────────┐ │
│  │ Models & Data Processing                  │ │
│  │                                            │ │
│  │ - Train (列車モデル)                       │ │
│  │ - Station (駅モデル)                       │ │
│  │ - Line (路線モデル)                        │ │
│  │ - TrainFilter (フィルタリングロジック)     │ │
│  └────────────────────────────────────────────┘ │
└──────────────────┬───────────────────────────────┘
                   │
                   │ HTTPS (CORS Proxy経由)
                   │
┌──────────────────▼───────────────────────────────┐
│   JR West Train Guide API                        │
│   https://www.train-guide.westjr.co.jp/api/v3/   │
│                                                   │
│   - area_kinki_master.json (路線マスター)        │
│   - JR-Kyoto.json (京都線位置データ)             │
│   - JR-Kosei.json (湖西線位置データ)             │
│   - ... (他の路線)                               │
└───────────────────────────────────────────────────┘
```

## ディレクトリ構造

```
Tiny-TID/
├── frontend/                    # Nginx公開ディレクトリ
│   ├── old/                     # Ver1実装（保存用）
│   │   ├── assets/
│   │   ├── components/
│   │   ├── index.html
│   │   └── TID.html
│   │
│   ├── index.html               # メイン: 茨木駅TIDページ
│   ├── assets/
│   │   ├── js/
│   │   │   ├── api-client.js   # FastAPI通信クライアント
│   │   │   ├── settings.js     # localStorage設定管理
│   │   │   ├── ui/
│   │   │   │   ├── train-type-filter.js  # 列車種別フィルタUI
│   │   │   │   ├── alarm.js              # アラームUI（Ver1流用）
│   │   │   │   └── tts.js                # 読み上げUI（Ver1流用）
│   │   │   ├── render.js       # 列車表示ロジック
│   │   │   └── main.js         # エントリーポイント
│   │   └── css/
│   │       └── main.css
│   └── components/
│       └── header.html
│
├── backend/                     # FastAPIバックエンド
│   ├── main.py                  # FastAPIアプリケーション
│   ├── config.py                # 設定（駅コード、キャッシュ時間等）
│   ├── requirements.txt
│   │
│   ├── api/                     # APIエンドポイント
│   │   ├── __init__.py
│   │   ├── trains.py           # GET /api/trains
│   │   ├── lines.py            # GET /api/lines
│   │   └── station.py          # GET /api/station-info
│   │
│   ├── services/                # ビジネスロジック
│   │   ├── __init__.py
│   │   ├── jrwest_client.py    # JR西日本API HTTPクライアント
│   │   ├── aggregator.py       # 全路線データ集約
│   │   ├── ibaraki_filter.py   # 茨木駅フィルタリング
│   │   └── cache.py            # インメモリキャッシュ（30秒TTL）
│   │
│   ├── models/                  # データモデル
│   │   ├── __init__.py
│   │   ├── train.py            # Train, TrainPosition
│   │   ├── station.py          # Station, StationInfo
│   │   └── line.py             # Line, LineMaster
│   │
│   └── utils/
│       ├── __init__.py
│       └── logger.py           # ロギング設定
│
├── old/                         # ルート直下の旧実装（削除予定）
│
├── .gitignore
├── README.md
├── ARCHITECTURE_V2.md           # このファイル
└── docker-compose.yml           # オプション
```

## API仕様

### GET /api/trains

茨木駅通過列車の一覧を取得

**Query Parameters:**
- なし（茨木駅固定）

**Response (200 OK):**
```json
{
  "station_code": "0610226",
  "station_name": "茨木",
  "updated_at": "2026-01-22T15:45:30+09:00",
  "trains": [
    {
      "id": "JR-Kyoto:1234M",
      "line_id": "JR-Kyoto",
      "line_name": "JR京都線",
      "number": "1234M",
      "type": "新快速",
      "type_category": "rapid",  // local, rapid, limited_express
      "destination": "姫路",
      "direction": "down",  // up or down
      "position": {
        "current": "高槻 → 茨木",
        "from_station_code": "0610235",
        "to_station_code": "0610226"
      },
      "delay_minutes": 0,
      "estimated_arrival_ibaraki": "2026-01-22T15:47:00+09:00",
      "cars": 12,
      "stops_at_ibaraki": true
    },
    {
      "id": "JR-Kosei:5678M",
      "line_id": "JR-Kosei",
      "line_name": "湖西線",
      "number": "5678M",
      "type": "普通",
      "type_category": "local",
      "destination": "近江今津",
      "direction": "up",
      "position": {
        "current": "茨木 → 高槻",
        "from_station_code": "0610226",
        "to_station_code": "0610235"
      },
      "delay_minutes": 2,
      "estimated_arrival_ibaraki": null,  // 既に通過済み
      "cars": 4,
      "stops_at_ibaraki": true
    }
  ]
}
```

### GET /api/lines

茨木駅を通過する路線リスト

**Response (200 OK):**
```json
{
  "lines": [
    {"id": "JR-Kyoto", "name": "JR京都線", "color": "#0072bc"},
    {"id": "JR-Kobe", "name": "JR神戸線", "color": "#0072bc"},
    {"id": "JR-Kosei", "name": "湖西線", "color": "#e85298"}
  ]
}
```

### GET /api/station-info

茨木駅の詳細情報

**Response (200 OK):**
```json
{
  "code": "0610226",
  "name": "茨木",
  "stop_types": ["普通", "快速", "新快速"],
  "lines": ["JR-Kyoto", "JR-Kosei"]
}
```

### GET /health

ヘルスチェック

**Response (200 OK):**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-22T15:45:30+09:00"
}
```

## バックエンド実装詳細

### 茨木駅フィルタリングロジック

```python
# services/ibaraki_filter.py

IBARAKI_STATION_CODE = "0610226"

def train_passes_through_ibaraki(train, stations_map):
    """
    列車が茨木駅を通過するかチェック

    Args:
        train: 列車データ
        stations_map: 駅順序マップ {code: index}

    Returns:
        bool: 茨木駅を通過する場合True
    """
    position = train.get("pos", "")
    if not position or "_" not in position:
        return False

    codes = position.split("_")
    if not codes or len(codes) < 2:
        return False

    # 列車の現在位置の駅コードを取得
    from_code = codes[0]
    to_code = codes[1]

    # 駅順序インデックスを取得
    from_idx = stations_map.get(from_code)
    to_idx = stations_map.get(to_code)
    ibaraki_idx = stations_map.get(IBARAKI_STATION_CODE)

    if from_idx is None or to_idx is None or ibaraki_idx is None:
        return False

    # 茨木駅がfromとtoの間にあるかチェック
    min_idx = min(from_idx, to_idx)
    max_idx = max(from_idx, to_idx)

    return min_idx <= ibaraki_idx <= max_idx
```

### キャッシュ機構

```python
# services/cache.py

from datetime import datetime, timedelta
from typing import Optional, Any

class MemoryCache:
    def __init__(self, ttl_seconds: int = 30):
        self.cache: dict[str, tuple[Any, datetime]] = {}
        self.ttl = timedelta(seconds=ttl_seconds)

    def get(self, key: str) -> Optional[Any]:
        if key not in self.cache:
            return None

        value, expires_at = self.cache[key]
        if datetime.now() > expires_at:
            del self.cache[key]
            return None

        return value

    def set(self, key: str, value: Any):
        expires_at = datetime.now() + self.ttl
        self.cache[key] = (value, expires_at)

# グローバルキャッシュインスタンス
trains_cache = MemoryCache(ttl_seconds=30)
```

## フロントエンド実装詳細

### 設定管理（localStorage）

```javascript
// assets/js/settings.js

const SETTINGS_KEY = 'ibaraki-tid-settings';

export function loadSettings() {
  const defaults = {
    trainTypes: {
      local: true,      // 普通
      rapid: true,      // 快速
      special_rapid: true,  // 新快速
      limited_express: true // 特急
    },
    alarms: {
      up: { enabled: true, minutes: 5 },
      down: { enabled: true, minutes: 5 }
    },
    tts: {
      enabled: false,
      voice: null
    },
    ui: {
      settingsOpen: true
    }
  };

  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      return { ...defaults, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error('Failed to load settings', e);
  }

  return defaults;
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings', e);
  }
}
```

### 列車種別フィルタUI

```javascript
// assets/js/ui/train-type-filter.js

export function initTrainTypeFilter(settings, onChange) {
  const container = document.getElementById('trainTypeFilter');

  const types = [
    { id: 'local', label: '普通' },
    { id: 'rapid', label: '快速' },
    { id: 'special_rapid', label: '新快速' },
    { id: 'limited_express', label: '特急' }
  ];

  types.forEach(type => {
    const label = document.createElement('label');
    label.style.display = 'flex';
    label.style.alignItems = 'center';
    label.style.gap = '.5rem';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = settings.trainTypes[type.id];
    checkbox.addEventListener('change', () => {
      settings.trainTypes[type.id] = checkbox.checked;
      onChange(settings);
    });

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(type.label));
    container.appendChild(label);
  });
}
```

### APIクライアント

```javascript
// assets/js/api-client.js

const API_BASE = '/api';

export async function fetchTrains() {
  const response = await fetch(`${API_BASE}/trains`, {
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return await response.json();
}

export async function fetchLines() {
  const response = await fetch(`${API_BASE}/lines`);
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return await response.json();
}

// 10秒ごとの自動更新
export function startAutoRefresh(callback) {
  callback(); // 即時実行
  return setInterval(callback, 10000);
}
```

## 開発・デプロイ手順

### 開発環境セットアップ

```bash
# バックエンド
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8001

# フロントエンド（別ターミナル）
cd frontend
python -m http.server 8000
# or
npx serve -p 8000
```

### 本番デプロイ（Nginx）

```nginx
# /etc/nginx/sites-available/tiny-tid

server {
    listen 80;
    server_name ibaraki-tid.example.com;

    # フロントエンド
    root /var/www/tiny-tid/frontend;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    # バックエンドAPI
    location /api/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # 旧バージョン（オプション）
    location /old/ {
        alias /var/www/tiny-tid/frontend/old/;
        try_files $uri $uri/ =404;
    }
}
```

## パフォーマンス最適化

1. **30秒キャッシュ**: サーバー側で全路線データを30秒間キャッシュ
2. **並列データ取得**: `asyncio.gather()`で全路線を並列取得
3. **クライアント側**: 10秒ポーリング、visibilitychange時に即時更新
4. **不要なデータ削減**: 茨木駅通過列車のみ返却

## マイグレーション計画

1. ✅ Ver1コードをfrontend/old/に移動
2. ✅ バックエンド実装（FastAPI + JR西API集約）
3. ✅ フロントエンド実装（茨木駅特化UI）
4. ✅ 統合テスト
5. ✅ 本番デプロイ
6. ✅ Ver1からのリダイレクト設定（オプション）
