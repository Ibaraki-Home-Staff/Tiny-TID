from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import List


class Settings(BaseSettings):
    # 駅すぱあとAPI設定
    ekispert_api_key: str = "dummy_key_for_initial_fetch"
    station_code: int = 25834  # デフォルト: 茨木駅

    # キャッシュ設定
    cache_dir: str = "./cache"

    # JR西日本リアルタイム設定
    wjrc_area: str = "kinki"  # カンマ区切りで複数指定可能: "kinki,hokuriku"
    wjrc_line: str = "kyoto,hokurikubiwako,kosei,kobesanyo"
    wjrc_stcode: str = ""  # 起点駅コード
    wjrc_polling_interval: int = 10  # 秒
    wjrc_line_interval: float = 2.0  # 秒

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    @property
    def wjrc_areas(self) -> List[str]:
        """複数エリアをリストで返す"""
        return [a.strip() for a in self.wjrc_area.split(",") if a.strip()]


@lru_cache()
def get_settings() -> Settings:
    return Settings()
