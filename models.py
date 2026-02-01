from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class Station(BaseModel):
    name: str = Field(..., alias="Name")


class LineInfo(BaseModel):
    name: str = Field(..., alias="Name")
    direction: Optional[str] = Field(None, alias="Direction")
    source: Optional[str] = Field(None, alias="Source")
    color: Optional[str] = Field(None, alias="Color")


class Stop(BaseModel):
    kind_code: str = Field(..., alias="kindCode")
    platform_no: Optional[str] = Field(None, alias="platformNo")
    line_code: str = Field(..., alias="lineCode")
    train_id: Optional[str] = Field(None, alias="trainID")
    name_code: str = Field(..., alias="nameCode")
    destination_code: str = Field(..., alias="destinationCode")
    extra: Optional[bool] = None


class MinuteTable(BaseModel):
    minute: str = Field(..., alias="Minute")
    stop: Stop = Field(..., alias="Stop")


class HourTable(BaseModel):
    hour: str = Field(..., alias="Hour")
    time_reliability: Optional[str] = Field(None, alias="TimeReliability")
    pre_cautional_comment: Optional[str] = Field(None, alias="PreCautionalComment")
    minute_table: List[MinuteTable] = Field(default_factory=list, alias="MinuteTable")


class LineDestination(BaseModel):
    code: str
    mark: Optional[str] = Field(None, alias="Mark")
    text: Optional[str] = None


class LineKind(BaseModel):
    code: str
    mark: Optional[str] = Field(None, alias="Mark")
    text: Optional[str] = None


class LineName(BaseModel):
    code: str
    mark: Optional[str] = Field(None, alias="Mark")
    text: Optional[str] = None


class TimeTable(BaseModel):
    code: str
    date_group: str = Field(..., alias="dateGroup")
    train_count: str = Field(..., alias="trainCount")
    station: Station = Field(..., alias="Station")
    line: LineInfo = Field(..., alias="Line")
    hour_table: Optional[List[HourTable]] = Field(None, alias="HourTable")
    line_destination: Optional[List[LineDestination]] = Field(
        None, alias="LineDestination"
    )
    line_kind: Optional[LineKind] = Field(None, alias="LineKind")
    line_name: Optional[LineName] = Field(None, alias="LineName")


class TimeTableSummary(BaseModel):
    code: str
    date_group: str = Field(..., alias="dateGroup")
    train_count: str = Field(..., alias="trainCount")
    station: Station = Field(..., alias="Station")
    line: LineInfo = Field(..., alias="Line")


class ResultSet(BaseModel):
    api_version: str = Field(..., alias="apiVersion")
    engine_version: str = Field(..., alias="engineVersion")
    time_table: TimeTable = Field(..., alias="TimeTable")


class TimeTableResponse(BaseModel):
    result_set: ResultSet = Field(..., alias="ResultSet")


class CachedTimeTable(BaseModel):
    date: str
    date_group: str
    direction_list: List[TimeTableSummary]
    detailed_timetables: Dict[str, TimeTable]
    fetched_at: datetime


class TimeTableCacheStatus(BaseModel):
    date: str
    date_group: str
    direction_count: int
    fetched_at: datetime


class TrainTime(BaseModel):
    hour: str
    minute: str
