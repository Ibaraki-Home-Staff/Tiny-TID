from typing import Dict, Optional, List
from datetime import datetime
from .models import AreaMaster, CachedJRWestData, JRWestCacheStatus


class JRWestCache:
    def __init__(self):
        self._cache: Optional[CachedJRWestData] = None

    def update(self, areas: Dict[str, AreaMaster]):
        """
        キャッシュを更新
        """
        self._cache = CachedJRWestData(areas=areas, fetched_at=datetime.now())

    def get_area(self, area: str) -> Optional[AreaMaster]:
        """
        特定エリアのデータを取得
        """
        if self._cache is None:
            return None
        return self._cache.areas.get(area)

    def get_all_areas(self) -> Optional[Dict[str, AreaMaster]]:
        """
        全エリアのデータを取得
        """
        if self._cache is None:
            return None
        return self._cache.areas

    def get_cache_info(self) -> Optional[JRWestCacheStatus]:
        """
        キャッシュ情報を取得
        """
        if self._cache is None:
            return None
        return JRWestCacheStatus(
            area_count=len(self._cache.areas),
            areas=list(self._cache.areas.keys()),
            fetched_at=self._cache.fetched_at,
        )

    def clear(self):
        """
        キャッシュをクリア
        """
        self._cache = None


# グローバルキャッシュインスタンス
cache = JRWestCache()
