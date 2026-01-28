from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List
import logging

from config import KINKI_LINES
from services.aggregator import fetch_kinki_area_master

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/lines")
async def get_ibaraki_lines() -> Dict[str, Any]:
    """
    茨木駅を通過する路線の一覧を取得

    Returns:
        {
            "lines": [
                {"id": "JR-Kyoto", "name": "JR京都線"},
                ...
            ]
        }
    """
    try:
        master = await fetch_kinki_area_master()
        if not master or "lines" not in master:
            return {"lines": []}

        lines_info = master["lines"]
        result_lines: List[Dict[str, str]] = []

        for line_id in KINKI_LINES:
            line_data = lines_info.get(line_id)
            if line_data:
                result_lines.append({
                    "id": line_id,
                    "name": line_data.get("name", line_id),
                })

        return {"lines": result_lines}

    except Exception as e:
        logger.error(f"Failed to get lines: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="路線データの取得に失敗しました")
