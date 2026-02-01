from fastapi import APIRouter, HTTPException
from typing import Dict, List
from config import get_settings
from services.jrwest.realtime_cache import realtime_cache
from services.jrwest.realtime_models import TrainPositionData, RealtimeCacheStatus
from services.jrwest.station_graph import (
    build_station_graph_multi_area,
    format_position,
)

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

    # 駅グラフを取得してposを整形
    settings = get_settings()
    base_station = settings.wjrc_stcode
    target_lines = settings.wjrc_line.split(",") if settings.wjrc_line else []
    areas = settings.wjrc_areas  # 複数エリア対応

    if base_station and target_lines:
        graph = build_station_graph_multi_area(base_station, target_lines, areas)
        if graph:
            # 各列車のposition_textを設定
            for line_id, line_data in data.items():
                for train in line_data.trains:
                    train.position_text = format_position(train.pos, graph)

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

    # 駅グラフを取得してposを整形
    settings = get_settings()
    base_station = settings.wjrc_stcode
    target_lines = settings.wjrc_line.split(",") if settings.wjrc_line else []
    areas = settings.wjrc_areas  # 複数エリア対応

    if base_station and target_lines:
        graph = build_station_graph_multi_area(base_station, target_lines, areas)
        if graph:
            # 各列車のposition_textを設定
            for train in data.trains:
                train.position_text = format_position(train.pos, graph)

    return data


@router.get("/status", response_model=RealtimeCacheStatus)
async def get_realtime_status():
    """
    リアルタイムデータの取得状態を確認
    """
    from config import get_settings

    settings = get_settings()
    # 複数エリアの場合は最初のエリアを使用（ステータス表示用）
    area = settings.wjrc_areas[0] if settings.wjrc_areas else "unknown"
    status = realtime_cache.get_all_status(area)
    return status
