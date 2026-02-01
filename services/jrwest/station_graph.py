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
            # この路線と「起点駅の路線」または「既に処理済みの路線」の接続駅を探す
            # 1. まず接続駅を探す
            transfer_station_idx = None
            transfer_station_distance = None
            connected_line_id = None

            for idx, station in enumerate(station_list.stations):
                # この駅が他の路線と接続しているか確認
                if station.info.transfer:
                    for transfer in station.info.transfer:
                        # 起点駅の路線または既に処理済みの路線と接続しているか
                        if (
                            transfer.link == base_line_id
                            or transfer.link in processed_lines
                        ):
                            # この路線が接続している
                            transfer_station_idx = idx
                            connected_line_id = transfer.link
                            # 接続駅のdistance_from_baseを取得（接続先の路線上の駅として）
                            for line in lines:
                                if line.line_id == transfer.link:
                                    for s in line.stations:
                                        if s.code == station.info.code:
                                            transfer_station_distance = (
                                                s.distance_from_base
                                            )
                                            break
                                if transfer_station_distance is not None:
                                    break
                            break
                    if transfer_station_idx is not None:
                        break

            # 2. 各駅の距離を計算
            for idx, station in enumerate(station_list.stations):
                stop_trains = []
                if station.info.stop_trains:
                    from .models import get_stop_train_names

                    stop_trains = get_stop_train_names(station.info.stop_trains)

                # 距離計算
                if (
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
                    code=station.info.code,
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


def build_station_graph_multi_area(
    base_station_code: str, target_line_ids: List[str], areas: List[str]
) -> Optional[StationGraph]:
    """
    複数エリア対応の駅グラフを構築

    Args:
        base_station_code: 起点駅コード（WJRC_STCODE）
        target_line_ids: 対象路線IDリスト（WJRC_LINE）
        areas: エリアコードリスト（複数指定可能）

    Returns:
        StationGraphオブジェクト
    """
    if not areas:
        return None

    # 単一エリアの場合は既存関数を使用
    if len(areas) == 1:
        return build_station_graph(base_station_code, target_line_ids, areas[0])

    # 複数エリアのデータを統合
    from .models import AreaData

    all_area_data = {}
    for area in areas:
        area_data = cache.get_area(area)
        if area_data:
            all_area_data[area] = area_data

    if not all_area_data:
        return None

    # 起点駅を検索（全エリアから）
    base_info = None
    base_area = None
    base_line_id = None

    for area, area_data in all_area_data.items():
        for line_id in target_line_ids:
            station_list = area_data.stations.get(line_id)
            if not station_list:
                continue
            for idx, station in enumerate(station_list.stations):
                if station.info.code == base_station_code:
                    base_info = {
                        "line_id": line_id,
                        "station_index": idx,
                        "station_data": station,
                        "line_info": area_data.master.lines.get(line_id),
                    }
                    base_area = area
                    base_line_id = line_id
                    break
            if base_info:
                break
        if base_info:
            break

    if not base_info:
        return None

    base_station_idx = base_info["station_index"]
    base_station_data = base_info["station_data"]
    base_line_info = base_info["line_info"]

    lines = []
    processed_lines = set()

    # 対象路線ごとに処理（全エリアから検索）
    for line_id in target_line_ids:
        if line_id in processed_lines:
            continue

        # 路線が存在するエリアを探す
        line_area_data = None
        for area, area_data in all_area_data.items():
            if line_id in area_data.stations:
                line_area_data = area_data
                break

        if not line_area_data:
            continue

        station_list = line_area_data.stations.get(line_id)
        line_info = line_area_data.master.lines.get(line_id)

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
            # この路線と「起点駅の路線」または「既に処理済みの路線」の接続駅を探す
            # 1. まず接続駅を探す
            transfer_station_idx = None
            transfer_station_distance = None
            connected_line_id = None

            for idx, station in enumerate(station_list.stations):
                # この駅が他の路線と接続しているか確認
                if station.info.transfer:
                    for transfer in station.info.transfer:
                        # 起点駅の路線または既に処理済みの路線と接続しているか
                        if (
                            transfer.link == base_line_id
                            or transfer.link in processed_lines
                        ):
                            # この路線が接続している
                            transfer_station_idx = idx
                            connected_line_id = transfer.link
                            # 接続駅のdistance_from_baseを取得（接続先の路線上の駅として）
                            for line in lines:
                                if line.line_id == transfer.link:
                                    for s in line.stations:
                                        if s.code == station.info.code:
                                            transfer_station_distance = (
                                                s.distance_from_base
                                            )
                                            break
                                if transfer_station_distance is not None:
                                    break
                            break
                    if transfer_station_idx is not None:
                        break

            # 2. 各駅の距離を計算
            for idx, station in enumerate(station_list.stations):
                stop_trains = []
                if station.info.stop_trains:
                    from .models import get_stop_train_names

                    stop_trains = get_stop_train_names(station.info.stop_trains)

                # 距離計算
                if (
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
                    code=station.info.code,
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

    # 接続路線を追加（起点駅の乗換情報から、全エリアで検索）
    if base_station_data.info.transfer:
        for transfer in base_station_data.info.transfer:
            if transfer.link and transfer.link not in processed_lines:
                # 接続路線のデータを取得（全エリアから検索）
                linked_line_id = transfer.link
                linked_area_data = None

                for area, area_data in all_area_data.items():
                    if linked_line_id in area_data.stations:
                        linked_area_data = area_data
                        break

                if linked_area_data:
                    station_list = linked_area_data.stations[linked_line_id]
                    line_info = linked_area_data.master.lines.get(linked_line_id)

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


def format_position(
    pos: str, station_graph: StationGraph, train_direction: int = 0
) -> str:
    """
    posフィールドを「駅A → 駅B」の形式に整形
    posは進行方向を表さず、単に「駅Aと駅Bの間」を示す
    常に距離の小さい駅 → 距離の大きい駅 の順に表示

    Args:
        pos: "0415_0416" または "0415_####" 形式
        station_graph: 駅グラフ（駅名解決用）
        train_direction: 未使用（互換性のため残す）

    Returns:
        "駅A → 駅B" または "駅A" または "不明"
    """
    if not pos:
        return "不明"

    parts = pos.split("_")
    if len(parts) != 2:
        return "不明"

    station_a_code, station_b_code = parts

    # 駅コードから駅名と距離を解決
    station_a_name = None
    station_b_name = None
    station_a_distance = None
    station_b_distance = None

    for line in station_graph.lines:
        for station in line.stations:
            if station.code == station_a_code:
                station_a_name = station.name
                station_a_distance = station.distance_from_base
            if station.code == station_b_code:
                station_b_name = station.name
                station_b_distance = station.distance_from_base
        # 両方見つかったら早期終了
        if station_a_name and station_b_name:
            break

    # #### の場合は単独駅表示
    if station_b_code == "####":
        if station_a_name:
            return station_a_name
        return f"駅{station_a_code}"

    # 両駅名が解決できた場合
    if station_a_name and station_b_name:
        # 距離情報が両方あれば、距離の小さい方 → 大きい方の順に表示
        if station_a_distance is not None and station_b_distance is not None:
            if station_a_distance <= station_b_distance:
                return f"{station_a_name} → {station_b_name}"
            else:
                return f"{station_b_name} → {station_a_name}"
        # 距離情報がなければ元の順序で表示
        return f"{station_a_name} → {station_b_name}"

    # 一部しか解決できない場合
    if station_a_name:
        return f"{station_a_name} → 駅{station_b_code}"
    if station_b_name:
        return f"駅{station_a_code} → {station_b_name}"

    # 両方不明
    return f"駅{station_a_code} → 駅{station_b_code}"

    # 一部しか解決できない場合
    if station_a_name:
        return f"{station_a_name} → 駅{station_b_code}"
    if station_b_name:
        return f"駅{station_a_code} → {station_b_name}"

    # 両方不明
    return f"駅{station_a_code} → 駅{station_b_code}"
