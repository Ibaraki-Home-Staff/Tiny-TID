import json
import os
from typing import Dict, Optional, List
from datetime import datetime
from .models import (
    AreaData,
    CachedJRWestData,
    JRWestCacheStatus,
    Station,
    StationSearchResult,
    StationInArea,
)
from config import get_settings


class JRWestCache:
    def __init__(self):
        self._cache: Optional[CachedJRWestData] = None
        self._cache_file = None
        self._ensure_cache_dir()

    def _ensure_cache_dir(self):
        """キャッシュディレクトリを作成"""
        settings = get_settings()
        cache_dir = settings.cache_dir
        if not os.path.exists(cache_dir):
            os.makedirs(cache_dir)
        self._cache_file = os.path.join(cache_dir, "jrwest_cache.json")

    def _serialize_area_data(self, area_data: AreaData) -> dict:
        """AreaDataをシリアライズ"""
        return {
            "master": area_data.master.model_dump(),
            "stations": {k: v.model_dump() for k, v in area_data.stations.items()},
        }

    def _deserialize_area_data(self, data: dict) -> AreaData:
        """AreaDataをデシリアライズ"""
        from .models import AreaMaster, StationList

        return AreaData(
            master=AreaMaster(**data["master"]),
            stations={k: StationList(**v) for k, v in data["stations"].items()},
        )

    def _save_to_file(self):
        """キャッシュをファイルに保存"""
        if self._cache is None:
            return

        try:
            data = {
                "areas": {
                    k: self._serialize_area_data(v)
                    for k, v in self._cache.areas.items()
                },
                "fetched_at": self._cache.fetched_at.isoformat(),
            }
            with open(self._cache_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"  - JR西日本キャッシュをファイルに保存しました: {self._cache_file}")
        except Exception as e:
            print(f"  - JR西日本キャッシュファイル保存失敗: {e}")

    def load_from_file(self) -> bool:
        """キャッシュをファイルから読み込み"""
        if not os.path.exists(self._cache_file):
            return False

        try:
            with open(self._cache_file, "r", encoding="utf-8") as f:
                data = json.load(f)

            areas = {
                k: self._deserialize_area_data(v) for k, v in data["areas"].items()
            }

            self._cache = CachedJRWestData(
                areas=areas, fetched_at=datetime.fromisoformat(data["fetched_at"])
            )
            print(
                f"  - JR西日本キャッシュをファイルから読み込みました: {self._cache_file}"
            )
            return True
        except Exception as e:
            print(f"  - JR西日本キャッシュファイル読み込み失敗: {e}")
            return False

    def update(self, areas: Dict[str, AreaData]):
        """
        キャッシュを更新
        """
        self._cache = CachedJRWestData(areas=areas, fetched_at=datetime.now())
        # ファイルに保存
        self._save_to_file()

    def get_area(self, area: str) -> Optional[AreaData]:
        """
        特定エリアのデータを取得
        """
        if self._cache is None:
            return None
        return self._cache.areas.get(area)

    def get_all_areas(self) -> Optional[Dict[str, AreaData]]:
        """
        全エリアのデータを取得
        """
        if self._cache is None:
            return None
        return self._cache.areas

    def search_station_by_code(
        self, station_code: str
    ) -> Optional[StationSearchResult]:
        """
        駅コードで全エリアから駅を検索
        """
        if self._cache is None:
            return None

        result_areas = []
        station_name = None

        for area_id, area_data in self._cache.areas.items():
            for line_id, station_list in area_data.stations.items():
                line_info = area_data.master.lines.get(line_id)
                if not line_info:
                    continue

                for station in station_list.stations:
                    if station.info.code == station_code:
                        if station_name is None:
                            station_name = station.info.name

                        result_areas.append(
                            StationInArea(
                                area=area_id,
                                line=line_id,
                                line_name=line_info.name,
                                station=station,
                            )
                        )

        if not result_areas:
            return None

        return StationSearchResult(
            station_code=station_code,
            station_name=station_name or "",
            areas=result_areas,
        )

    def search_station_in_area(self, area: str, station_code: str) -> Optional[Station]:
        """
        特定エリア内で駅コードを検索
        """
        if self._cache is None:
            return None

        area_data = self._cache.areas.get(area)
        if not area_data:
            return None

        for line_id, station_list in area_data.stations.items():
            for station in station_list.stations:
                if station.info.code == station_code:
                    return station

        return None

    def get_cache_info(self) -> Optional[JRWestCacheStatus]:
        """
        キャッシュ情報を取得
        """
        if self._cache is None:
            return None

        total_lines = 0
        total_stations = 0

        for area_data in self._cache.areas.values():
            total_lines += len(area_data.stations)
            for station_list in area_data.stations.values():
                total_stations += len(station_list.stations)

        return JRWestCacheStatus(
            area_count=len(self._cache.areas),
            areas=list(self._cache.areas.keys()),
            total_lines=total_lines,
            total_stations=total_stations,
            fetched_at=self._cache.fetched_at,
        )

    def clear(self):
        """
        キャッシュをクリア
        """
        self._cache = None
        if os.path.exists(self._cache_file):
            try:
                os.remove(self._cache_file)
            except Exception as e:
                print(f"  - JR西日本キャッシュファイル削除失敗: {e}")


# グローバルキャッシュインスタンス
cache = JRWestCache()
