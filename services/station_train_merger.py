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
from services.jrwest.models import get_stop_train_names
from services.timetable_cache import cache as timetable_cache


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
    train_pos: str, target_station_code: str, station_graph: Any
) -> bool:
    """
    列車が指定駅を経路上に持つか判定

    Args:
        train_pos: "0410_0411" または "0410_####" 形式の位置情報
        target_station_code: 判定対象の駅コード
        station_graph: 駅グラフ

    Returns:
        True: 経路上に駅が存在する
    """
    if not train_pos or not station_graph:
        return False

    parts = train_pos.split("_")
    if len(parts) != 2:
        return False

    current_station, next_station = parts

    # 現在位置または次の駅が対象駅の場合
    if current_station == target_station_code or next_station == target_station_code:
        return True

    # 駅グラフから対象駅の位置を取得
    target_distance = None
    current_distance = None
    next_distance = None

    for line in station_graph.lines:
        for station in line.stations:
            if (
                station.code == target_station_code
                and station.distance_from_base is not None
            ):
                target_distance = station.distance_from_base
            if (
                station.code == current_station
                and station.distance_from_base is not None
            ):
                current_distance = station.distance_from_base
            if station.code == next_station and station.distance_from_base is not None:
                next_distance = station.distance_from_base

    # 距離情報が揃っていれば、対象駅が現在位置と次駅の間にあるか判定
    if target_distance is not None and current_distance is not None:
        if next_distance is not None:
            # 進行方向を判定
            if next_distance > current_distance:  # 下り方向
                return current_distance <= target_distance <= next_distance
            elif next_distance < current_distance:  # 上り方向
                return next_distance <= target_distance <= current_distance
        else:
            # #### の場合は現在駅と同じ距離とみなす
            return current_distance == target_distance

    return False


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
    area = settings.wjrc_area

    if not target_station_code or not target_lines:
        print(
            f"[{datetime.now()}] 駅列車データ生成: 設定不足 (station_code={target_station_code}, lines={target_lines})"
        )
        return None

    # 駅データを取得（stopTrains確認用）
    station_data = jrwest_cache.search_station_in_area(area, target_station_code)
    if not station_data:
        print(
            f"[{datetime.now()}] 駅列車データ生成: 駅データが見つかりません (station_code={target_station_code})"
        )
        return None

    station_name = station_data.info.name
    station_stop_trains = station_data.info.stop_trains

    # 駅グラフを構築（経路判定用）
    station_graph = build_station_graph(target_station_code, target_lines, area)
    if not station_graph:
        print(f"[{datetime.now()}] 駅列車データ生成: 駅グラフ構築失敗")
        return None

    # 対象路線のリアルタイムデータを取得
    up_trains: List[Dict[str, Any]] = []
    down_trains: List[Dict[str, Any]] = []

    for line_id in target_lines:
        line_data = realtime_cache.get_line_data(line_id)
        if not line_data:
            continue

        for train in line_data.trains:
            # 指定駅を経路上に持つか判定
            if not is_train_on_route_to_station(
                train.pos, target_station_code, station_graph
            ):
                continue

            # 時刻表から定刻を検索
            scheduled_time = timetable_cache.get_train_time(train.no)
            scheduled_str = (
                f"{scheduled_time.hour}:{scheduled_time.minute}"
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

            # 位置情報を整形
            location_str = format_position(train.pos, station_graph)

            # 列車種別を変換
            train_type_converted = convert_train_type(train.display_type)

            train_data = {
                "train_no": train.no,
                "train_type": train_type_converted,
                "nickname": train.nickname or "",
                "car_count": train.number_of_cars,
                "destination": train.dest.text if train.dest else "",
                "location": location_str,
                "scheduled": scheduled_str,
                "estimated": estimated_str,
                "delay_minutes": train.delay_minutes,
                "pass": is_pass,
            }

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
