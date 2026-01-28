from fastapi import APIRouter, HTTPException
from typing import Dict, Any
import logging

from services.aggregator import aggregate_ibaraki_trains

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/trains")
async def get_ibaraki_trains() -> Dict[str, Any]:
    """
    茨木駅を通過する列車の一覧を取得

    Returns:
        {
            "station_code": "0610226",
            "station_name": "茨木",
            "updated_at": "ISO8601",
            "trains": [...]
        }
    """
    try:
        result = await aggregate_ibaraki_trains()
        return result
    except Exception as e:
        logger.error(f"Failed to get trains: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="列車データの取得に失敗しました")
