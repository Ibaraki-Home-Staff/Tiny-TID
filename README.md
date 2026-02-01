# Tiny-TID

駅すぱあとAPIおよびJR西日本列車位置情報APIを利用して、鉄道時刻表とリアルタイム列車位置情報を取得・提供するFastAPIアプリケーションです。

## データ取得元

### 1. 駅すぱあとAPI（時刻表データ）
- **ベースURL**: `https://api.ekispert.jp/v1/`
- **提供元**: 株式会社ヴァル研究所（Ekispert）
- **取得データ**:
  - 駅時刻表（方面別）
  - 列車詳細情報（停車駅、運行状況など）
  - 駅検索（駅コード解決）
- **エンドポイント例**:
  - 時刻表取得: `/json/search/station/timetable`
  - 駅検索: `/json/station/light`

### 2. JR西日本列車位置情報API（リアルタイムデータ）
- **ベースURL**: `https://www.train-guide.westjr.co.jp/api/v3/`
- **提供元**: 西日本旅客鉄道株式会社（JR西日本）
- **取得データ**:
  - 列車リアルタイム位置情報
  - 遅延・運行情報
  - 駅一覧、路線マスターデータ
- **対応エリア**: 北陸・近畿・岡山・広島・山陰

## リアルタイムデータ仕様

### 列車位置情報（posフィールド）

列車の現在位置は`pos`フィールドで示されます。

#### フォーマット
```
{駅コードA}_{駅コードB}
```

#### 値の意味
- **`0415_0416`**: 駅コード"0415"と"0416"の区間を走行中
  - 例：新大阪（0415）〜大阪（0416）間を走行中
- **`0415_####`**: 駅コード"0415"の構内を走行中または停車中
  - `####`は特殊値で、該当駅構内にいることを示す
  - 停車中か走行中かは別フィールドで判定

#### 使用例
```json
{
  "trains": [
    {
      "pos": "0415_0416",
      "direction": "down",
      "delay": 0
    }
  ]
}
```

### 駅コード体系
- **駅すぱあと**: 数値コード（例：25834）
- **JR西日本**: 4桁数字コード（例：0415 = 新大阪）
- **対応付け**: 両システム間で駅コードの相互変換は行わず、独立して管理

## 機能

- **自動時刻表取得**: 毎日午前3:21に駅すぱあとAPIから時刻表を自動取得
- **祝日判定**: `jpholiday`ライブラリを使用して祝日を自動判定
- **インメモリキャッシュ**: 取得した時刻表を当日中キャッシュし、高速レスポンスを実現
- **dateGroup自動判定**: 平日/土曜/日祝日を自動的に判定し、適切な時刻表を取得

## セットアップ

### 1. 依存パッケージのインストール

```bash
# uvを使用する場合
uv pip install -e .

# pipを使用する場合
pip install -e .
```

### 2. 環境変数の設定

`.env`ファイルが存在しない場合、初回起動時にウィザードが自動的に起動し、対話式で設定を行います。

手動で作成する場合:
```bash
cp .env.example .env
```

`.env`ファイルの設定項目:
```env
# 駅すぱあとAPI設定
EKISPERT_API_KEY=your_api_key_here
STATION_CODE=25834

# キャッシュ設定
CACHE_DIR=./cache

# JR西日本リアルタイム設定
WJRC_AREA=kinki
WJRC_LINE=kyoto,hokurikubiwako,kosei,kobesanyo
WJRC_STCODE=1715
WJRC_POLLING_INTERVAL=10
WJRC_LINE_INTERVAL=2.0
```

#### 設定項目の説明
- **EKISPERT_API_KEY**: 駅すぱあとAPIのアクセスキー
- **STATION_CODE**: 駅すぱあとでの駅コード（デフォルト: 茨木駅）
- **WJRC_AREA**: JR西日本エリア（kinki, hokuriku, okayama, hiroshima, sanin）
- **WJRC_LINE**: 監視対象路線（カンマ区切り）
- **WJRC_STCODE**: リアルタイムデータ取得対象のJR西日本駅コード
- **WJRC_POLLING_INTERVAL**: 全路線更新間隔（秒）
- **WJRC_LINE_INTERVAL**: 各路線API呼び出し間隔（秒）

### 3. サーバー起動

```bash
# 開発モード
uvicorn main:app --reload

# 本番モード
uvicorn main:app --host 0.0.0.0 --port 8000
```

初回起動時は自動的に設定ウィザードが起動します。

## APIエンドポイント

### 駅すぱあと時刻表API

駅すぱあとAPIから取得した時刻表データを提供します。

#### 方面一覧の取得
```
GET /timetable/
```
**レスポンス**: 方面コードと方面名の一覧

#### 特定方面の詳細時刻表取得
```
GET /timetable/detail/{code}
```
**パラメータ**:
- `code`: 方面コード（方面一覧取得時に返される`code`値）

