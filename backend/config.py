# 茨木駅特化設定

# 茨木駅コード
IBARAKI_STATION_CODE = "0610226"
IBARAKI_STATION_NAME = "茨木"

# JR西日本API設定
JR_WEST_API_BASE = "https://www.train-guide.westjr.co.jp/api/v3/"
JR_WEST_AREA = "kinki"  # 近畿エリア

# キャッシュ設定
CACHE_TTL_SECONDS = 30  # 30秒キャッシュ

# 近畿エリアの路線リスト（茨木駅を通過する可能性がある路線）
# 注: APIの路線IDは小文字でハイフンなし
KINKI_LINES = [
    "kyoto",         # JR京都線
    "kobesanyo",     # JR神戸線・山陽線
    "kosei",         # 湖西線
    "hokurikubiwako", # 北陸線・琵琶湖線
    "osakaloop",     # 大阪環状線
]

# CORS設定
CORS_ORIGINS = [
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    # 本番環境のオリジンを追加
]
