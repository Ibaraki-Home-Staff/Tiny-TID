import json
import os
from typing import Dict, Optional, List, Any
from datetime import datetime
from models import CachedTimeTable, TimeTableSummary, TimeTable, TrainTime
from config import get_settings


class TimeTableCache:
    def __init__(self):
        self._cache: Optional[CachedTimeTable] = None
        self._cache_file = None
        self._ensure_cache_dir()

    def _ensure_cache_dir(self):
        """キャッシュディレクトリを作成"""
        settings = get_settings()
        cache_dir = settings.cache_dir
        if not os.path.exists(cache_dir):
            os.makedirs(cache_dir)
        self._cache_file = os.path.join(cache_dir, "timetable_cache.json")

    def _save_to_file(self):
        """キャッシュをファイルに保存"""
        if self._cache is None:
            return

        try:
            data = {
                "date": self._cache.date,
                "date_group": self._cache.date_group,
                "direction_list": [d.model_dump() for d in self._cache.direction_list],
                "detailed_timetables": {
                    k: v.model_dump()
                    for k, v in self._cache.detailed_timetables.items()
                },
                "fetched_at": self._cache.fetched_at.isoformat(),
            }
            with open(self._cache_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"  - キャッシュをファイルに保存しました: {self._cache_file}")
        except Exception as e:
            print(f"  - キャッシュファイル保存失敗: {e}")

    def load_from_file(self) -> bool:
        """キャッシュをファイルから読み込み"""
        if not os.path.exists(self._cache_file):
            return False

        try:
            with open(self._cache_file, "r", encoding="utf-8") as f:
                data = json.load(f)

            direction_list = [TimeTableSummary(**d) for d in data["direction_list"]]
            detailed_timetables = {
                k: TimeTable(**v) for k, v in data["detailed_timetables"].items()
            }

            self._cache = CachedTimeTable(
                date=data["date"],
                date_group=data["date_group"],
                direction_list=direction_list,
                detailed_timetables=detailed_timetables,
                fetched_at=datetime.fromisoformat(data["fetched_at"]),
            )
            print(f"  - キャッシュをファイルから読み込みました: {self._cache_file}")
            return True
        except Exception as e:
            print(f"  - キャッシュファイル読み込み失敗: {e}")
            return False

    def update(
        self,
        date: str,
        date_group: str,
        direction_list: List[Any],
        detailed_timetables: Dict[str, Any],
    ):
        """
        キャッシュを更新する
        """
        # Pydanticモデルに変換
        directions = [TimeTableSummary(**d) for d in direction_list]
        details = {k: TimeTable(**v) for k, v in detailed_timetables.items()}

        self._cache = CachedTimeTable(
            date=date,
            date_group=date_group,
            direction_list=directions,
            detailed_timetables=details,
            fetched_at=datetime.now(),
        )

        # ファイルに保存
        self._save_to_file()

    def get_direction_list(self) -> Optional[List[TimeTableSummary]]:
        """
        方面別一覧を取得
        """
        if self._cache is None:
            return None
        return self._cache.direction_list

    def get_detailed_timetable(self, code: str) -> Optional[TimeTable]:
        """
        特定の方面の詳細時刻表を取得
        """
        if self._cache is None:
            return None
        return self._cache.detailed_timetables.get(code)

    def get_cache_info(self) -> Optional[Dict[str, Any]]:
        """
        キャッシュの情報を取得
        """
        if self._cache is None:
            return None
        return {
            "date": self._cache.date,
            "date_group": self._cache.date_group,
            "direction_count": len(self._cache.direction_list),
            "fetched_at": self._cache.fetched_at.isoformat(),
        }

    def get_train_time(self, train_id: str) -> Optional[TrainTime]:
        """
        列車番号(trainID)から時刻を検索
        """
        if self._cache is None:
            return None

        # 全方面の時刻表を走査
        for timetable in self._cache.detailed_timetables.values():
            if timetable.hour_table is None:
                continue

            for hour_table in timetable.hour_table:
                for minute_table in hour_table.minute_table:
                    if minute_table.stop.train_id == train_id:
                        return TrainTime(
                            hour=hour_table.hour, minute=minute_table.minute
                        )

        return None

    def clear(self):
        """
        キャッシュをクリア
        """
        self._cache = None
        if os.path.exists(self._cache_file):
            try:
                os.remove(self._cache_file)
            except Exception as e:
                print(f"  - キャッシュファイル削除失敗: {e}")


# グローバルキャッシュインスタンス
cache = TimeTableCache()
