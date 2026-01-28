from typing import Dict, List, Any, Optional
import asyncio
import logging
from datetime import datetime

from config import KINKI_LINES, JR_WEST_AREA, IBARAKI_STATION_CODE
from services.jrwest_client import jrwest_client
from services.ibaraki_filter import filter_ibaraki_trains, determine_direction, categorize_train_type
from services.cache import trains_cache, lines_cache

logger = logging.getLogger(__name__)


async def fetch_kinki_area_master() -> Optional[Dict[str, Any]]:
    """近畿エリアのマスターデータを取得（キャッシュ付き）"""
    cache_key = f"area_master:{JR_WEST_AREA}"
    cached = lines_cache.get(cache_key)
    if cached:
        return cached

    master = await jrwest_client.fetch_area_master(JR_WEST_AREA)
    if master:
        lines_cache.set(cache_key, master)

    return master


async def fetch_all_kinki_lines_data(master: Dict[str, Any]) -> Dict[str, Optional[Dict[str, Any]]]:
    """近畿エリア全路線の位置データを並列取得"""
    lines_info = master.get("lines", {})
    if not lines_info:
        return {}

    async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
        tasks = []
        line_ids_to_fetch = []

        for line_id in KINKI_LINES:
            line_info = lines_info.get(line_id)
            if not line_info:
                logger.warning(f"Line {line_id} not found in master data")
                continue

            pos_url = line_info.get("pos")
            if not pos_url:
                logger.warning(f"No pos URL for line {line_id}")
                continue

            # 相対パスを絶対URLに変換
            if pos_url.startswith("/"):
                url = f"{jrwest_client.base_url.rstrip('/')}{pos_url}"
            elif pos_url.startswith("http"):
                url = pos_url
            else:
                url = f"{jrwest_client.base_url}{pos_url}"

            line_ids_to_fetch.append(line_id)
            tasks.append(client.get(url))

        if not tasks:
            return {}

        responses = await asyncio.gather(*tasks, return_exceptions=True)

        results = {}
        for line_id, response in zip(line_ids_to_fetch, responses):
            if isinstance(response, Exception):
                logger.error(f"Failed to fetch {line_id}: {response}")
                results[line_id] = None
            elif isinstance(response, httpx.Response):
                try:
                    response.raise_for_status()
                    results[line_id] = response.json()
                except Exception as e:
                    logger.error(f"Failed to parse {line_id}: {e}")
                    results[line_id] = None
            else:
                results[line_id] = None

        return results


async def fetch_all_kinki_stations_data(
    master: Dict[str, Any]
) -> Dict[str, Optional[Dict[str, Any]]]:
    """全路線の駅データを並列取得"""
    lines_info = master.get("lines", {})
    if not lines_info:
        return {}

    tasks = []
    line_ids = []

    for line_id in KINKI_LINES:
        line_info = lines_info.get(line_id)
        if not line_info:
            continue

        st_url = line_info.get("st")
        if st_url:
            line_ids.append(line_id)
            tasks.append(jrwest_client.fetch_line_stations(line_id, st_url))

    if not tasks:
        return {}

    results_list = await asyncio.gather(*tasks, return_exceptions=True)

    results = {}
    for line_id, result in zip(line_ids, results_list):
        if isinstance(result, Exception):
            logger.error(f"Failed to fetch stations for {line_id}: {result}")
            results[line_id] = None
        else:
            results[line_id] = result

    return results


async def aggregate_ibaraki_trains() -> Dict[str, Any]:
    """
    茨木駅通過列車を集約

    Returns:
        {
            "station_code": "0610226",
            "station_name": "茨木",
            "updated_at": "ISO8601",
            "trains": [...]
        }
    """
    cache_key = "ibaraki_trains"
    cached = trains_cache.get(cache_key)
    if cached:
        logger.debug("Returning cached trains data")
        return cached

    logger.info("Fetching fresh trains data for Ibaraki")

    # 1. エリアマスター取得
    master = await fetch_kinki_area_master()
    if not master:
        logger.error("Failed to fetch area master")
        return create_empty_response()

    # 2. 全路線の列車位置データを並列取得
    trains_by_line = await fetch_all_kinki_lines_data(master)

    # 3. 全路線の駅データを並列取得
    stations_by_line = await fetch_all_kinki_stations_data(master)

    # 4. 茨木駅通過列車をフィルタリング
    ibaraki_trains = filter_ibaraki_trains(trains_by_line, stations_by_line)

    # 5. 列車データを整形
    formatted_trains = []
    for train in ibaraki_trains:
        formatted = format_train_data(train, stations_by_line.get(train["line_id"]))
        if formatted:
            formatted_trains.append(formatted)

    # 6. 更新時刻を取得（最新のものを使用）
    updated_at = extract_latest_update_time(trains_by_line)

    response = {
        "station_code": IBARAKI_STATION_CODE,
        "station_name": "茨木",
        "updated_at": updated_at.isoformat() if updated_at else datetime.now().isoformat(),
        "trains": formatted_trains,
    }

    # キャッシュに保存
    trains_cache.set(cache_key, response)

    return response


