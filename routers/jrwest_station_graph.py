"""
駅グラフAPI
起点駅を中心とした路線・駅の方向関係を提供
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, List, Any, Optional
from pydantic import BaseModel
from config import get_settings
from services.jrwest import cache
from services.jrwest.station_graph import (
    build_station_graph_multi_area,
    get_train_direction_from_graph,
    format_position,
)
from typing import Optional

router = APIRouter(prefix="/jrwest/station-graph", tags=["jrwest-station-graph"])


class StationTransfer(BaseModel):
    name: str
    code: str
    link: Optional[str]
    link_code: Optional[str]


class StationNodeResponse(BaseModel):
    code: str
    name: str
    line_id: str
    line_name: str
    distance_from_base: Optional[int]
    direction_from_base: str
    is_base_station: bool
    transfers: List[StationTransfer]
    stop_trains: List[str]
    distances_by_parent: Optional[Dict[str, int]] = None  # 親路線ごとの距離値


class LineDirection(BaseModel):
    upper: str
    lower: str


class LineSegmentResponse(BaseModel):
    line_id: str
    line_name: str
    line_range: str
    direction: LineDirection
    stations: List[StationNodeResponse]
    source_lines: List[str] = []  # 統合元の路線IDリスト


class BaseStationInfo(BaseModel):
    code: str
    name: str
    line_id: str
    line_name: str


class StationGraphResponse(BaseModel):
    base_station: BaseStationInfo
    lines: List[LineSegmentResponse]


class TrainWithDirection(BaseModel):
    pos: str
    position_text: str  # 「駅A → 駅B」の形式
    direction: str  # "upper", "lower", "stopped", "unknown"
    raw_direction: str  # APIから返ってきた元のdirection値
    delay: int
    display: str
    dest: str


class LineRealtimeWithDirection(BaseModel):
    line_id: str
    line_name: str
    trains: List[TrainWithDirection]


class StationGraphRealtimeResponse(BaseModel):
    base_station: BaseStationInfo
    lines: List[LineRealtimeWithDirection]
    generated_at: str


def convert_to_response(graph) -> StationGraphResponse:
    """内部モデルをレスポンスモデルに変換"""
    return StationGraphResponse(
        base_station=BaseStationInfo(**graph.base_station),
        lines=[
            LineSegmentResponse(
                line_id=line.line_id,
                line_name=line.line_name,
                line_range=line.line_range,
                direction=LineDirection(**line.direction),
                stations=[
                    StationNodeResponse(
                        code=station.code,
                        name=station.name,
                        line_id=station.line_id,
                        line_name=station.line_name,
                        distance_from_base=station.distance_from_base,
                        direction_from_base=station.direction_from_base,
                        is_base_station=station.is_base_station,
                        transfers=[StationTransfer(**t) for t in station.transfers],
                        stop_trains=station.stop_trains,
                        distances_by_parent=station.distances_by_parent,
                    )
                    for station in line.stations
                ],
                source_lines=line.source_lines if line.source_lines else [line.line_id],
            )
            for line in graph.lines
        ],
    )


@router.get("/", response_model=StationGraphResponse)
async def get_station_graph():
    """
    起点駅を中心とした駅グラフを取得

    WJRC_STCODEで設定された駅を起点に、WJRC_LINEで設定された路線の
    駅配置と方向関係を返します。
    """
    settings = get_settings()

    # 設定値を取得
    base_station = settings.wjrc_stcode
    target_lines = settings.wjrc_line.split(",") if settings.wjrc_line else []
    areas = settings.wjrc_areas  # 複数エリア対応

    if not base_station or not target_lines:
        raise HTTPException(
            status_code=400,
            detail="設定が不完全です。WJRC_STCODEとWJRC_LINEを設定してください。",
        )

    # キャッシュが準備できているか確認（最初のエリアで確認）
    if not areas:
        raise HTTPException(
            status_code=503,
            detail="JR西日本データが準備中です。しばらくお待ちください。",
        )

    # 駅グラフを構築（複数エリア対応）
    graph = build_station_graph_multi_area(base_station, target_lines, areas)
    if not graph:
        raise HTTPException(
            status_code=404, detail=f"起点駅コード '{base_station}' が見つかりません。"
        )

    return convert_to_response(graph)


@router.get("/realtime", response_model=StationGraphRealtimeResponse)
async def get_station_graph_realtime():
    """
    駅グラフに基づいたリアルタイム列車情報

    起点駅から見た上り/下り方向を判定した列車位置情報を返します。
    """
    settings = get_settings()

    # 設定値を取得
    base_station = settings.wjrc_stcode
    target_lines = settings.wjrc_line.split(",") if settings.wjrc_line else []
    areas = settings.wjrc_areas  # 複数エリア対応

    if not base_station or not target_lines:
        raise HTTPException(
            status_code=400,
            detail="設定が不完全です。WJRC_STCODEとWJRC_LINEを設定してください。",
        )

    # 駅グラフを構築（複数エリア対応）
    graph = build_station_graph_multi_area(base_station, target_lines, areas)
    if not graph:
        raise HTTPException(
            status_code=404, detail=f"起点駅コード '{base_station}' が見つかりません。"
        )

    # リアルタイムデータを取得
    from services.jrwest.realtime_cache import get_all_realtime_data

    realtime_data = get_all_realtime_data()

    lines_with_trains = []
    for line_id in target_lines:
        if line_id not in realtime_data:
            continue

        line_data = realtime_data[line_id]
        line_name = line_data.get("line_name", line_id)
        trains = line_data.get("trains", [])

        trains_with_direction = []
        for train in trains:
            pos = train.get("pos", "")
            raw_direction = train.get("direction", "")

            # 駅グラフに基づいて方向を判定（列車の路線IDを優先）
            calculated_direction = get_train_direction_from_graph(
                pos, graph, preferred_line_id=line_id
            )

            # posを整形して人間が読める形式に（進行方向に応じた順序）
            direction_int = train.get("direction", 0)
            position_text = format_position(
                pos, graph, direction_int, preferred_line_id=line_id
            )

            trains_with_direction.append(
                TrainWithDirection(
                    pos=pos,
                    position_text=position_text,
                    direction=calculated_direction or "unknown",
                    raw_direction=raw_direction,
                    delay=train.get("delay", 0),
                    display=train.get("display", ""),
                    dest=train.get("dest", ""),
                )
            )

        lines_with_trains.append(
            LineRealtimeWithDirection(
                line_id=line_id, line_name=line_name, trains=trains_with_direction
            )
        )

    from datetime import datetime

    return StationGraphRealtimeResponse(
        base_station=BaseStationInfo(**graph.base_station),
        lines=lines_with_trains,
        generated_at=datetime.now().isoformat(),
    )


@router.get("/direction/{pos}", response_model=Dict[str, str])
async def get_direction_for_position(pos: str):
    """
    特定の列車位置（pos）から方向を判定

    - **pos**: 列車位置コード（例：0415_0416、0415_####）

    Returns:
        - direction: "upper"（上り）、"lower"（下り）、"stopped"（停車中）、"unknown"（不明）
        - description: 人間が読める説明
    """
    settings = get_settings()
    base_station = settings.wjrc_stcode
    target_lines = settings.wjrc_line.split(",") if settings.wjrc_line else []
    areas = settings.wjrc_areas  # 複数エリア対応

    if not base_station:
        raise HTTPException(status_code=400, detail="WJRC_STCODEが設定されていません。")

    graph = build_station_graph_multi_area(base_station, target_lines, areas)
    if not graph:
        raise HTTPException(status_code=404, detail="駅グラフが構築できません。")

    direction = get_train_direction_from_graph(pos, graph)

    descriptions = {
        "upper": "起点駅に近づいているか、上り方向に走行中",
        "lower": "起点駅から離れているか、下り方向に走行中",
        "stopped": "起点駅に停車中",
        "unknown": "方向を判定できません",
    }

    return {
        "pos": pos,
        "direction": direction or "unknown",
        "description": descriptions.get(direction, "不明"),
    }
