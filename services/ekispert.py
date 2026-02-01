import requests
from typing import Optional, List, Dict, Any
from config import get_settings

settings = get_settings()

BASE_URL = "https://api.ekispert.jp/v1/json/operationLine/timetable"


def get_date_group(date_str: str) -> str:
    import jpholiday
    from datetime import datetime

    date = datetime.strptime(date_str, "%Y%m%d")
    weekday = date.weekday()

    # 日曜日(6)または祝日の場合はholiday
    if weekday == 6 or jpholiday.is_holiday(date):
        return "holiday"
    # 土曜日(5)の場合はsaturday
    elif weekday == 5:
        return "saturday"
    # それ以外は平日
    else:
        return "weekday"


def fetch_timetable_directions(station_code: int, date: str) -> List[Dict[str, Any]]:
    """
    駅の方面別一覧を取得
    """
    settings = get_settings()
    date_group = get_date_group(date)

    params = {
        "key": settings.ekispert_api_key,
        "stationCode": station_code,
        "date": date,
        "dateGroup": date_group,
    }

    response = requests.get(BASE_URL, params=params)
    response.raise_for_status()
    data = response.json()

    # 結果がリストか単一オブジェクトかを判定
    time_tables = data["ResultSet"]["TimeTable"]
    if isinstance(time_tables, list):
        return time_tables
    else:
        return [time_tables]


def fetch_timetable_detail(station_code: int, date: str, code: str) -> Dict[str, Any]:
    """
    特定の方面の詳細時刻表を取得
    """
    settings = get_settings()
    date_group = get_date_group(date)

    params = {
        "key": settings.ekispert_api_key,
        "stationCode": station_code,
        "date": date,
        "dateGroup": date_group,
        "code": code,
    }

    response = requests.get(BASE_URL, params=params)
    response.raise_for_status()
    data = response.json()

    return data["ResultSet"]["TimeTable"]
