"""
駅別列車データ生成モジュール
JR西日本リアルタイムデータと駅すぱあと時刻表データを統合
"""

import json
import os
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from config import get_settings
from services.jrwest.realtime_cache import realtime_cache
from services.jrwest.cache import cache as jrwest_cache
from services.jrwest.station_graph import build_station_graph, format_position
from services.jrwest.models import get_stop_train_names, Station
from services.timetable_cache import cache as timetable_cache


def search_station_in_target_lines(
    areas: List[str], target_lines: List[str], station_code: str
) -> tuple:
    """
    指定路線内で駅を優先的に検索

    Returns: (station_data, found_area, found_line)
    """
    # まず指定路線内を検索
    for area in areas:
        area_data = jrwest_cache.get_area(area)
        if not area_data:
            continue

        for line_id in target_lines:
            station_list = area_data.stations.get(line_id)
            if not station_list:
                continue

            for station in station_list.stations:
                if station.info.code == station_code:
                    print(
                        f"  - {area}エリアの{line_id}路線で見つかりました: "
                        f"{station.info.name} (code={station.info.code})"
                    )
                    return station, area, line_id

    # 指定路線内に見つからない場合は全エリアから検索（フォールバック）
    for area in areas:
        station_data = jrwest_cache.search_station_in_area(area, station_code)
        if station_data:
            print(
                f"  - {area}エリアで見つかりました（フォールバック）: "
                f"{station_data.info.name} (code={station_data.info.code})"
            )
            return station_data, area, None

    return None, None, None


# 列車種別コード→表示名の変換テーブル（拡張性のため分離）
TRAIN_TYPE_DISPLAY_MAP = {
    # 必要に応じて変換ルールを追加
    # "コード": "表示名",
}


def convert_train_type(display_type: str) -> str:
    """
    列車種別を変換（拡張性のため分離）

    Args:
        display_type: JR西日本APIのdisplayType

    Returns:
        変換後の列車種別名
    """
    # 変換テーブルにあれば変換、なければそのまま
    return TRAIN_TYPE_DISPLAY_MAP.get(display_type, display_type)


