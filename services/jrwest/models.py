from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any
from datetime import datetime

# 停車列車種別テーブル
# stopTrains のインデックスと列車種別の対応
# null または [] の場合は "普通列車"（各駅停車）
STOP_TRAIN_TYPES = {
    0: "",  # null時は強制的に0番（普通列車）
    1: "新快速",
    2: "快速",
    3: "区間快速",
    4: "直通快速",
    5: "特急",
    6: "急行",
    7: "寝台",
    8: "SL",
    9: "観光列車",
    10: "瑞風",
}


def get_stop_train_names(stop_trains: Optional[List[int]]) -> List[str]:
    """
    stopTrainsのインデックスリストから列車種別名のリストを取得
    """
    if stop_trains is None or stop_trains == []:
        return ["普通"]

    return [STOP_TRAIN_TYPES.get(i, "") for i in stop_trains if i in STOP_TRAIN_TYPES]


class LineDestination(BaseModel):
    upper: str
    lower: str


class LineInfo(BaseModel):
    name: str
    range: str
    st: str  # 駅一覧URL
    pos: str  # 列車位置URL
    index: int
    dest: LineDestination
    relatelines: Optional[List[str]] = None


class TrafficInfo(BaseModel):
    url: str


class DelayText(BaseModel):
    from_val: Optional[int] = Field(None, alias="from")
    to: Optional[int] = None
    display: int


class NoUpdateAlert(BaseModel):
    current_time: str = Field(..., alias="currentTime")
    threshold_minutes: int = Field(..., alias="thresholdMinutes")


class TrainMonitorInfo(BaseModel):
    info: str
    current_time: str = Field(..., alias="currentTime")
    threshold_seconds: int = Field(..., alias="thresholdSeconds")


class LongTimeStoppingThreshold(BaseModel):
    inside: int
    between: int


class LongTimeStoppingInfo(BaseModel):
    current_time: str = Field(..., alias="currentTime")
    threshold_minutes: LongTimeStoppingThreshold = Field(..., alias="thresholdMinutes")


class TransferInfo(BaseModel):
    name: str
    type: int
    code: str
    link: Optional[str] = None
    link_code: Optional[str] = Field(None, alias="linkCode")


class StationInfo(BaseModel):
    name: str
    code: str
    stop_trains: Optional[List[int]] = Field(None, alias="stopTrains")
    type_notice: Optional[str] = Field(None, alias="typeNotice")
    transfer: Optional[List[TransferInfo]] = None
    line: Optional[str] = None
    pair_display: Optional[Any] = Field(None, alias="pairDisplay")
    lines: Optional[Any] = None


class StationDesign(BaseModel):
    mark: Optional[str] = None
    upside: Optional[List[Dict[str, Any]]] = None
    downside: Optional[List[Dict[str, Any]]] = None


class Station(BaseModel):
    info: StationInfo
    design: StationDesign


class StationList(BaseModel):
    stations: List[Station]


class AreaMaster(BaseModel):
    lines: Dict[str, LineInfo]
    traffic_info: Optional[TrafficInfo] = Field(None, alias="trafficInfo")
    delay_text: Optional[List[DelayText]] = Field(None, alias="delayText")
    no_update_alert: Optional[NoUpdateAlert] = Field(None, alias="noUpdateAlert")
    trainmonitorinfo_lines: Optional[Dict[str, TrainMonitorInfo]] = Field(
        None, alias="trainmonitorinfoLines"
    )
    long_time_stopping_info: Optional[Dict[str, LongTimeStoppingInfo]] = Field(
        None, alias="longTimeStoppingInfo"
    )


class AreaData(BaseModel):
    master: AreaMaster
    stations: Dict[str, StationList]  # line_id -> StationList


class CachedJRWestData(BaseModel):
    areas: Dict[str, AreaData]
    fetched_at: datetime


class JRWestCacheStatus(BaseModel):
    area_count: int
    areas: List[str]
    total_lines: int
    total_stations: int
    fetched_at: datetime


class StationInArea(BaseModel):
    area: str
    line: str
    line_name: str
    station: Station


class StationSearchResult(BaseModel):
    station_code: str
    station_name: str
    areas: List[StationInArea]