**レスポンス**: 指定方面の全列車時刻表

#### 特定列車の詳細情報取得
```
GET /timetable/train/{train_id}
```
**パラメータ**:
- `train_id`: 列車ID（時刻表詳細に含まれる`trainId`）

#### キャッシュ状態の確認
```
GET /timetable/status
```
**レスポンス**: キャッシュの有無、最終更新日時など

### JR西日本時刻表API

JR西日本が提供する路線・駅のマスターデータを提供します。

#### 全エリアの路線・駅データ取得
```
GET /jrwest/
```

#### 特定エリアの詳細データ取得
```
GET /jrwest/{area}
```
**パラメータ**:
- `area`: エリアコード（kinki, hokuriku, okayama, hiroshima, sanin）

#### 駅コードで駅を検索（全エリア）
```
GET /jrwest/station/{station_code}
```
**パラメータ**:
- `station_code`: JR西日本駅コード（4桁数字）

#### エリア内で駅を検索
```
GET /jrwest/{area}/station/{station_code}
```

### JR西日本リアルタイムAPI

列車のリアルタイム位置情報と運行状況を提供します。

#### 全路線のリアルタイム情報取得
```
GET /jrwest/realtime/
```
**レスポンス**: 設定された全路線の列車位置情報

#### 特定路線のリアルタイム情報取得
```
GET /jrwest/realtime/{line}
```
**パラメータ**:
- `line`: 路線ID（例：kyoto, kosei, kobesanyo）

**レスポンス例**:
```json
{
  "line": "kyoto",
  "trains": [
    {
      "pos": "0415_0416",
      "direction": "down",
      "delay": 0,
      "display": "普通",
      "dest": "高槻"
    }
  ]
}
```

#### リアルタイムデータキャッシュ状態確認
```
GET /jrwest/realtime/status
```

## データ取得スケジュール

### 駅すぱあと時刻表
- **実行時間**: 毎日午前3:21
- **対象駅**: `.env`で設定された駅（デフォルト: 茨木駅、駅コード: 25834）
- **取得元**: 駅すぱあとAPI `/json/search/station/timetable`
- **dateGroup判定**:
  - 平日 → `weekday`
  - 土曜 → `saturday`
  - 日曜・祝日 → `holiday`
- **キャッシュ**: 取得した時刻表は当日中キャッシュ（日付変更時に自動更新）

### JR西日本リアルタイムデータ
- **実行間隔**: `.env`で設定（デフォルト: 10秒ごと）
- **対象路線**: `.env`の`WJRC_LINE`で指定
- **取得元**: JR西日本API `/api/v3/{line_id}.json`
- **データ内容**: 列車位置、遅延時間、運行種別、行先など
- **レート制限**: 各路線取得間に待機時間を設ける（デフォルト: 2秒）

## アーキテクチャ

```
┌─────────────────┐
│   FastAPI App   │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼────┐
│routers│ │services│
└───┬───┘ └──┬────┘
    │        │
┌───▼────────▼────┐
│  外部APIクライアント  │
│  ・駅すぱあとAPI    │
│  ・JR西日本API     │
└─────────────────┘
```

### 主要モジュール
- **routers/**: APIエンドポイント定義
  - `timetable.py`: 駅すぱあと時刻表API
  - `jrwest.py`: JR西日本マスターデータAPI
  - `jrwest_realtime.py`: JR西日本リアルタイムAPI
- **services/**: ビジネスロジック・外部API連携
  - `ekispert.py`: 駅すぱあとAPIクライアント
  - `jrwest/`: JR西日本関連モジュール
  - `scheduler.py`: 定期実行スケジューラ
- **wizard.py**: 初期設定ウィザード（.env生成）

## 技術スタック

### フレームワーク・ライブラリ
- **FastAPI**: Webフレームワーク（API提供）
- **APScheduler**: スケジューリング（時刻表定期取得）
- **Pydantic**: データバリデーション
- **pydantic-settings**: 設定管理（.env対応）

### データ取得・処理
- **requests**: HTTPクライアント（外部API連携）
- **jpholiday**: 日本の祝日判定

### 開発ツール
- **uv**: Pythonパッケージ管理
- **ruff**: リンター・フォーマッター

## 注意事項

### APIキー管理
- 駅すぱあとAPIキーは`.env`ファイルに保存し、Git管理対象外にしてください
- `.env.example`はテンプレートとして提供されています

### レート制限対策
- JR西日本APIは過剰なアクセスを避けるため、各路線間に待機時間を設けています
- `WJRC_LINE_INTERVAL`で間隔を調整可能です（デフォルト: 2.0秒）

### 駅コードの扱い
- **駅すぱあと**: 数値コード（例：25834）
- **JR西日本**: 4桁数字コード（例：0415）
- 両システムでコード体系が異なるため、混同しないように注意してください
