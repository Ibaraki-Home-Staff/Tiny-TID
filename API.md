# Tiny-TID API 仕様書

## エンドポイント一覧

### 1. 駅列車データ API

#### GET /api/station-trains/

WJRC_STCODEで指定された駅の、WJRC_LINE内の全列車情報をJR西日本リアルタイムデータと駅すぱあと時刻表データを統合して返します。

**リクエスト例:**
```
GET /api/station-trains/
```

**レスポンス仕様:**

| フィールド | 型 | 説明 |
|-----------|-----|------|
| gentime | string | データ生成時刻（ISO 8601形式） |
| version | string | APIバージョン |
| trains | object | 方向別列車データ |
| trains.up | array | 上り列車リスト |
| trains.down | array | 下り列車リスト |

**StationTrain オブジェクト:**

| フィールド | 型 | 説明 |
|-----------|-----|------|
| train_no | string | 列車番号 |
| train_type | string | 列車種別（普通、快速、特急など） |
| nickname | string | 列車愛称 |
| car_count | integer | 両数 |
| destination | string | 行き先駅名 |
| location | string | 現在位置（「駅A → 駅B」形式） |
| scheduled | string | 定刻時刻（HH:MM形式） |
| estimated | string | 予測時刻（HH:MM形式、遅延込み） |
| delay_minutes | integer | 遅延分 |
| pass | boolean | 通過列車かどうか |

**レスポンス例:**
```json
{
  "gentime": "2026-02-01T21:30:00.000000",
  "version": "1.0.0",
  "trains": {
    "up": [
      {
        "train_no": "1234A",
        "train_type": "普通",
        "nickname": "",
        "car_count": 8,
        "destination": "高槻",
        "location": "茨木 → 高槻",
        "scheduled": "18:07",
        "estimated": "18:07",
        "delay_minutes": 0,
        "pass": false
      }
    ],
    "down": [
      {
        "train_no": "5678B",
        "train_type": "快速",
        "nickname": "",
        "car_count": 8,
        "destination": "新大阪",
        "location": "茨木",
        "scheduled": "18:15",
        "estimated": "18:18",
        "delay_minutes": 3,
        "pass": false
      }
    ]
  }
}
```

**エラーレスポンス:**
- `503 Service Unavailable`: 駅列車データが準備中

---

#### GET /api/station-trains/refresh

駅列車データを強制再生成します。リアルタイムデータを即座に取得し、統合データを再生成します。

**リクエスト例:**
```
GET /api/station-trains/refresh
```

**レスポンス:** GET /api/station-trains/ と同じ形式

**エラーレスポンス:**
- `503 Service Unavailable`: 駅列車データの生成に失敗

---

#### GET /api/station-trains/status

駅列車データのステータスを確認します。最終生成時刻、列車件数などの情報を返します。

**リクエスト例:**
```
GET /api/station-trains/status
```

**レスポンス仕様:**

| フィールド | 型 | 説明 |
|-----------|-----|------|
| station_code | string | 駅コード |
| station_name | string | 駅名 |
| line_count | integer | 対象路線数 |
| up_count | integer | 上り列車数 |
| down_count | integer | 下り列車数 |
| generated_at | string | データ生成時刻（ISO 8601形式） |
| last_update | string | 最終更新時刻（ISO 8601形式） |

**レスポンス例:**
```json
{
  "station_code": "0410",
  "station_name": "茨木",
  "line_count": 6,
  "up_count": 20,
  "down_count": 7,
  "generated_at": "2026-02-01T21:30:00",
  "last_update": "2026-02-01T21:30:00"
}
```

**エラーレスポンス:**
- `503 Service Unavailable`: 駅列車データが準備中

---

#### GET /api/station-trains/raw

生のJSONデータを取得します（デバッグ用）。

**リクエスト例:**
```
GET /api/station-trains/raw
```

**レスポンス:** GET /api/station-trains/ と同じ形式（整形なしの生データ）

---

## データの特徴

### 統合データについて

`/api/station-trains/` で返されるデータは、以下の2つのデータソースを統合しています：

1. **JR西日本リアルタイムデータ**
   - 列車の現在位置（pos）
   - 遅延情報
   - 行き先

2. **駅すぱあと時刻表データ**
   - 定刻時刻
   - 停車・通過判定

### フィルタリング

以下の列車は自動的に除外されます：

- **駅グラフに含まれない路線の列車**: WJRC_LINEで指定された路線以外を走行中の列車は「駅{コード}」形式で検出され、除外されます
- **重複列車**: 同じ列車番号の重複は排除されます

### 方向の定義

- **上り（up）**: 起点駅（WJRC_STCODEで指定）に向かう方向
- **下り（down）**: 起点駅から離れる方向

方向は駅グラフの距離情報（distance_from_base）に基づいて判定されます。
