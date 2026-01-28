from datetime import datetime, timedelta
from typing import Optional, Any, Dict, Tuple


class MemoryCache:
    """インメモリキャッシュ（TTL付き）"""

    def __init__(self, ttl_seconds: int = 30):
        self.cache: Dict[str, Tuple[Any, datetime]] = {}
        self.ttl = timedelta(seconds=ttl_seconds)

    def get(self, key: str) -> Optional[Any]:
        """キャッシュから値を取得"""
        if key not in self.cache:
            return None

        value, expires_at = self.cache[key]
        if datetime.now() > expires_at:
            del self.cache[key]
            return None

        return value

    def set(self, key: str, value: Any) -> None:
        """キャッシュに値を設定"""
        expires_at = datetime.now() + self.ttl
        self.cache[key] = (value, expires_at)

    def clear(self) -> None:
        """キャッシュをクリア"""
        self.cache.clear()

    def __len__(self) -> int:
        """キャッシュサイズを返す"""
        # 期限切れを除外してカウント
        now = datetime.now()
        return sum(1 for _, (_, expires_at) in self.cache.items() if expires_at > now)


# グローバルキャッシュインスタンス
trains_cache = MemoryCache(ttl_seconds=30)
lines_cache = MemoryCache(ttl_seconds=300)  # 路線情報は5分キャッシュ
