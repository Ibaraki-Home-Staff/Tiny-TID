from typing import Dict, Optional, List
from datetime import datetime
from .realtime_models import TrainPositionData, LineRealtimeStatus, RealtimeCacheStatus


class JRWestRealtimeCache:
    def __init__(self):
        self._cache: Dict[str, TrainPositionData] = {}
        self._status: Dict[str, LineRealtimeStatus] = {}
        self._consecutive_failures: Dict[str, int] = {}

    def update_line(
        self, line_id: str, line_name: str, data: Optional[TrainPositionData]
    ):
        """
        路線のリアルタイムデータを更新
        """
        if data:
            # 取得成功
            self._cache[line_id] = data
            self._consecutive_failures[line_id] = 0
            self._status[line_id] = LineRealtimeStatus(
                line=line_id,
                line_name=line_name,
                last_update=data.update,
                train_count=len(data.trains),
                consecutive_failures=0,
                last_error=None,
            )
        else:
            # 取得失敗
            failures = self._consecutive_failures.get(line_id, 0) + 1
            self._consecutive_failures[line_id] = failures

            # ステータス更新
            if line_id in self._status:
                self._status[line_id].consecutive_failures = failures
                self._status[line_id].last_error = f"連続{failures}回失敗"

            # 連続失敗警告
            if failures >= 3:
                print(f"  [警告] 路線 {line_id} が連続{failures}回取得失敗しました")

    def get_line_data(self, line_id: str) -> Optional[TrainPositionData]:
        """
        特定路線のリアルタイムデータを取得
        """
        return self._cache.get(line_id)

    def get_all_data(self) -> Dict[str, TrainPositionData]:
        """
        全路線のリアルタイムデータを取得
        """
        return self._cache.copy()

    def get_line_status(self, line_id: str) -> Optional[LineRealtimeStatus]:
        """
        特定路線のステータスを取得
        """
        return self._status.get(line_id)

    def get_all_status(self, area: str) -> RealtimeCacheStatus:
        """
        全路線のステータスを取得
        """
        lines = list(self._status.values())
        total_trains = sum(line.train_count for line in lines)
        last_update = max(
            (line.last_update for line in lines if line.last_update),
            default=datetime.now(),
        )

        return RealtimeCacheStatus(
            area=area, lines=lines, total_trains=total_trains, last_update=last_update
        )

    def clear(self):
        """
        キャッシュをクリア
        """
        self._cache.clear()
        self._status.clear()
        self._consecutive_failures.clear()


# グローバルキャッシュインスタンス
realtime_cache = JRWestRealtimeCache()
