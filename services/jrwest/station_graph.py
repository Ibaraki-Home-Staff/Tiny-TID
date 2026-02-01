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
    base_station_idx = base_info["station_index"]
    base_station_data = base_info["station_data"]
    base_line_info = base_info["line_info"]

    # 第一段階：全路線の駅データを収集し、同一駅を検出
    # station_code -> 距離値のマッピング（最初に見つかった距離を使用）
    station_distance_registry: Dict[str, int] = {}
    station_info_registry: Dict[str, Dict] = {}

    lines_data = []  # 各線の生データを保存

    for line_id in target_line_ids:
        station_list = area_data.stations.get(line_id)
        line_info = area_data.master.lines.get(line_id)

        if not station_list or not line_info:
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
                    station_info_registry[code] = {
                        "name": station.info.name,
                        "station": station,
                        "lines": [line_id],
                    }
                else:
                    # 既に登録済みの駅は、路線リストに追加
                    station_info_registry[code]["lines"].append(line_id)

        lines_data.append(
            {
                "line_id": line_id,
                "line_info": line_info,
                "station_list": station_list,
                "base_idx": base_idx_in_line,
            }
        )

    # 第二段階：統一された距離値を使用して駅グラフを構築
    lines = []
    processed_lines = set()

    for line_data in lines_data:
        line_id = line_data["line_id"]
        line_info = line_data["line_info"]
        station_list = line_data["station_list"]
        base_idx_in_line = line_data["base_idx"]

        if line_id in processed_lines:
            continue

        if not station_list or not line_info:
            continue

        stations = []

        if base_idx_in_line is not None:
            # 起点駅がこの路線上にある場合
            for idx, station in enumerate(station_list.stations):
                code = station.info.code

                # 統一された距離値を使用（レジストリにあれば使用、なければ計算）
                if code in station_distance_registry:
                    distance = station_distance_registry[code]
                else:
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
    base_line_id = base_info["line_id"]

    # 第一段階：全路線の駅データを収集し、同一駅を検出
    # station_code -> 距離値のマッピング（最初に見つかった距離を使用）
    station_distance_registry: Dict[str, int] = {}
    lines_data = []  # 各線の生データを保存

    for line_id in target_line_ids:
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

        if base_idx_in_line is not None:
            # 起点駅が見つかった場合、距離を計算して登録
            for idx, station in enumerate(station_list.stations):
                distance = idx - base_idx_in_line
                code = station.info.code

                if code not in station_distance_registry:
                    # 初めて見つかった駅は登録
                    station_distance_registry[code] = distance

        lines_data.append(
            {
                "line_id": line_id,
                "line_info": line_info,
                "station_list": station_list,
                "base_idx": base_idx_in_line,
                "line_area_data": line_area_data,
            }
        )

    # 第二段階：統一された距離値を使用して駅グラフを構築
    lines = []
    processed_lines = set()

    for line_data in lines_data:
        line_id = line_data["line_id"]
        line_info = line_data["line_info"]
        station_list = line_data["station_list"]
        base_idx_in_line = line_data["base_idx"]
        line_area_data = line_data["line_area_data"]

        if line_id in processed_lines:
            continue

        if not station_list or not line_info:
            continue

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
            # 接続駅を探す（距離レジストリに存在する駅）
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
    進行方向に応じて表示順を変更
    - 上り（起点に向かう）: 距離大 → 距離小（遠い駅 → 近い駅）
    - 下り（起点から離れる）: 距離小 → 距離大（近い駅 → 遠い駅）

    Args:
        pos: "0415_0416" または "0415_####" 形式
        station_graph: 駅グラフ（駅名解決用）
        train_direction: 0=上り（起点に向かう）、1=下り（起点から離れる）

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
        # 距離情報が両方あれば、進行方向に応じた順序で表示
        if station_a_distance is not None and station_b_distance is not None:
            if train_direction == 0:
                # 上り（起点に向かう）: 距離大 → 距離小
                if station_a_distance >= station_b_distance:
                    return f"{station_a_name} → {station_b_name}"
                else:
                    return f"{station_b_name} → {station_a_name}"
            else:
                # 下り（起点から離れる）: 距離小 → 距離大
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
def is_valid_station_interval(
    station_a_code: str,
    station_b_code: str,
    station_graph: StationGraph,
    target_line_ids: Optional[List[str]] = None,
    station_a_name: Optional[str] = None,
    station_b_name: Optional[str] = None,
) -> tuple:
    """
    駅間区間が指定路線上に連続して存在するか検証
    駅コードと駅名の両方を検証（同一駅名で異なる駅コード、または同一駅コードで異なる駅名の問題に対応）

    重要: 同じ駅コードを持つ駅は複数の路線に存在する可能性があるため、
    すべての組み合わせを検証する必要がある。
    例: 0447(加古川線の加古川) → 0448(北陸線の近江塩津) は連続していないが、
        別の路線で 0447(X駅) → 0448(Y駅) が連続している可能性がある。

    Args:
        station_a_code: 駅Aのコード
        station_b_code: 駅Bのコード
        station_graph: 駅グラフ
        target_line_ids: 検証対象路線IDリスト（Noneの場合は全路線を検証）
        station_a_name: 駅Aの名前（オプション、指定時は駅名も一致する必要がある）
        station_b_name: 駅Bの名前（オプション、指定時は駅名も一致する必要がある）

    Returns:
        (is_valid: bool, line_id: Optional[str], station_a_name: Optional[str], station_b_name: Optional[str], is_continuous_code: bool)
        - is_valid: 駅間区間が連続して存在する場合True
        - line_id: 見つかった路線ID（見つからない場合None）
        - station_a_name: 駅Aの名前
        - station_b_name: 駅Bの名前
        - is_continuous_code: 駅コードが連続している場合True（検証用）
    """
    if not station_a_code or not station_b_code:
        return False, None, None, None, False

    # target_line_idsが指定されていれば、その路線のみ検証
    # 指定されていなければ、駅グラフ内の全路線を検証
    lines_to_check = []
    for line in station_graph.lines:
        if target_line_ids is None or line.line_id in target_line_ids:
            lines_to_check.append(line)

    # 駅コードが連続しているか確認（0447→0448など）
    try:
        code_a = int(station_a_code)
        code_b = int(station_b_code)
        is_continuous_code = abs(code_a - code_b) == 1
    except ValueError:
        is_continuous_code = False

    # まず、駅コードAと駅コードBを持つすべての駅を収集（複数路線にまたがる可能性がある）
    # 構造: {line_id: [(idx, station_name), ...]}
    stations_with_code_a: Dict[str, List[tuple]] = {}  # 駅コードAを持つ駅
    stations_with_code_b: Dict[str, List[tuple]] = {}  # 駅コードBを持つ駅

    for line in lines_to_check:
        line_id = line.line_id
        stations_a_list = []
        stations_b_list = []

        for idx, station in enumerate(line.stations):
            # 駅コードAをチェック
            if station.code == station_a_code:
                # 駅名が指定されていれば、駅名も一致する必要がある
                if station_a_name and station.name != station_a_name:
                    # 駅コードは一致するが駅名が異なる（同一コードで異なる駅）
                    continue
                stations_a_list.append((idx, station.name))

            # 駅コードBをチェック
            if station.code == station_b_code:
                # 駅名が指定されていれば、駅名も一致する必要がある
                if station_b_name and station.name != station_b_name:
                    # 駅コードは一致するが駅名が異なる（同一コードで異なる駅）
                    continue
                stations_b_list.append((idx, station.name))

        if stations_a_list:
            stations_with_code_a[line_id] = stations_a_list
        if stations_b_list:
            stations_with_code_b[line_id] = stations_b_list

    # すべての組み合わせで連続性を検証
    # 同じ路線上で、駅Aと駅Bが連続しているか確認
    found_non_continuous = []  # 連続していない組み合わせの記録

    for line_id in stations_with_code_a:
        if line_id not in stations_with_code_b:
            continue  # この路線には駅Bがない

        stations_a_list = stations_with_code_a[line_id]
        stations_b_list = stations_with_code_b[line_id]

        # この路線上のすべての駅Aと駅Bの組み合わせをチェック
        for idx_a, name_a in stations_a_list:
            for idx_b, name_b in stations_b_list:
                # 連続しているか（インデックス差が1）
                if abs(idx_a - idx_b) == 1:
                    # 連続している組み合わせが見つかった！
                    return (
                        True,
                        line_id,
                        name_a,
                        name_b,
                        is_continuous_code,
                    )
                else:
                    # 連続していない組み合わせを記録
                    found_non_continuous.append(
                        {
                            "line": line_id,
                            "station_a": {"name": name_a, "idx": idx_a},
                            "station_b": {"name": name_b, "idx": idx_b},
                            "distance": abs(idx_a - idx_b),
                        }
                    )

    # いずれの路線・組み合わせでも連続していない
    # デバッグ情報を出力
    if found_non_continuous:
        print(
            f"[駅間区間検証] 駅コード連続だが路線上では非連続: {station_a_code} → {station_b_code}"
        )
        print(f"  - 検証した組み合わせ数: {len(found_non_continuous)}")
        for combo in found_non_continuous[:3]:  # 最初の3件だけ表示
            print(
                f"    路線 {combo['line']}: {combo['station_a']['name']}[{combo['station_a']['idx']}] → "
                f"{combo['station_b']['name']}[{combo['station_b']['idx']}] (インデックス差: {combo['distance']})"
            )
        if len(found_non_continuous) > 3:
            print(f"    ... 他 {len(found_non_continuous) - 3} 件")

    return False, None, None, None, is_continuous_code


