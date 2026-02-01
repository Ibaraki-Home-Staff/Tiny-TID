from fastapi import APIRouter, HTTPException
from typing import Optional, Dict, Any
from models import StationTrainData, StationTrainCacheStatus
from services.station_train_merger import (
    load_station_train_data,
    get_cache_status,
    generate_and_cache,
)
from config import get_settings

router = APIRouter(prefix="/api/station-trains", tags=["station-trains"])


@router.get("/", response_model=StationTrainData)
async def get_station_trains():
    """
    指定駅の統合列車データを取得

    WJRC_STCODEで指定された駅の、WJRC_LINE内の全列車情報を
    JR西日本リアルタイムデータと駅すぱあと時刻表データを統合して返す
    """
    settings = get_settings()
    data = load_station_train_data(settings.cache_dir)

    if data is None:
        raise HTTPException(
            status_code=503,
            detail="駅列車データが準備中です。しばらくお待ちください。",
        )

    # Pydanticモデルに変換
    return StationTrainData(**data)


@router.get("/refresh", response_model=StationTrainData)
async def refresh_station_trains():
    """
    駅列車データを強制再生成

    リアルタイムデータを即座に取得し、統合データを再生成する
    """
    data = generate_and_cache()

    if data is None:
        raise HTTPException(
            status_code=503,
            detail="駅列車データの生成に失敗しました。",
        )

    return StationTrainData(**data)


@router.get("/status", response_model=StationTrainCacheStatus)
async def get_station_trains_status():
    """
    駅列車データのステータスを確認

    最終生成時刻、列車件数などの情報を返す
    """
    settings = get_settings()
    status = get_cache_status(settings.cache_dir)

    if status is None:
        raise HTTPException(
            status_code=503,
            detail="駅列車データが準備中です。",
        )

    return StationTrainCacheStatus(**status)


@router.get("/raw")
async def get_station_trains_raw():
    """
    生のJSONデータを取得（デバッグ用）
    """
    settings = get_settings()
    data = load_station_train_data(settings.cache_dir)

    if data is None:
        raise HTTPException(
            status_code=503,
            detail="駅列車データが準備中です。",
        )

    return data
