from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # 駅すぱあとAPI設定
    ekispert_api_key: str = "dummy_key_for_initial_fetch"
    station_code: int = 25834  # デフォルト: 茨木駅

    # キャッシュ設定
    cache_dir: str = "./cache"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
