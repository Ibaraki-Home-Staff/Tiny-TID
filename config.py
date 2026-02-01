from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    ekispert_api_key: str
    station_code: int = 25834  # 茨木駅

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
