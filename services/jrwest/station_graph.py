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
    distance_from_base: int  # 起点駅からの距離（駅数）
    direction_from_base: str  # "upper", "lower", "base"
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
    駅グラフを構築

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
    base_station_idx = base_info["station_index"]
    base_station_data = base_info["station_data"]
    base_line_info = base_info["line_info"]

    lines = []
    processed_lines = set()

    # 対象路線ごとに処理
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
                distance = idx - base_idx_in_line

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
                    code=station.info.code,
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
            # その路線の全駅を取得し、起点駅からは「不明」として扱う
            for idx, station in enumerate(station_list.stations):
                stop_trains = []
                if station.info.stop_trains:
                    from .models import get_stop_train_names

                    stop_trains = get_stop_train_names(station.info.stop_trains)

                node = StationNode(
                    code=station.info.code,
                    name=station.info.name,
                    line_id=line_id,
                    line_name=line_info.name,
                    distance_from_base=None,  # 不明
                    direction_from_base="unknown",
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

    # 接続路線を追加（起点駅の乗換情報から）
    if base_station_data.info.transfer:
        for transfer in base_station_data.info.transfer:
            if transfer.link and transfer.link not in processed_lines:
                # 接続路線のデータを取得
                linked_line_id = transfer.link
                if linked_line_id in area_data.stations:
                    station_list = area_data.stations[linked_line_id]
                    line_info = area_data.master.lines.get(linked_line_id)

                    if station_list and line_info:
                        stations = []
                        for idx, station in enumerate(station_list.stations):
                            stop_trains = []
                            if station.info.stop_trains:
                                from .models import get_stop_train_names

                                stop_trains = get_stop_train_names(
                                    station.info.stop_trains
                                )

                            # 接続駅かどうかを判定
                            is_transfer_station = (
                                station.info.code == transfer.link_code
                            )

                            node = StationNode(
                                code=station.info.code,
                                name=station.info.name,
                                line_id=linked_line_id,
                                line_name=line_info.name,
                                distance_from_base=0 if is_transfer_station else None,
                                direction_from_base="transfer"
                                if is_transfer_station
                                else "unknown",
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
                                line_id=linked_line_id,
                                line_name=line_info.name,
                                line_range=line_info.range,
                                direction={
                                    "upper": line_info.dest.upper,
                                    "lower": line_info.dest.lower,
                                },
                                stations=stations,
                            )
                            lines.append(line_segment)
                            processed_lines.add(linked_line_id)

    return StationGraph(
        base_station={
            "code": base_station_code,
            "name": base_station_data.info.name,
            "line_id": base_line_id,
            "line_name": base_line_info.name if base_line_info else "",
        },
        lines=lines,
    )


def get_train_direction_from_graph(
    train_pos: str, station_graph: StationGraph
) -> Optional[str]:
    """
    列車位置情報から方向（上り/下り）を判定

    Args:
        train_pos: "0415_0416" または "0415_####" 形式
        station_graph: 駅グラフ

    Returns:
        "upper", "lower", "stopped", "unknown"
    """
    if not train_pos:
        return "unknown"

    parts = train_pos.split("_")
    if len(parts) != 2:
        return "unknown"

    station_a, station_b = parts

    # station_aとstation_bの方向を特定
    dir_a = None
    dir_b = None
    dist_a = None
    dist_b = None

    for line in station_graph.lines:
        for station in line.stations:
            if station.code == station_a:
                dir_a = station.direction_from_base
                dist_a = station.distance_from_base
            if station.code == station_b:
                dir_b = station.direction_from_base
                dist_b = station.distance_from_base

    # #### の場合は停車中
    if station_b == "####":
        if dir_a == "base":
            return "stopped"
        return dir_a if dir_a else "unknown"

    # 両方の駅が見つかった場合
    if dir_a and dir_b:
        if dist_a is not None and dist_b is not None:
            # 距離から方向を判定
            if dist_b > dist_a:
                return "lower"  # 起点駅から遠ざかる方向
            elif dist_b < dist_a:
                return "upper"  # 起点駅に近づく方向

        # direction_from_baseから判定
        if dir_a == "upper" and dir_b == "upper":
            return "upper"
        elif dir_a == "lower" and dir_b == "lower":
            return "lower"
        elif dir_a == "base":
            return dir_b
        elif dir_b == "base":
            return dir_a

    return "unknown"
