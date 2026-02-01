import os
from fastapi import FastAPI
from contextlib import asynccontextmanager
from services.scheduler import start_scheduler, shutdown_scheduler
from routers import timetable, jrwest, jrwest_realtime, jrwest_station_graph

# .envファイル存在チェックとウィザード起動
if not os.path.exists(".env"):
    print(".envファイルが見つかりません。初期設定ウィザードを起動します...")
    from wizard import run_wizard

    if not run_wizard():
        print("初期設定がキャンセルされたか、エラーが発生しました。")
        print("手動で.envファイルを作成するか、再度実行してください。")
        exit(1)


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
app.include_router(jrwest.router)
app.include_router(jrwest_realtime.router)
app.include_router(jrwest_station_graph.router)


@app.get("/")
async def root():
    return {
        "message": "Tiny-TID API",
        "endpoints": {
            "ekispert": {
                "timetable_directions": "/timetable/",
                "timetable_detail": "/timetable/detail/{code}",
                "timetable_train": "/timetable/train/{train_id}",
                "timetable_status": "/timetable/status",
            },
            "jrwest": {
                "all_areas": "/jrwest/",
                "area_detail": "/jrwest/{area}",
                "station_search_all": "/jrwest/station/{station_code}",
                "station_search_in_area": "/jrwest/{area}/station/{station_code}",
                "cache_status": "/jrwest/status",
            },
            "jrwest_realtime": {
                "all_lines": "/jrwest/realtime/",
                "line_detail": "/jrwest/realtime/{line}",
                "status": "/jrwest/realtime/status",
            },
            "jrwest_station_graph": {
                "station_graph": "/jrwest/station-graph/",
                "realtime_with_direction": "/jrwest/station-graph/realtime",
                "direction_lookup": "/jrwest/station-graph/direction/{pos}",
            },
        },
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
