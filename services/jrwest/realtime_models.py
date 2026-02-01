from pydantic import BaseModel, Field
from typing import Dict, List, Optional
from datetime import datetime


class TrainDestination(BaseModel):
    text: str
    code: str
    line: str


class TrainInfo(BaseModel):
    no: str  # 列車番号
    pos: str  # 位置（駅コード_次の駅コード、####は区間内）
    position_text: str = ""  # 「駅A → 駅B」の整形済み位置情報
    direction: int  # 0=上り、1=下り
    nickname: str  # 列車愛称
    type: str  # 種別コード
    display_type: str = Field(..., alias="displayType")  # 表示種別
    dest: TrainDestination  # 行き先
    via: str  # 経由
    delay_minutes: int = Field(..., alias="delayMinutes")  # 遅延（分）
    a_seat_info: str = Field(..., alias="aSeatInfo")  # A席情報
    type_change: str = Field(..., alias="typeChange")  # 種別変更情報
    number_of_cars: int = Field(..., alias="numberOfCars")  # 両数
    stop_time: str = Field(..., alias="stopTime")  # 停車時刻
    icon_id: str = Field(..., alias="iconId")  # アイコンID


class TrainPositionData(BaseModel):
    update: datetime  # データ更新時刻
    trains: List[TrainInfo]


class LineRealtimeStatus(BaseModel):
    line: str
    line_name: str
    last_update: Optional[datetime]
    train_count: int
    consecutive_failures: int  # 連続失敗回数
    last_error: Optional[str]


class RealtimeCacheStatus(BaseModel):
    area: str
    lines: List[LineRealtimeStatus]
    total_trains: int
    last_update: datetime
