import requests
from typing import Dict, Optional
from .models import AreaMaster, StationList

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


def fetch_station_list(line_id: str) -> Optional[StationList]:
    """
    特定路線の駅一覧を取得
    """
    url = f"{BASE_URL}/{line_id}_st.json"

    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        data = response.json()
        return StationList(**data)
    except Exception as e:
        print(f"JR西日本 路線 {line_id} の駅一覧取得失敗: {e}")
        return None


def fetch_all_area_data(area: str) -> Optional[Dict]:
    """
    特定エリアのマスターと全路線の駅一覧を取得
    """
    master = fetch_area_master(area)
    if not master:
        return None

    stations = {}
    for line_id in master.lines.keys():
        station_list = fetch_station_list(line_id)
        if station_list:
            stations[line_id] = station_list
            print(f"  - {area}/{line_id}: {len(station_list.stations)}駅")
        else:
            print(f"  - {area}/{line_id}: 駅一覧取得失敗")

    return {"master": master, "stations": stations}
