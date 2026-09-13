import asyncio
import logging
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
    energy,
    environment,
    health,
    incidents,
    inspections,
    kpis,
    land,
    sensors,
    sustainability,
    telemetry,
    users,
    waste,
    water,
    worker_locations,
)
from app.services.emergency_escalation_service import run_emergency_escalation_loop
from app.services.sustainability_simulator_service import run_sustainability_simulator_loop
from app.services.telemetry_service import run_ingestion_loop
from app.services.worker_geotracking_service import run_worker_geotracking_loop

settings = get_settings()
logger = logging.getLogger("minepilot.backend.lifespan")


async def _cancel_and_wait(task: asyncio.Task | None, name: str) -> None:
    """A task.cancel() + bare `await task` can hang forever if the task is
    stuck mid-await inside a slow/stuck DB call — found live: a wedged
    sustainability-simulator tick during a dev --reload cycle blocked this
    exact await indefinitely, leaving the whole app unresponsive to every
    request (even ones needing no DB access) because uvicorn's reload never
    finished tearing down the old worker. A hard timeout here means a stuck
    task can, at worst, delay shutdown by 5s — never hang it forever."""
    if task is None:
        return
    task.cancel()
    try:
        await asyncio.wait_for(task, timeout=5)
    except asyncio.CancelledError:
        pass
    except asyncio.TimeoutError:
        logger.error("%s did not shut down within 5s — abandoning it", name)


@asynccontextmanager
async def lifespan(app: FastAPI):
    stop_event = asyncio.Event()
    ingestion_task = asyncio.create_task(run_ingestion_loop(stop_event))
    # Second background task, same stop_event/cancel shape as the telemetry
    # ingestion loop above — the escalation timer needs a proactive tick to
    # auto-escalate a live emergency without anyone refreshing a page.
    escalation_task = asyncio.create_task(run_emergency_escalation_loop(stop_event))
    # Third background task, same shape again — the P3 Sustainability
    # simulator. Only created when enabled, so disabling it (e.g. for a
    # local dev session that shouldn't churn demo data) is a pure .env
    # toggle with no code path even running. The test suite never boots this
    # lifespan at all, so it never runs during pytest regardless.
    simulator_task = asyncio.create_task(run_sustainability_simulator_loop(stop_event)) if settings.sustainability_simulator_enabled else None
    # Fourth background task — continuous worker geotagging (always-on
    # operational feature, not a start/pause-able demo), same shape again.
    geotracking_task = asyncio.create_task(run_worker_geotracking_loop(stop_event)) if settings.worker_geotracking_enabled else None
    yield
    stop_event.set()
    await _cancel_and_wait(ingestion_task, "Telemetry ingestion loop")
    await _cancel_and_wait(escalation_task, "Emergency escalation loop")
    await _cancel_and_wait(simulator_task, "Sustainability simulator loop")
    await _cancel_and_wait(geotracking_task, "Worker geotracking loop")


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
app.include_router(energy.router)
app.include_router(waste.router)
app.include_router(land.router)
app.include_router(worker_locations.router)
