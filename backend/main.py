from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import logging

from config import CORS_ORIGINS
from api import trains, lines, station

# ロギング設定
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

logger = logging.getLogger(__name__)

# FastAPIアプリケーション
app = FastAPI(
    title="Tiny-TID API",
    description="茨木駅特化版 列車情報API",
    version="2.0.0"
)

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS if CORS_ORIGINS else ["*"],
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)

# APIルーター登録
app.include_router(trains.router, prefix="/api", tags=["trains"])
app.include_router(lines.router, prefix="/api", tags=["lines"])
app.include_router(station.router, prefix="/api", tags=["station"])


@app.get("/")
async def root():
    """ルートエンドポイント"""
    return {
        "message": "Tiny-TID API v2 - 茨木駅特化版",
        "docs": "/docs",
        "health": "/health"
    }


@app.get("/health")
async def health_check():
    """ヘルスチェック"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat()
    }


@app.on_event("startup")
async def startup_event():
    """起動時処理"""
    logger.info("Tiny-TID API starting up...")
    logger.info("茨木駅特化版 v2.0.0")


@app.on_event("shutdown")
async def shutdown_event():
    """シャットダウン時処理"""
    logger.info("Tiny-TID API shutting down...")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
