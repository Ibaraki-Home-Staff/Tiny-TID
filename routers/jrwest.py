from fastapi import APIRouter, HTTPException
from typing import Dict, List
from services.jrwest import cache
from services.jrwest.models import AreaMaster, JRWestCacheStatus

router = APIRouter(prefix="/jrwest", tags=["jrwest"])


@router.get("/", response_model=Dict[str, AreaMaster])
async def get_all_areas():
    """
    全エリアの路線マスターデータを取得
    """
    areas = cache.get_all_areas()
    if areas is None:
        raise HTTPException(
            status_code=503,
            detail="JR西日本データが準備中です。しばらくお待ちください。",
        )
    return areas


@router.get("/{area}", response_model=AreaMaster)
async def get_area(area: str):
    """
    特定エリアの路線マスターデータを取得

    対応エリア: kinki, hokuriku, okayama, hiroshima, sanin
    """
    area_data = cache.get_area(area)
    if area_data is None:
        raise HTTPException(
            status_code=404,
            detail=f"指定されたエリア '{area}' のデータが見つかりません。",
        )
    return area_data


@router.get("/status", response_model=JRWestCacheStatus)
async def get_cache_status():
    """
    キャッシュの状態を確認
    """
    info = cache.get_cache_info()
    if info is None:
        raise HTTPException(status_code=503, detail="JR西日本データが準備中です。")
    return info
