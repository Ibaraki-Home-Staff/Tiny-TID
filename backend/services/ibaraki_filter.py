from typing import Dict, List, Any, Optional
import logging

from config import IBARAKI_STATION_CODE

logger = logging.getLogger(__name__)


def build_station_index_map(stations_data: Optional[Dict[str, Any]]) -> Dict[str, int]:
    """駅コードから順序インデックスへのマップを構築"""
    if not stations_data or "stations" not in stations_data:
        return {}

    index_map = {}
    stations = stations_data.get("stations", [])

    for idx, station in enumerate(stations):
        info = station.get("info", {})
        code = info.get("code")
        if code:
            index_map[code] = idx

    return index_map


def train_passes_through_ibaraki(
    train: Dict[str, Any],
    station_index_map: Dict[str, int]
) -> bool:
    """
    列車が茨木駅を通過するかチェック

    Args:
        train: 列車データ
        station_index_map: 駅コード→順序インデックスのマップ

    Returns:
        bool: 茨木駅を通過する場合True
    """
    position = train.get("pos", "")
    if not position or "_" not in position:
        return False

    codes = position.split("_")
    if len(codes) < 2:
        return False

    from_code = codes[0]
    to_code = codes[1]

    # 駅順序インデックスを取得
    from_idx = station_index_map.get(from_code)
    to_idx = station_index_map.get(to_code)
    ibaraki_idx = station_index_map.get(IBARAKI_STATION_CODE)

    if from_idx is None or to_idx is None or ibaraki_idx is None:
        # インデックスが取得できない場合は保守的に含める
        return False

    # 茨木駅がfromとtoの間にあるかチェック（境界含む）
    min_idx = min(from_idx, to_idx)
    max_idx = max(from_idx, to_idx)

    return min_idx <= ibaraki_idx <= max_idx


def filter_ibaraki_trains(
    trains_by_line: Dict[str, Optional[Dict[str, Any]]],
    stations_by_line: Dict[str, Optional[Dict[str, Any]]]
) -> List[Dict[str, Any]]:
    """
    全路線データから茨木駅通過列車のみを抽出

    Args:
        trains_by_line: {line_id: trains_data}
        stations_by_line: {line_id: stations_data}

    Returns:
        茨木駅通過列車のリスト
    """
    ibaraki_trains = []

    for line_id, trains_data in trains_by_line.items():
        if not trains_data:
            continue

        stations_data = stations_by_line.get(line_id)
        if not stations_data:
            logger.warning(f"No station data for {line_id}, skipping")
            continue

        # 駅インデックスマップを構築
        station_index_map = build_station_index_map(stations_data)
        if IBARAKI_STATION_CODE not in station_index_map:
            logger.debug(f"Ibaraki station not in {line_id}, skipping")
            continue

        trains = trains_data.get("trains", [])
        for train in trains:
            if train_passes_through_ibaraki(train, station_index_map):
                # 路線情報を追加
                enhanced_train = {
                    **train,
                    "line_id": line_id,
                    "line_name": trains_data.get("name", line_id),
                }
                ibaraki_trains.append(enhanced_train)

    logger.info(f"Filtered {len(ibaraki_trains)} trains passing through Ibaraki")
    return ibaraki_trains


def determine_direction(train: Dict[str, Any]) -> str:
    """列車の方向を判定（up/down）"""
    direction = train.get("direction")
    if direction == 0 or direction == "0":
        return "up"
    elif direction == 1 or direction == "1":
        return "down"
    return "unknown"


def categorize_train_type(type_label: str) -> str:
    """列車種別をカテゴリに分類"""
    if not type_label:
        return "unknown"

    type_lower = type_label.lower()

    # 特急系
    if any(word in type_lower for word in ["特急", "limited", "express"]):
        return "limited_express"

    # 快速系
    if any(word in type_lower for word in ["快速", "rapid", "新快速"]):
        if "新快速" in type_label or "special" in type_lower:
            return "special_rapid"
        return "rapid"

    # 普通
    if "普通" in type_label or "local" in type_lower:
        return "local"

    return "other"
