import asyncio
import logging
from datetime import datetime, timezone

logger = logging.getLogger("minepilot.backend.emergency")


class BroadcastManager:
    """In-process pub/sub for /ws/emergency clients. A separate instance
    from telemetry_service.BroadcastManager, deliberately — sharing the
    telemetry stream's registry would mix emergency events into the
    frontend's frozen SensorFrame-only channel."""

    def __init__(self) -> None:
        self._queues: set[asyncio.Queue] = set()

    def subscribe(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        self._queues.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue) -> None:
        self._queues.discard(queue)

    async def broadcast(self, message: dict) -> None:
        for queue in list(self._queues):
            try:
                queue.put_nowait(message)
            except asyncio.QueueFull:
                logger.warning("Dropping an emergency event for a slow WebSocket client")


broadcast_manager = BroadcastManager()


async def publish(event_type: str, data: dict) -> None:
    await broadcast_manager.broadcast(
        {"type": event_type, "data": data, "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")}
    )
