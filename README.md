# Tiny-TID

駅すぱあとAPIを利用して、茨木駅の時刻表データを取得・提供するFastAPIアプリケーションです。

## 機能

- **自動時刻表取得**: 毎日午前3:21に駅すぱあとAPIから時刻表を自動取得
- **祝日判定**: `jpholiday`ライブラリを使用して祝日を自動判定
- **インメモリキャッシュ**: 取得した時刻表を当日中キャッシュし、高速レスポンスを実現
- **dateGroup自動判定**: 平日/土曜/日祝日を自動的に判定し、適切な時刻表を取得

## セットアップ

### 1. 環境変数の設定

`.env`ファイルを作成し、駅すぱあとAPIのアクセスキーを設定してください。

```bash
cp .env.example .env
```

`.env`ファイルを編集:
```
EKISPERT_API_KEY=your_api_key_here
```

### 2. サーバー起動

```bash
uvicorn main:app --reload
```

## APIエンドポイント

### 時刻表方面一覧の取得
```
GET /timetable/
```

### 特定方面の詳細時刻表取得
```
GET /timetable/detail/{code}
```

- `code`: 方面コード（方面一覧取得時に返される`code`値）

### キャッシュ状態の確認
```
GET /timetable/status
```

## 時刻表取得スケジュール

- **実行時間**: 毎日午前3:21
- **対象駅**: 茨木駅（駅コード: 25834）
- **dateGroup判定**:
  - 平日 → `weekday`
  - 土曜 → `saturday`
  - 日曜・祝日 → `holiday`

## 技術スタック

- FastAPI
- APScheduler（スケジューリング）
- jpholiday（祝日判定）
- pydantic-settings（設定管理）
- python-dotenv（環境変数読み込み）
