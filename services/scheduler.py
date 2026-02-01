from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
import jpholiday
from services.ekispert import fetch_timetable_directions, fetch_timetable_detail
from services.timetable_cache import cache as ekispert_cache
from services.jrwest import fetch_all_areas, cache as jrwest_cache
from config import get_settings

scheduler = BackgroundScheduler()


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

        # キャッシュを更新
        ekispert_cache.update(date_str, date_group, directions, detailed_timetables)
        print(
            f"[{datetime.now()}] 時刻表データの取得が完了しました (date_group={date_group})"
        )

    except Exception as e:
        print(f"[{datetime.now()}] 時刻表データの取得に失敗しました: {e}")


def fetch_jrwest_daily():
    """
    毎日3:21に実行されるJR西日本データ取得処理
    """
    print(f"[{datetime.now()}] JR西日本データの取得を開始します...")

    try:
        # 全エリアデータを取得
        areas = fetch_all_areas()

        if areas:
            # キャッシュを更新
            jrwest_cache.update(areas)
            print(
                f"[{datetime.now()}] JR西日本データの取得が完了しました ({len(areas)}エリア)"
            )
        else:
            print(
                f"[{datetime.now()}] JR西日本データの取得に失敗しました: データが空です"
            )

    except Exception as e:
        print(f"[{datetime.now()}] JR西日本データの取得に失敗しました: {e}")


def start_scheduler():
    """
    スケジューラーを開始
    """
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

    # 初回は即座に取得
    fetch_daily_timetable()
    fetch_jrwest_daily()


def shutdown_scheduler():
    """
    スケジューラーを停止
    """
    scheduler.shutdown()
    print(f"[{datetime.now()}] スケジューラーを停止しました")
