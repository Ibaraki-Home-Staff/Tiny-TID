import requests
from typing import Dict, Optional
from .models import AreaMaster

BASE_URL = "https://www.train-guide.westjr.co.jp/api/v3"

AREAS = ["kinki", "hokuriku", "okayama", "hiroshima", "sanin"]


def fetch_area_master(area: str) -> Optional[AreaMaster]:
    """
    特定エリアのマスターデータを取得
    """
    url = f"{BASE_URL}/area_{area}_master.json"

    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        data = response.json()
        return AreaMaster(**data)
    except Exception as e:
        print(f"JR西日本 {area} エリアデータ取得失敗: {e}")
        return None


def fetch_all_areas() -> Dict[str, AreaMaster]:
    """
    全エリアのマスターデータを取得
    """
    areas_data = {}

    for area in AREAS:
        master = fetch_area_master(area)
        if master:
            areas_data[area] = master
            print(f"  - JR西日本 {area} エリアデータ取得成功")
        else:
            print(f"  - JR西日本 {area} エリアデータ取得スキップ")

    return areas_data
