import asyncio
import logging

from app.db.database import AsyncSessionLocal
from app.services import emergency_event_service, worker_position_service

logger = logging.getLogger("minepilot.backend.emergency")

_TICK_SECONDS = 3


async def run_emergency_escalation_loop(stop_event: asyncio.Event) -> None:
    """The one new background task this module needs — mirrors
    telemetry_service.run_ingestion_loop's exact stop_event/cancel shape in
    app/main.py's lifespan hook. Ticks every 3s: auto-escalates any
    EmergencyEvent past its (read-time-computed) escalation deadline, and —
    while any evacuation is active — also advances simulated worker
    positions and flags any worker who hasn't moved in
    worker_position_service.DELAY_THRESHOLD_SECONDS as DELAYED, so this
    doubles as the worker-movement driver rather than adding a third
    background task (see plan deviation 6)."""
    while not stop_event.is_set():
        try:
            async with AsyncSessionLocal() as db:
                for event in await emergency_event_service.list_escalation_due(db):
                    await emergency_event_service.auto_escalate(db, event)

                if await emergency_event_service.any_evacuation_active(db):
                    await worker_position_service.advance_all_simulated(db)
                    await worker_position_service.detect_delayed_workers(db)
        except Exception:
            logger.exception("Emergency escalation tick failed")

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=_TICK_SECONDS)
        except asyncio.TimeoutError:
            pass
