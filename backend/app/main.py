import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.exceptions.handlers import register_exception_handlers
from app.routers import (
    admin,
    analytics,
    auth,
    blueprints,
    health,
    incidents,
    inspections,
    kpis,
    sensors,
    telemetry,
    users,
)
from app.services.telemetry_service import run_ingestion_loop

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    stop_event = asyncio.Event()
    ingestion_task = asyncio.create_task(run_ingestion_loop(stop_event))
    yield
    stop_event.set()
    ingestion_task.cancel()
    try:
        await ingestion_task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="MinePilot Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(incidents.router)
app.include_router(telemetry.router)
app.include_router(inspections.router)
app.include_router(kpis.router)
app.include_router(analytics.router)
app.include_router(users.router)
app.include_router(blueprints.router)
app.include_router(admin.router)
app.include_router(sensors.router)
