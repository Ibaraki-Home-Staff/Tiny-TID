from fastapi import APIRouter, HTTPException
from typing import Dict, Any
import logging

from config import IBARAKI_STATION_CODE, IBARAKI_STATION_NAME

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/station-info")
async def get_station_info() -> Dict[str, Any]:
    """
    茨木駅の情報を取得

    Returns:
        {
            "code": "0610226",
            "name": "茨木",
            "stop_types": ["普通", "快速", "新快速"]
        }
    """
    try:
        # 茨木駅の情報（固定値）
        return {
            "code": IBARAKI_STATION_CODE,
            "name": IBARAKI_STATION_NAME,
            "stop_types": ["普通", "快速", "新快速", "特急"],
            "lines": ["JR-Kyoto", "JR-Kosei"]  # 茨木駅を通過する主要路線
        }
    except Exception as e:
        logger.error(f"Failed to get station info: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="駅情報の取得に失敗しました")