def validate_train_position(
    pos: str,
    station_graph: StationGraph,
    target_line_ids: Optional[List[str]] = None,
    train_no: Optional[str] = None,
    station_a_name_hint: Optional[str] = None,
    station_b_name_hint: Optional[str] = None,
) -> dict:
    """
    列車の位置情報（pos）を検証
    駅コードと駅名の両方を検証（同一駅名で異なる駅コード、または同一駅コードで異なる駅名の問題に対応）

    Args:
        pos: "0415_0416" または "0415_####" 形式の位置情報
        station_graph: 駅グラフ
        target_line_ids: 検証対象路線IDリスト
        train_no: 列車番号（ログ用）
        station_a_name_hint: 駅Aの名前のヒント（JR西日本APIから取得した駅名など）
        station_b_name_hint: 駅Bの名前のヒント（JR西日本APIから取得した駅名など）

    Returns:
        {
            "is_valid": bool,
            "is_station": bool,  # #### の場合（停車中）
            "line_id": Optional[str],
            "station_a_name": Optional[str],
            "station_b_name": Optional[str],
            "error_reason": Optional[str],
        }
    """
    result = {
        "is_valid": False,
        "is_station": False,
        "line_id": None,
        "station_a_name": None,
        "station_b_name": None,
        "error_reason": None,
    }

    if not pos:
        result["error_reason"] = "posが空"
        return result

    parts = pos.split("_")
    if len(parts) != 2:
        result["error_reason"] = f"不正なpos形式: {pos}"
        return result

    station_a, station_b = parts

    # #### の場合は停車中として扱う（駅Aの存在確認のみ）
    if station_b == "####":
        result["is_station"] = True
        # 駅Aが駅グラフ内に存在するか確認（駅名も一致するか確認）
        for line in station_graph.lines:
            for station in line.stations:
                if station.code == station_a:
                    # 駅名のヒントが提供されている場合は、駅名も一致するか確認
                    if station_a_name_hint and station.name != station_a_name_hint:
                        # 駅コードは一致するが駅名が異なる（同一コードで異なる駅）
                        continue
                    result["is_valid"] = True
                    result["line_id"] = line.line_id
                    result["station_a_name"] = station.name
                    return result
        result["error_reason"] = f"停車駅が見つからない: {station_a}"
        if station_a_name_hint:
            result["error_reason"] += f" (期待: {station_a_name_hint})"
        return result

    # 駅間区間の検証（駅名のヒントがあれば使用）
    is_valid, line_id, station_a_name, station_b_name, is_continuous_code = (
        is_valid_station_interval(
            station_a,
            station_b,
            station_graph,
            target_line_ids,
            station_a_name=station_a_name_hint,
            station_b_name=station_b_name_hint,
        )
    )

    result["is_valid"] = is_valid
    result["line_id"] = line_id
    result["station_a_name"] = station_a_name
    result["station_b_name"] = station_b_name
    result["is_continuous_code"] = is_continuous_code  # 駅コードが連続しているか

    if not is_valid:
        # 駅名を解決してエラーメッセージを改善
        a_name = station_a_name or station_a_name_hint or f"駅{station_a}"
        b_name = station_b_name or station_b_name_hint or f"駅{station_b}"

        # 駅コードが連続しているが路線上では連続していないケース
        if is_continuous_code:
            result["error_reason"] = (
                f"駅コード連続だが路線上では非連続: {a_name}({station_a}) → {b_name}({station_b}) "
                f"(異なる路線の駅である可能性)"
            )
        else:
            result["error_reason"] = (
                f"路線上に連続しない区間: {a_name}({station_a}) → {b_name}({station_b})"
            )

        # ログ出力
        train_info = f" (列車 {train_no})" if train_no else ""
        print(
            f"[駅間区間検証] 不正な位置情報を検出{train_info}: "
            f"{pos} - {result['error_reason']}"
        )

    return result


