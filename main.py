from fastapi import FastAPI
from contextlib import asynccontextmanager
from services.scheduler import start_scheduler, shutdown_scheduler
from routers import timetable


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 起動時
    start_scheduler()
    yield
    # 終了時
    shutdown_scheduler()


app = FastAPI(
    title="Tiny-TID",
    description="駅すぱあとAPIから時刻表データを取得して返すAPI",
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(timetable.router)


@app.get("/")
async def root():
    return {
        "message": "Tiny-TID API",
        "endpoints": {
            "timetable_directions": "/timetable/",
            "timetable_detail": "/timetable/detail/{code}",
            "cache_status": "/timetable/status",
        },
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
