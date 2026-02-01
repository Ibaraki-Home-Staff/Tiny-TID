from fastapi import APIRouter, HTTPException
from typing import Dict, List
from services.jrwest.realtime_cache import realtime_cache
from services.jrwest.realtime_models import TrainPositionData, RealtimeCacheStatus

router = APIRouter(prefix="/jrwest/realtime", tags=["jrwest-realtime"])


@router.get("/", response_model=Dict[str, TrainPositionData])
async def get_all_realtime_data():
    """
    全監視路線のリアルタイムデータを取得
    """
    data = realtime_cache.get_all_data()
    if not data:
        raise HTTPException(
            status_code=503,
            detail="リアルタイムデータが準備中です。しばらくお待ちください。",
        )
    return data


@router.get("/{line}", response_model=TrainPositionData)
async def get_line_realtime(line: str):
    """
    特定路線のリアルタイムデータを取得

    例: kyoto, hokurikubiwako, kosei, kobesanyo
    """
    data = realtime_cache.get_line_data(line)
    if data is None:
        raise HTTPException(
            status_code=404,
            detail=f"路線 '{line}' のリアルタイムデータが見つかりません。",
        )
    return data


@router.get("/status", response_model=RealtimeCacheStatus)
async def get_realtime_status():
    """
    リアルタイムデータの取得状態を確認
    """
    from config import get_settings

    settings = get_settings()
    status = realtime_cache.get_all_status(settings.wjrc_area)
    return status