def format_train_data(
    train: Dict[str, Any],
    stations_data: Optional[Dict[str, Any]]
) -> Optional[Dict[str, Any]]:
    """列車データを整形"""
    try:
        type_label = train.get("type", train.get("displayType", ""))

        return {
            "id": f"{train['line_id']}:{train.get('no', 'unknown')}",
            "line_id": train["line_id"],
            "line_name": train.get("line_name", train["line_id"]),
            "number": train.get("no", ""),
            "type": type_label,
            "type_category": categorize_train_type(type_label),
            "destination": train.get("dest", {}).get("text", ""),
            "direction": determine_direction(train),
            "position": format_position(train, stations_data),
            "delay_minutes": train.get("delayMinutes", 0),
            "cars": train.get("numberOfCars"),
            "stops_at_ibaraki": determine_if_stops_at_ibaraki(train, type_label),
        }
    except Exception as e:
        logger.error(f"Failed to format train: {e}")
        return None


def format_position(
    train: Dict[str, Any],
    stations_data: Optional[Dict[str, Any]]
) -> Dict[str, Any]:
    """列車位置を整形"""
    pos = train.get("pos", "")
    if not pos or "_" not in pos:
        return {"current": "", "from_station_code": None, "to_station_code": None}

    codes = pos.split("_")
    from_code = codes[0] if len(codes) > 0 else None
    to_code = codes[1] if len(codes) > 1 else None

    # 駅名を取得
    from_name = get_station_name(from_code, stations_data)
    to_name = get_station_name(to_code, stations_data)

    current_text = ""
    if from_name and to_name:
        current_text = f"{from_name} → {to_name}"
    elif from_name:
        current_text = from_name
    elif to_name:
        current_text = to_name

    return {
        "current": current_text,
        "from_station_code": from_code,
        "to_station_code": to_code,
    }


def get_station_name(code: Optional[str], stations_data: Optional[Dict[str, Any]]) -> str:
    """駅コードから駅名を取得"""
    if not code or not stations_data:
        return ""

    stations = stations_data.get("stations", [])
    for station in stations:
        info = station.get("info", {})
        if info.get("code") == code:
            name = info.get("name", "")
            # 「駅」を除去
            return name.replace("駅", "").strip()

    return ""


def determine_if_stops_at_ibaraki(train: Dict[str, Any], type_label: str) -> bool:
    """茨木駅に停車するか判定（簡易版）"""
    # TODO: 駅の停車列車種別データから正確に判定
    # 現時点では種別から推測
    type_category = categorize_train_type(type_label)

    # 普通・快速・新快速は停車、特急は通過と仮定
    return type_category in ["local", "rapid", "special_rapid"]


def extract_latest_update_time(
    trains_by_line: Dict[str, Optional[Dict[str, Any]]]
) -> Optional[datetime]:
    """最新の更新時刻を抽出"""
    latest = None

    for trains_data in trains_by_line.values():
        if not trains_data:
            continue

        update_str = trains_data.get("update") or trains_data.get("timestamp")
        if not update_str:
            continue

        try:
            dt = datetime.fromisoformat(update_str.replace("Z", "+00:00"))
            if latest is None or dt > latest:
                latest = dt
        except Exception:
            pass

    return latest


def create_empty_response() -> Dict[str, Any]:
    """空のレスポンスを作成"""
    return {
        "station_code": IBARAKI_STATION_CODE,
        "station_name": "茨木",
        "updated_at": datetime.now().isoformat(),
        "trains": [],
    }


# httpx のインポートを追加
import httpx
