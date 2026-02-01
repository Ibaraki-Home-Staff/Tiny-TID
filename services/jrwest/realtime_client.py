import requests
from typing import Optional
from .realtime_models import TrainPositionData

BASE_URL = "https://www.train-guide.westjr.co.jp/api/v3"


def fetch_train_positions(line_id: str) -> Optional[TrainPositionData]:
    """
    特定路線のリアルタイム列車位置情報を取得
    """
    url = f"{BASE_URL}/{line_id}.json"

    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        return TrainPositionData(**data)
    except Exception as e:
        print(f"JR西日本 路線 {line_id} のリアルタイムデータ取得失敗: {e}")
        return None