def calculate_estimated_time(scheduled: str, delay_minutes: int) -> str:
    """
    定刻時刻と遅延分から予測時刻を計算

    Args:
        scheduled: HH:MM形式の定刻時刻
        delay_minutes: 遅延分

    Returns:
        HH:MM形式の予測時刻
    """
    try:
        hour, minute = map(int, scheduled.split(":"))
        total_minutes = hour * 60 + minute + delay_minutes

        # 24時間超え対応
        new_hour = (total_minutes // 60) % 24
        new_minute = total_minutes % 60

        return f"{new_hour:02d}:{new_minute:02d}"
    except (ValueError, AttributeError):
        return scheduled


def is_train_on_route_to_station(
    train_pos: str,
    train_direction: int,
    destination_code: str,
    target_station_code: str,
    station_graph: Any,
) -> bool:
    """
    列車が指定駅を「まだ通過していない」か判定（位置ベース）

    駅グラフの距離情報を使用して、起点駅を通過前の列車のみを判定する。
    - 上り（起点に向かう）: 現在位置が起点より後ろ(distance>0)で、かつ起点に到達していない
    - 下り（起点から離れる）: 現在位置が起点より手前(distance<0)で、かつ起点に到達していない

    つまり「正->0->負」または「負->0->正」のパターンになる列車のみを対象とする。

    駅グラフに現在位置が含まれない場合は、行先コードと方向から判定する。

    Args:
        train_pos: "0410_0411" または "0410_####" 形式の位置情報
        train_direction: 0=上り(起点に向かう), 1=下り(起点から離れる)
        destination_code: 行先駅コード
        target_station_code: 判定対象の駅コード（起点駅）
        station_graph: 駅グラフ

    Returns:
        True: 列車が起点駅をまだ通過していない
    """
    if not train_pos or not station_graph:
        return False

    parts = train_pos.split("_")
    if len(parts) != 2:
        return False

    current_station, next_station = parts

    # 駅グラフから各駅の位置（起点駅からの距離）を取得
    current_distance = None
    destination_distance = None
    target_distance = 0  # 起点駅は常にdistance=0

    for line in station_graph.lines:
        for station in line.stations:
            if station.distance_from_base is None:
                continue

            if station.code == current_station:
                current_distance = station.distance_from_base
            if station.code == destination_code:
                destination_distance = station.distance_from_base

    # 現在位置が駅グラフにない場合は、行先コードと方向で判定（フォールバック）
    if current_distance is None:
        # 行先コードが駅グラフにあれば、それを使用して判定
        if destination_distance is not None:
            # 上り：行先が起点または起点より手前（distance <= 0）
            if train_direction == 0:
                return destination_distance <= 0
            # 下り：行先が起点または起点より後（distance >= 0）
            else:
                return destination_distance >= 0
        else:
            # 現在位置も行先も駅グラフにない場合は判定不可
            # デバッグ出力は抑制（大量に出るため）
            return False

    # 現在位置が起点駅の場合、停車中は含める（通過前とみなす）
    if current_distance == 0:
        # 停車中（####）の場合は通過前とみなす
        if next_station == "####":
            return True
        # 走行中に起点駅にいる場合は、次の駅で方向を判定
        # 次の駅の距離を取得
        next_distance = None
        for line in station_graph.lines:
            for station in line.stations:
                if (
                    station.code == next_station
                    and station.distance_from_base is not None
                ):
                    next_distance = station.distance_from_base
                    break
        # 上りなら次の駅が負（起点側）、下りなら次の駅が正（起点から離れる側）
        if train_direction == 0:  # 上り
            return next_distance is not None and next_distance < 0
        else:  # 下り
            return next_distance is not None and next_distance > 0

    # 上り（起点に向かう）: distance>0（起点より後ろ）からdistance<=0（起点または手前）へ
    if train_direction == 0:
        # 現在位置が起点より後(distance>0)であり、行先が起点または起点より手前(distance<=0)
        if destination_distance is not None:
            # 行先が判明している場合：現在位置が正で、行先が負または0
            return current_distance > 0 and destination_distance <= 0
        else:
            # 行先不明の場合：現在位置が正（起点より後ろ）であれば対象
            # 行先が不明でも起点に向かっていると判定
            return current_distance > 0

    # 下り（起点から離れる）: distance<0（起点より手前）からdistance>=0（起点または後ろ）へ
    else:
        # 現在位置が起点より手前(distance<0)であり、行先が起点または起点より後(distance>=0)
        if destination_distance is not None:
            # 行先が判明している場合：現在位置が負で、行先が正または0
            return current_distance < 0 and destination_distance >= 0
        else:
            # 行先不明の場合：現在位置が負（起点より手前）であれば対象
            # 行先が不明でも起点から離れていると判定
            return current_distance < 0


def check_is_passing_train(
    train_no: str,
    display_type: str,
    station_stop_trains: Optional[List[int]],
) -> bool:
    """
    通過列車かどうかを判定

    Args:
        train_no: 列車番号
        display_type: 列車種別（displayType）
        station_stop_trains: 駅のstopTrains（停車列車種別インデックスリスト）

    Returns:
        True: 通過列車
    """
    # 1. 時刻表で列車番号を検索
    train_time = timetable_cache.get_train_time(train_no)
    if train_time is None:
        # 時刻表に見つからない = 通過
        return True

    # 2. stopTrainsチェック
    if station_stop_trains is None or station_stop_trains == []:
        # 普通列車のみ停車の駅 → 普通以外は通過
        return display_type != "普通"

    # stopTrainsに該当種別があるかチェック
    # display_type → STOP_TRAIN_TYPESの逆引きが必要
    stop_train_names = get_stop_train_names(station_stop_trains)
    return display_type not in stop_train_names


def generate_station_train_data() -> Optional[Dict[str, Any]]:
    """
    指定駅の統合列車データを生成

    Returns:
        rest_sample.json形式のデータ辞書
    """
    settings = get_settings()
    target_lines = [
        line.strip() for line in settings.wjrc_line.split(",") if line.strip()
    ]
    target_station_code = settings.wjrc_stcode
    areas = settings.wjrc_areas  # 複数エリア対応

    if not target_station_code or not target_lines:
        print(
            f"[{datetime.now()}] 駅列車データ生成: 設定不足 (station_code={target_station_code}, lines={target_lines})"
        )
        return None

    # 駅データを取得（指定路線内を優先的に検索）
    print(
        f"[{datetime.now()}] 駅データ検索開始: station_code={target_station_code}, "
        f"areas={areas}, target_lines={target_lines}"
    )
    station_data, found_area, found_line = search_station_in_target_lines(
        areas, target_lines, target_station_code
    )

    if not station_data:
        print(
            f"[{datetime.now()}] 駅列車データ生成: 駅データが見つかりません "
            f"(station_code={target_station_code}, areas={areas}, target_lines={target_lines})"
        )
        return None

    station_name = station_data.info.name
    station_stop_trains = station_data.info.stop_trains
    print(
        f"[{datetime.now()}] 駅データ確定: {station_name} "
        f"(code={target_station_code}, area={found_area}, line={found_line})"
    )

    # 駅グラフを構築（複数エリア対応）
    from services.jrwest.station_graph import build_station_graph_multi_area

    station_graph = build_station_graph_multi_area(
        target_station_code, target_lines, areas
    )
    if not station_graph:
        print(f"[{datetime.now()}] 駅列車データ生成: 駅グラフ構築失敗")
        return None

    # 駅グラフに起点駅が含まれているか確認（指定路線内に存在するかの最終確認）
    if station_graph.base_station.get("code") != target_station_code:
        print(
            f"[{datetime.now()}] 駅列車データ生成: 指定駅{target_station_code}は駅グラフに含まれていません "
            f"(指定路線 {target_lines} 内に存在しない可能性があります)"
        )
        return None

    print(
        f"[{datetime.now()}] 駅グラフ構築完了: {station_graph.base_station.get('name')} "
        f"(code={station_graph.base_station.get('code')}, "
        f"lines={[line.line_id for line in station_graph.lines]})"
    )

    # 対象路線のリアルタイムデータを取得
    up_trains: List[Dict[str, Any]] = []
    down_trains: List[Dict[str, Any]] = []
    seen_train_nos: set = set()  # 重複排除用

    for line_id in target_lines:
        line_data = realtime_cache.get_line_data(line_id)
        if not line_data:
            continue

        for train in line_data.trains:
            # 重複チェック
            if train.no in seen_train_nos:
                continue

            # 行先コードを取得（プロパティを使用して互換性を確保）
            destination_code = train.dest_code if train.dest else None

            # 指定駅を経路上に持つか判定（行先ベース）
            if not is_train_on_route_to_station(
                train.pos,
                train.direction,
                destination_code,
                target_station_code,
                station_graph,
            ):
                continue

            # 時刻表から定刻を検索
            scheduled_time = timetable_cache.get_train_time(train.no)
            scheduled_str = (
                f"{int(scheduled_time.hour):02d}:{int(scheduled_time.minute):02d}"
                if scheduled_time
                else ""
            )

            # 予測時刻を計算
            estimated_str = ""
            if scheduled_str:
                estimated_str = calculate_estimated_time(
                    scheduled_str, train.delay_minutes
                )

            # 通過判定
            is_pass = check_is_passing_train(
                train.no,
                train.display_type,
                station_stop_trains,
            )

            # 位置情報を整形（進行方向に応じた順序）
            location_str = format_position(train.pos, station_graph, train.direction)

            # 駅グラフに含まれない駅の列車は除外（「駅{コード}」形式の場合）
            if location_str.startswith("駅") or "→ 駅" in location_str:
                # 駅名が解決できなかった = 駅グラフに含まれない路線の駅
                continue

            # 列車種別を変換
            train_type_converted = convert_train_type(train.display_type)

            train_data = {
                "train_no": train.no,
                "train_type": train_type_converted,
                "nickname": train.nickname or "",
                "car_count": train.number_of_cars,
                "destination": train.dest_text if train.dest else "",
                "location": location_str,
                "scheduled": scheduled_str,
                "estimated": estimated_str,
                "delay_minutes": train.delay_minutes,
                "pass": is_pass,
            }

            # 重複を記録
            seen_train_nos.add(train.no)

            # 方向で分類（0=上り、1=下り）
            if train.direction == 0:
                up_trains.append(train_data)
            else:
                down_trains.append(train_data)

    # 時刻でソート
    up_trains.sort(key=lambda x: x["scheduled"] or "99:99")
    down_trains.sort(key=lambda x: x["scheduled"] or "99:99")

    result = {
        "gentime": datetime.now().isoformat(),
        "version": "1.0.0",
        "trains": {
            "up": up_trains,
            "down": down_trains,
        },
    }

    print(
        f"[{datetime.now()}] 駅列車データ生成完了: {station_name} (上り{len(up_trains)}件, 下り{len(down_trains)}件)"
    )

    return result


def save_station_train_data(data: Dict[str, Any], cache_dir: str) -> bool:
    """
    駅列車データをファイルに保存

    Args:
        data: 生成したデータ
        cache_dir: キャッシュディレクトリパス

    Returns:
        True: 保存成功
    """
    try:
        if not os.path.exists(cache_dir):
            os.makedirs(cache_dir)

        cache_file = os.path.join(cache_dir, "station_trains.json")

        with open(cache_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        return True
    except Exception as e:
        print(f"[{datetime.now()}] 駅列車データ保存失敗: {e}")
        return False


def load_station_train_data(cache_dir: str) -> Optional[Dict[str, Any]]:
    """
    ファイルから駅列車データを読み込み

    Args:
        cache_dir: キャッシュディレクトリパス

    Returns:
        データ辞書またはNone
    """
    try:
        cache_file = os.path.join(cache_dir, "station_trains.json")

        if not os.path.exists(cache_file):
            return None

        with open(cache_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        return data
    except Exception as e:
        print(f"[{datetime.now()}] 駅列車データ読み込み失敗: {e}")
        return None


def generate_and_cache() -> Optional[Dict[str, Any]]:
    """
    データを生成してキャッシュに保存

    Returns:
        生成したデータまたはNone
    """
    settings = get_settings()

    # データ生成
    data = generate_station_train_data()

    if data:
        # ファイルに保存
        save_station_train_data(data, settings.cache_dir)

    return data


def get_cache_status(cache_dir: str) -> Optional[Dict[str, Any]]:
    """
    キャッシュのステータスを取得

    Args:
        cache_dir: キャッシュディレクトリパス

    Returns:
        ステータス情報辞書
    """
    settings = get_settings()

    # 現在のデータを読み込み
    data = load_station_train_data(cache_dir)

    if not data:
        return None

    # ファイルの更新時刻を取得
    cache_file = os.path.join(cache_dir, "station_trains.json")
    try:
        mtime = os.path.getmtime(cache_file)
        last_update = datetime.fromtimestamp(mtime)
    except:
        last_update = datetime.now()

    # 駅情報を取得
    station_data = jrwest_cache.search_station_in_area(
        settings.wjrc_area, settings.wjrc_stcode
    )
    station_name = station_data.info.name if station_data else "不明"

    trains = data.get("trains", {})
    up_count = len(trains.get("up", []))
    down_count = len(trains.get("down", []))

    return {
        "station_code": settings.wjrc_stcode,
        "station_name": station_name,
        "line_count": len(settings.wjrc_line.split(",")),
        "up_count": up_count,
        "down_count": down_count,
        "generated_at": data.get("gentime", ""),
        "last_update": last_update.isoformat(),
    }
