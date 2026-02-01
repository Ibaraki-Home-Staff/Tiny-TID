from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
import jpholiday
import time
import threading
from services.ekispert import fetch_timetable_directions, fetch_timetable_detail
from services.timetable_cache import cache as ekispert_cache
from services.jrwest import fetch_all_area_data, cache as jrwest_cache, AREAS
from services.jrwest.models import AreaData
from services.jrwest.realtime_client import fetch_train_positions
from services.jrwest.realtime_cache import realtime_cache
from config import get_settings

scheduler = BackgroundScheduler()
realtime_thread = None
realtime_stop_event = threading.Event()


def get_date_group(date_str: str) -> str:
    """
    日付からdateGroupを判定
    """
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


def fetch_daily_timetable():
    """
    毎日3:21に実行される時刻表取得処理
    """
    print(f"[{datetime.now()}] 時刻表データの取得を開始します...")

    settings = get_settings()

    # APIキーがダミーの場合はスキップ
    if settings.ekispert_api_key == "dummy_key_for_initial_fetch":
        print(f"  - APIキーが設定されていないため、取得をスキップします")
        return

    today = datetime.now()
    date_str = today.strftime("%Y%m%d")
    date_group = get_date_group(date_str)

    try:
        # 方面別一覧を取得
        directions = fetch_timetable_directions(settings.station_code, date_str)
        print(f"  - 方面別一覧取得完了: {len(directions)}件")

        # 各方面の詳細時刻表を取得
        detailed_timetables = {}
        for direction in directions:
            code = direction.get("code")
            if code:
                try:
                    detail = fetch_timetable_detail(
                        settings.station_code, date_str, code
                    )
                    detailed_timetables[code] = detail
                    print(f"  - 詳細時刻表取得完了: code={code}")
                except Exception as e:
                    print(f"  - 詳細時刻表取得失敗: code={code}, error={e}")

        # キャッシュを更新（ファイルにも保存）
        ekispert_cache.update(date_str, date_group, directions, detailed_timetables)
        print(
            f"[{datetime.now()}] 時刻表データの取得が完了しました (date_group={date_group})"
        )

    except Exception as e:
        print(f"[{datetime.now()}] 時刻表データの取得に失敗しました: {e}")


def fetch_jrwest_daily():
    """
    毎日3:21に実行されるJR西日本データ取得処理
    全エリアの全路線の駅一覧を取得
    """
    print(f"[{datetime.now()}] JR西日本データの取得を開始します...")
    print(f"  - 対象エリア: {', '.join(AREAS)}")

    try:
        areas_data = {}

        for area in AREAS:
            print(f"  - {area}エリアの取得を開始...")
            area_data = fetch_all_area_data(area)

            if area_data:
                areas_data[area] = AreaData(**area_data)
                station_count = sum(
                    len(sl.stations) for sl in area_data["stations"].values()
                )
                print(f"    → {len(area_data['stations'])}路線, {station_count}駅")
            else:
                print(f"    → 取得失敗")

        if areas_data:
            # キャッシュを更新（ファイルにも保存）
            jrwest_cache.update(areas_data)
            total_lines = sum(len(ad.stations) for ad in areas_data.values())
            total_stations = sum(
                sum(len(sl.stations) for sl in ad.stations.values())
                for ad in areas_data.values()
            )
            print(
                f"[{datetime.now()}] JR西日本データの取得が完了しました "
                f"({len(areas_data)}エリア, {total_lines}路線, {total_stations}駅)"
            )
        else:
            print(
                f"[{datetime.now()}] JR西日本データの取得に失敗しました: データが空です"
            )

    except Exception as e:
        print(f"[{datetime.now()}] JR西日本データの取得に失敗しました: {e}")


