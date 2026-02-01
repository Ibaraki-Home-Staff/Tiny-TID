from pydantic import BaseModel, Field, field_validator
from typing import Dict, List, Optional, Union
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
    nickname: str = ""  # 列車愛称
    type: str = ""  # 種別コード
    display_type: str = Field(default="", alias="displayType")  # 表示種別
    dest: Union[TrainDestination, str, None] = (
        None  # 行き先（エリアによって形式が異なる）
    )
    via: str = ""  # 経由
    delay_minutes: int = Field(default=0, alias="delayMinutes")  # 遅延（分）
    a_seat_info: str = ""  # A席情報
    type_change: str = ""  # 種別変更情報
    number_of_cars: int = 0  # 両数
    stop_time: str = ""  # 停車時刻
    icon_id: str = ""  # アイコンID

    @field_validator("nickname", mode="before")
    @classmethod
    def convert_nickname(cls, v):
        """愛称を文字列に変換（リストの場合は最初の要素を使用）"""
        if isinstance(v, list):
            return v[0] if v else ""
        if v is None:
            return ""
        return str(v)

    @field_validator("dest", mode="before")
    @classmethod
    def convert_dest(cls, v):
        """行先を適切な形式に変換"""
        if v is None:
            return None
        if isinstance(v, str):
            # 文字列の場合は駅名として扱う（コードは空）
            return TrainDestination(text=v, code="", line="")
        return v

    @property
    def dest_text(self) -> str:
        """行先テキストを取得"""
        if isinstance(self.dest, TrainDestination):
            return self.dest.text
        if isinstance(self.dest, str):
            return self.dest
        return ""

    @property
    def dest_code(self) -> str:
        """行先コードを取得"""
        if isinstance(self.dest, TrainDestination):
            return self.dest.code
        return ""


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
