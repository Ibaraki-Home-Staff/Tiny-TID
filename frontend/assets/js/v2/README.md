# Tiny-TID v2 Frontend Modules

茨木駅特化版フロントエンド実装

## モジュール構成

### init.js
- メインエントリーポイント
- アプリケーション初期化
- ポーリング制御（10秒間隔）
- UIイベントハンドラ設定

### api-client.js
- FastAPIバックエンドとの通信
- エンドポイント:
  - `GET /api/trains` - 茨木駅通過列車一覧
  - `GET /api/lines` - 茨木駅通過路線一覧
  - `GET /api/station-info` - 茨木駅情報
  - `GET /health` - ヘルスチェック

### settings.js
- localStorage設定管理
- 設定項目:
  - フィルタ設定（列車種別）
  - アラーム設定（方向別・種別別）
  - 音声設定（アンロック状態）
  - UI設定（パネル開閉状態）

### alarm.js
- 接近アラーム制御
- アラームトリガー判定
- 重複通知抑制（3分間）
- モーダル表示制御

### audio.js
- 音声再生制御
- iOS対応アンロック処理
- アラーム音再生（alarm.mp3）

### render.js
- UI描画処理
- 列車カード生成
- 方向別グループ化表示
- タイムスタンプ更新

## データフロー

```
1. init.js がアプリ起動
   ↓
2. api-client.js でバックエンドからデータ取得
   ↓
3. alarm.js でアラーム判定
   ↓
4. audio.js で音声再生
   ↓
5. render.js で画面描画
   ↓
6. 10秒後に2に戻る（ポーリング）
```

## Ver1からの主な変更点

- **駅選択削除**: 茨木駅固定
- **サーバー統合**: バックエンドで全路線データ集約
- **ポーリング**: 30秒 → 10秒に変更
- **設定簡素化**: localStorage のみ使用（DB不要）
- **アラーム**: 接近アラームのみに特化

## 設定ストレージ構造

```json
{
  "filters": {
    "trainTypes": {
      "local": true,
      "rapid": true,
      "special_rapid": true,
      "limited_express": true
    }
  },
  "alarms": {
    "up": {
      "enabled": false,
      "types": {
        "local": false,
        "rapid": false,
        "special_rapid": false,
        "limited_express": false
      }
    },
    "down": {
      "enabled": false,
      "types": {
        "local": false,
        "rapid": false,
        "special_rapid": false,
        "limited_express": false
      }
    }
  },
  "audio": {
    "unlocked": false
  },
  "ui": {
    "alarmSettingsOpen": false
  }
}
```

## 開発時の注意点

1. **CORS**: 開発時は `backend` を起動してから `frontend` にアクセス
2. **音声再生**: iOS Safariではユーザー操作が必要（音声アンロック機能実装済み）
3. **ポーリング**: ページを開いたままにすると10秒ごとにAPIリクエスト
4. **localStorage**: ブラウザのプライベートモードでは設定が保存されない