def validate_train_position_on_line(
    pos: str,
    line_id: str,
    line_station_list: List[Dict[str, Any]],  # {code, name, ...} のリスト
    train_no: Optional[str] = None,
) -> dict:
    """
    列車の位置情報を特定路線の駅リストで厳密に検証

    この関数は、JR西日本APIから取得したリアルタイムデータのposフィールドが、
    該当路線の駅リスト（*_st.json）で実際に連続している区間かを検証する。

    Args:
        pos: "0415_0416" または "0415_####" 形式の位置情報
        line_id: 路線ID（検証対象の路線）
        line_station_list: 路線の駅リスト（JR西日本APIから取得した*_st.jsonのデータ）
        train_no: 列車番号（ログ用）

    Returns:
        {
            "is_valid": bool,
            "is_station": bool,  # #### の場合（停車中）
            "station_a_name": Optional[str],
            "station_b_name": Optional[str],
            "line_id": str,
            "error_reason": Optional[str],
        }
    """
    result = {
        "is_valid": False,
        "is_station": False,
        "station_a_name": None,
        "station_b_name": None,
        "line_id": line_id,
        "error_reason": None,
    }

    if not pos:
        result["error_reason"] = "posが空"
        return result

    parts = pos.split("_")
    if len(parts) != 2:
        result["error_reason"] = f"不正なpos形式: {pos}"
        return result

    station_a_code, station_b_code = parts

    # 駅リストから駅コードと駅名のマップを作成
    station_map = {}
    station_order = []
    for station in line_station_list:
        if isinstance(station, dict) and "info" in station:
            # {info: {code, name, ...}} 形式
            info = station["info"]
            code = info.get("code")
            name = info.get("name")
        else:
            # 直接 {code, name, ...} 形式
            code = station.get("code")
            name = station.get("name")

        if code:
            station_map[code] = name
            station_order.append(code)

    # #### の場合は停車中として扱う
    if station_b_code == "####":
        result["is_station"] = True
        # 駅Aが駅リストに存在するか確認
        if station_a_code in station_map:
            result["is_valid"] = True
            result["station_a_name"] = station_map[station_a_code]
            return result
        result["error_reason"] = f"停車駅が路線駅リストに見つからない: {station_a_code}"
        return result

    # 駅Aと駅Bが駅リストに存在するか確認
    station_a_name = station_map.get(station_a_code)
    station_b_name = station_map.get(station_b_code)

    if not station_a_name:
        result["error_reason"] = f"駅Aが路線駅リストに見つからない: {station_a_code}"
        return result

    if not station_b_name:
        result["error_reason"] = f"駅Bが路線駅リストに見つからない: {station_b_code}"
        return result

    result["station_a_name"] = station_a_name
    result["station_b_name"] = station_b_name

    # 駅Aと駅Bが路線上で隣り合っているか確認
    idx_a = None
    idx_b = None
    for idx, code in enumerate(station_order):
        if code == station_a_code:
            idx_a = idx
        elif code == station_b_code:
            idx_b = idx

    if idx_a is None or idx_b is None:
        result["error_reason"] = (
            f"駅が路線駅リストで見つからない: {station_a_code} または {station_b_code}"
        )
        return result

    # 隣り合っているかチェック（インデックス差が1）
    if abs(idx_a - idx_b) == 1:
        result["is_valid"] = True
        return result

    # 隣り合っていない
    result["error_reason"] = (
        f"路線上で非連続な区間: {station_a_name}({station_a_code})[{idx_a}] → "
        f"{station_b_name}({station_b_code})[{idx_b}] (インデックス差: {abs(idx_a - idx_b)})"
    )

    train_info = f" (列車 {train_no})" if train_no else ""
    print(
        f"[路線固有検証] 不正な位置情報を検出{train_info}: "
        f"路線 {line_id}: {pos} - {result['error_reason']}"
    )

    return result
