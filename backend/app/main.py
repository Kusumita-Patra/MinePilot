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
    corrective_actions,
    emergency,
    environment,
    health,
    incidents,
    inspections,
    kpis,
    sensors,
    sustainability,
    telemetry,
    users,
    water,
)
from app.services.emergency_escalation_service import run_emergency_escalation_loop
from app.services.telemetry_service import run_ingestion_loop

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    stop_event = asyncio.Event()
    ingestion_task = asyncio.create_task(run_ingestion_loop(stop_event))
    # Second background task, same stop_event/cancel shape as the telemetry
    # ingestion loop above — the escalation timer needs a proactive tick to
    # auto-escalate a live emergency without anyone refreshing a page.
    escalation_task = asyncio.create_task(run_emergency_escalation_loop(stop_event))
    yield
    stop_event.set()
    ingestion_task.cancel()
    escalation_task.cancel()
    try:
        await ingestion_task
    except asyncio.CancelledError:
        pass
    try:
        await escalation_task
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
app.include_router(environment.router)
app.include_router(water.router)
app.include_router(corrective_actions.router)
app.include_router(sustainability.router)
app.include_router(emergency.router)
