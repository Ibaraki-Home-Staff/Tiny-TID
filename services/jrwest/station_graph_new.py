"""
駅グラフ生成モジュール
WJRC_STCODE（起点駅）を中心に、接続路線と駅の方向関係を解析
"""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from . import cache


@dataclass
class StationNode:
    """駅ノード"""

    code: str
    name: str
    line_id: str
    line_name: str
    distance_from_base: Optional[int]  # 起点駅からの距離（駅数）
    direction_from_base: str  # "upper", "lower", "base", "transfer", "unknown"
    is_base_station: bool = False
    transfers: List[Dict[str, Any]] = field(default_factory=list)
    stop_trains: List[str] = field(default_factory=list)


@dataclass
class LineSegment:
    """路線セグメント"""

    line_id: str
    line_name: str
    line_range: str
    direction: Dict[str, str]  # {"upper": "終点名", "lower": "終点名"}
    stations: List[StationNode]


@dataclass
class StationGraph:
    """駅グラフ全体"""

    base_station: Dict[str, Any]
    lines: List[LineSegment]


def find_station_in_target_lines(
    station_code: str, area: str, target_line_ids: List[str]
) -> Optional[Dict[str, Any]]:
    """
    指定された路線上で駅を検索（優先順位付き）
    1. 指定路線上を検索
    2. 見つからない場合はエア全体を検索

    Returns: {"line_id": str, "station_index": int, "station_data": Station}
    """
    area_data = cache.get_area(area)
    if not area_data:
        return None

    # まず指定路線上から検索
    for line_id in target_line_ids:
        station_list = area_data.stations.get(line_id)
        if not station_list:
            continue
        for idx, station in enumerate(station_list.stations):
            if station.info.code == station_code:
                return {
                    "line_id": line_id,
                    "station_index": idx,
                    "station_data": station,
                    "line_info": area_data.master.lines.get(line_id),
                }

    # 指定路線上にない場合はエア全体を検索（フォールバック）
    for line_id, station_list in area_data.stations.items():
        for idx, station in enumerate(station_list.stations):
            if station.info.code == station_code:
                return {
                    "line_id": line_id,
                    "station_index": idx,
                    "station_data": station,
                    "line_info": area_data.master.lines.get(line_id),
                }
    return None