def realtime_polling_loop():
    """
    リアルタイムデータポーリングループ（別スレッドで実行）
    """
    settings = get_settings()
    lines = [line.strip() for line in settings.wjrc_line.split(",")]
    line_interval = settings.wjrc_line_interval
    polling_interval = settings.wjrc_polling_interval
    area = settings.wjrc_area

    # 路線名を取得
    area_data = jrwest_cache.get_area(area)
    line_names = {}
    if area_data:
        for line_id in lines:
            if line_id in area_data.master.lines:
                line_names[line_id] = area_data.master.lines[line_id].name
            else:
                line_names[line_id] = line_id
    else:
        line_names = {line_id: line_id for line_id in lines}

    print(f"[{datetime.now()}] リアルタイムポーリング開始")
    print(f"  - エリア: {area}")
    print(f"  - 路線: {', '.join(lines)}")
    print(f"  - 路線間隔: {line_interval}秒")
    print(f"  - 総サイクル: {polling_interval}秒")

    line_index = 0
    last_cycle_start = time.time()

    while not realtime_stop_event.is_set():
        try:
            current_time = time.time()

            # 新しいサイクル開始時刻を計算
            if current_time - last_cycle_start >= polling_interval:
                last_cycle_start = current_time
                line_index = 0

            # 現在の路線を取得
            if line_index < len(lines):
                line_id = lines[line_index]
                line_name = line_names.get(line_id, line_id)

                # データ取得
                data = fetch_train_positions(line_id)
                realtime_cache.update_line(line_id, line_name, data)

                if data:
                    print(
                        f"  [{datetime.now().strftime('%H:%M:%S')}] {line_id}: {len(data.trains)}両"
                    )
                else:
                    print(
                        f"  [{datetime.now().strftime('%H:%M:%S')}] {line_id}: 取得失敗"
                    )

                line_index += 1

                # 全路線取得完了時に駅列車データを生成
                if line_index >= len(lines):
                    from services.station_train_merger import generate_and_cache

                    try:
                        generate_and_cache()
                    except Exception as e:
                        print(f"[{datetime.now()}] 駅列車データ生成エラー: {e}")

            # 次の取得まで待機
            sleep_time = min(
                line_interval, polling_interval - (time.time() - last_cycle_start)
            )
            if sleep_time > 0:
                realtime_stop_event.wait(sleep_time)

        except Exception as e:
            print(f"[{datetime.now()}] リアルタイムポーリングエラー: {e}")
            time.sleep(1)


def start_scheduler():
    """
    スケジューラーを開始
    起動時はファイルからキャッシュを読み込み
    """
    import os

    settings = get_settings()
    cache_dir = settings.cache_dir

    # キャッシュディレクトリを作成
    if not os.path.exists(cache_dir):
        os.makedirs(cache_dir)
        print(f"[{datetime.now()}] キャッシュディレクトリを作成しました: {cache_dir}")

    print(f"[{datetime.now()}] キャッシュデータを読み込み中...")

    # 駅すぱあとキャッシュを読み込み
    ekispert_loaded = ekispert_cache.load_from_file()
    if not ekispert_loaded:
        print(f"  - 駅すぱあと: ファイルキャッシュなし")

    # JR西日本キャッシュを読み込み
    jrwest_loaded = jrwest_cache.load_from_file()
    if not jrwest_loaded:
        print(f"  - JR西日本: ファイルキャッシュなし")

    if not ekispert_loaded and not jrwest_loaded:
        print(
            f"[{datetime.now()}] キャッシュファイルがありません。初回起動時に取得します。"
        )

    # 毎日3:21に実行（駅すぱあと）
    trigger = CronTrigger(hour=3, minute=21)
    scheduler.add_job(
        fetch_daily_timetable,
        trigger=trigger,
        id="timetable_fetch",
        replace_existing=True,
    )

    # 毎日3:21に実行（JR西日本）
    scheduler.add_job(
        fetch_jrwest_daily,
        trigger=trigger,
        id="jrwest_fetch",
        replace_existing=True,
    )

    scheduler.start()
    print(f"[{datetime.now()}] スケジューラーを開始しました (毎日3:21に実行)")

    # キャッシュがない場合のみ初回取得を実行
    if not ekispert_loaded:
        print(f"[{datetime.now()}] 駅すぱあと初回データ取得を開始...")
        fetch_daily_timetable()

    if not jrwest_loaded:
        print(f"[{datetime.now()}] JR西日本初回データ取得を開始...")
        fetch_jrwest_daily()

    # リアルタイムポーリングを開始
    global realtime_thread
    realtime_stop_event.clear()
    realtime_thread = threading.Thread(target=realtime_polling_loop, daemon=True)
    realtime_thread.start()


def shutdown_scheduler():
    """
    スケジューラーを停止
    """
    global realtime_thread

    # リアルタイムポーリングを停止
    realtime_stop_event.set()
    if realtime_thread and realtime_thread.is_alive():
        realtime_thread.join(timeout=5)

    scheduler.shutdown()
    print(f"[{datetime.now()}] スケジューラーを停止しました")
