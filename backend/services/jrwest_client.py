import httpx
from typing import Dict, Any, Optional, List
import logging

logger = logging.getLogger(__name__)


class JRWestAPIClient:
    """JR西日本 Train Guide API クライアント"""

    def __init__(self, base_url: str = "https://www.train-guide.westjr.co.jp/api/v3/"):
        self.base_url = base_url
        self.timeout = httpx.Timeout(10.0, connect=5.0)

    async def fetch_area_master(self, area: str) -> Optional[Dict[str, Any]]:
        """エリアマスターデータを取得"""
        url = f"{self.base_url}area_{area}_master.json"
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url)
                response.raise_for_status()
                return response.json()
        except httpx.HTTPError as e:
            logger.error(f"Failed to fetch area master for {area}: {e}")
            return None

    async def fetch_line_positions(self, line_id: str) -> Optional[Dict[str, Any]]:
        """路線の列車位置データを取得"""
        url = f"{self.base_url}{line_id}.json"
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url)
                response.raise_for_status()
                return response.json()
        except httpx.HTTPError as e:
            logger.error(f"Failed to fetch positions for {line_id}: {e}")
            return None

    async def fetch_line_stations(self, line_id: str, st_url: str) -> Optional[Dict[str, Any]]:
        """路線の駅データを取得"""
        if not st_url:
            return None

        # st_url が相対パスの場合は base_url と結合
        if st_url.startswith("/"):
            url = f"{self.base_url.rstrip('/')}{st_url}"
        elif st_url.startswith("http"):
            url = st_url
        else:
            url = f"{self.base_url}{st_url}"

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url)
                response.raise_for_status()
                return response.json()
        except httpx.HTTPError as e:
            logger.error(f"Failed to fetch stations for {line_id}: {e}")
            return None

    async def fetch_multiple_lines_parallel(
        self,
        line_ids: List[str]
    ) -> Dict[str, Optional[Dict[str, Any]]]:
        """複数路線の位置データを並列取得"""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            tasks = [
                client.get(f"{self.base_url}{line_id}.json")
                for line_id in line_ids
            ]

            results = {}
            responses = await asyncio.gather(*tasks, return_exceptions=True)

            for line_id, response in zip(line_ids, responses):
                if isinstance(response, Exception):
                    logger.error(f"Failed to fetch {line_id}: {response}")
                    results[line_id] = None
                elif isinstance(response, httpx.Response):
                    try:
                        response.raise_for_status()
                        results[line_id] = response.json()
                    except Exception as e:
                        logger.error(f"Failed to parse {line_id}: {e}")
                        results[line_id] = None
                else:
                    results[line_id] = None

            return results


# グローバルクライアントインスタンス
import asyncio

jrwest_client = JRWestAPIClient()
