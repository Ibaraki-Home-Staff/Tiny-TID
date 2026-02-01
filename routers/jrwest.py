from fastapi import APIRouter, HTTPException
from typing import Dict
from services.jrwest import cache
from services.jrwest.models import (
    AreaData,
    Station,
    StationSearchResult,
    JRWestCacheStatus,
)

router = APIRouter(prefix="/jrwest", tags=["jrwest"])


@router.get("/", response_model=Dict[str, AreaData])
async def get_all_areas():
    """
    全エリアの路線・駅データを取得
    """
    areas = cache.get_all_areas()
    if areas is None:
        raise HTTPException(
            status_code=503,
            detail="JR西日本データが準備中です。しばらくお待ちください。",
        )
    return areas


@router.get("/{area}", response_model=AreaData)
async def get_area(area: str):
    """
    特定エリアの路線・駅データを取得

    対応エリア: kinki, hokuriku, okayama, hiroshima, sanin
    """
    area_data = cache.get_area(area)
    if area_data is None:
        raise HTTPException(
            status_code=404,
            detail=f"指定されたエリア '{area}' のデータが見つかりません。",
        )
    return area_data


@router.get("/station/{station_code}", response_model=StationSearchResult)
async def search_station(station_code: str):
    """
    駅コードで全エリアから駅を検索

    同一エリア内でのみ駅コードはユニークです
    """
    result = cache.search_station_by_code(station_code)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"指定された駅コード '{station_code}' の駅が見つかりません。",
        )
    return result


@router.get("/{area}/station/{station_code}", response_model=Station)
async def get_station_in_area(area: str, station_code: str):
    """
    特定エリア内で駅コードを検索

    対応エリア: kinki, hokuriku, okayama, hiroshima, sanin
    """
    station = cache.search_station_in_area(area, station_code)
    if station is None:
        raise HTTPException(
            status_code=404,
            detail=f"指定されたエリア '{area}' に駅コード '{station_code}' の駅が見つかりません。",
        )
    return station


@router.get("/status", response_model=JRWestCacheStatus)
async def get_cache_status():
    """
    キャッシュの状態を確認
    """
    info = cache.get_cache_info()
    if info is None:
        raise HTTPException(status_code=503, detail="JR西日本データが準備中です。")
    return info
