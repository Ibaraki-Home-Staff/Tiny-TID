from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from models import TimeTableSummary, TimeTable, TimeTableCacheStatus, TrainTime
from services.timetable_cache import cache

router = APIRouter(prefix="/timetable", tags=["timetable"])


@router.get("/", response_model=List[TimeTableSummary])
async def get_timetable_directions():
    """
    駅の方面別一覧を取得
    """
    directions = cache.get_direction_list()
    if directions is None:
        raise HTTPException(
            status_code=503, detail="時刻表データが準備中です。しばらくお待ちください。"
        )
    return directions


@router.get("/detail/{code}", response_model=TimeTable)
async def get_timetable_detail(code: str):
    """
    特定の方面の詳細時刻表を取得
    """
    timetable = cache.get_detailed_timetable(code)
    if timetable is None:
        raise HTTPException(
            status_code=404,
            detail=f"指定された方面コード '{code}' の時刻表が見つかりません。",
        )
    return timetable


@router.get("/train/{line_code}", response_model=TrainTime)
async def get_train_time(line_code: str):
    """
    列車コードから時刻を取得
    """
    train_time = cache.get_train_time(line_code)
    if train_time is None:
        raise HTTPException(
            status_code=404,
            detail=f"指定された列車コード '{line_code}' の時刻が見つかりません。",
        )
    return train_time


@router.get("/status", response_model=TimeTableCacheStatus)
async def get_cache_status():
    """
    キャッシュの状態を確認
    """
    info = cache.get_cache_info()
    if info is None:
        raise HTTPException(status_code=503, detail="時刻表データが準備中です。")
    return TimeTableCacheStatus(**info)
