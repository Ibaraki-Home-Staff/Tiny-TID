from typing import Dict, Optional, List, Any
from datetime import datetime
from models import CachedTimeTable, TimeTableSummary, TimeTable, TrainTime


class TimeTableCache:
    def __init__(self):
        self._cache: Optional[CachedTimeTable] = None

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


# グローバルキャッシュインスタンス
cache = TimeTableCache()