def build_station_graph(
    base_station_code: str, target_line_ids: List[str], area: str
) -> Optional[StationGraph]:
    """
    駅グラフを構築（同一駅結合版）

    複数路線にまたがる同一駅（同じコード・同じ名前）は結合され、
    距離値が統一されます。

    Args:
        base_station_code: 起点駅コード（WJRC_STCODE）
        target_line_ids: 対象路線IDリスト（WJRC_LINE）
        area: エリアコード

    Returns:
        StationGraphオブジェクト
    """
    area_data = cache.get_area(area)
    if not area_data:
        return None

    # 起点駅を検索（指定路線上を優先）
    base_info = find_station_in_target_lines(base_station_code, area, target_line_ids)
    if not base_info:
        return None

    base_line_id = base_info["line_id"]
    base_station_data = base_info["station_data"]
    base_line_info = base_info["line_info"]

    # 第一段階：全路線の駅データを収集し、同一駅を検出
    # station_code -> 距離値のマッピング（最初に見つかった距離を使用）
    station_distance_registry: Dict[str, int] = {}

    for line_id in target_line_ids:
        station_list = area_data.stations.get(line_id)
        if not station_list:
            continue

        # この路線上での起点駅の位置を特定
        base_idx_in_line = None
        for idx, station in enumerate(station_list.stations):
            if station.info.code == base_station_code:
                base_idx_in_line = idx
                break

        if base_idx_in_line is not None:
            # 起点駅が見つかった場合、距離を計算して登録
            for idx, station in enumerate(station_list.stations):
                distance = idx - base_idx_in_line
                code = station.info.code

                if code not in station_distance_registry:
                    # 初めて見つかった駅は登録
                    station_distance_registry[code] = distance

    # 第二段階：統一された距離値を使用して駅グラフを構築
    lines = []
    processed_lines = set()

    for line_id in target_line_ids:
        if line_id in processed_lines:
            continue

        station_list = area_data.stations.get(line_id)
        line_info = area_data.master.lines.get(line_id)

        if not station_list or not line_info:
            continue

        # 起点駅がこの路線上にあるか確認
        base_idx_in_line = None
        for idx, station in enumerate(station_list.stations):
            if station.info.code == base_station_code:
                base_idx_in_line = idx
                break

        stations = []

        if base_idx_in_line is not None:
            # 起点駅がこの路線上にある場合
            for idx, station in enumerate(station_list.stations):
                code = station.info.code

                # 統一された距離値を使用
                distance = station_distance_registry.get(code, idx - base_idx_in_line)

                if distance < 0:
                    direction = "upper"
                elif distance > 0:
                    direction = "lower"
                else:
                    direction = "base"

                # 停車列車種別を取得
                stop_trains = []
                if station.info.stop_trains:
                    from .models import get_stop_train_names

                    stop_trains = get_stop_train_names(station.info.stop_trains)

                node = StationNode(
                    code=code,
                    name=station.info.name,
                    line_id=line_id,
                    line_name=line_info.name,
                    distance_from_base=distance,
                    direction_from_base=direction,
                    is_base_station=(distance == 0),
                    transfers=[
                        {
                            "name": t.name,
                            "code": t.code,
                            "link": t.link,
                            "link_code": t.link_code,
                        }
                        for t in (station.info.transfer or [])
                    ],
                    stop_trains=stop_trains,
                )
                stations.append(node)
        else:
            # 起点駅がこの路線上にない場合（接続路線など）
            # 接続駅を探す
            transfer_station_idx = None
            transfer_station_distance = None

            for idx, station in enumerate(station_list.stations):
                code = station.info.code
                # 統一距離レジストリに存在する駅を接続駅として使用
                if code in station_distance_registry:
                    transfer_station_idx = idx
                    transfer_station_distance = station_distance_registry[code]
                    break

            # 各駅の距離を計算
            for idx, station in enumerate(station_list.stations):
                code = station.info.code
                stop_trains = []
                if station.info.stop_trains:
                    from .models import get_stop_train_names

                    stop_trains = get_stop_train_names(station.info.stop_trains)

                # 距離計算
                if code in station_distance_registry:
                    # 統一距離値レジストリに存在する場合はそれを使用
                    distance = station_distance_registry[code]
                    if distance < 0:
                        direction = "upper"
                    elif distance > 0:
                        direction = "lower"
                    else:
                        direction = "base"
                elif (
                    transfer_station_idx is not None
                    and transfer_station_distance is not None
                ):
                    # 接続駅からの相対距離を計算
                    relative_distance = idx - transfer_station_idx
                    distance = transfer_station_distance + relative_distance

                    if distance < 0:
                        direction = "upper"
                    elif distance > 0:
                        direction = "lower"
                    else:
                        direction = "transfer"
                else:
                    # 接続駅が見つからない場合は不明
                    distance = None
                    direction = "unknown"

                node = StationNode(
                    code=code,
                    name=station.info.name,
                    line_id=line_id,
                    line_name=line_info.name,
                    distance_from_base=distance,
                    direction_from_base=direction,
                    is_base_station=False,
                    transfers=[
                        {
                            "name": t.name,
                            "code": t.code,
                            "link": t.link,
                            "link_code": t.link_code,
                        }
                        for t in (station.info.transfer or [])
                    ],
                    stop_trains=stop_trains,
                )
                stations.append(node)

        if stations:
            line_segment = LineSegment(
                line_id=line_id,
                line_name=line_info.name,
                line_range=line_info.range,
                direction={
                    "upper": line_info.dest.upper,
                    "lower": line_info.dest.lower,
                },
                stations=stations,
            )
            lines.append(line_segment)
            processed_lines.add(line_id)

    return StationGraph(
        base_station={
            "code": base_station_code,
            "name": base_station_data.info.name,
            "line_id": base_line_id,
            "line_name": base_line_info.name if base_line_info else "",
        },
        lines=lines,
    )
