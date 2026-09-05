"""
Incident Ticket Lifecycle
==========================
Implements the lifecycle from the shared architecture contract:

    TRIGGERED -> ASSIGNED (to Field Staff)
              -> RESOLVED (with remarks) OR ESCALATED (to Mine Manager)
              -> SIGNED_OFF

In-memory store, intentionally dependency-free to match the project's
"fully software-simulated" nature — swap for PostgreSQL later per the
shared architecture doc without changing the function signatures below.
"""

import itertools
from datetime import datetime, timezone
from typing import Dict, List, Optional
from pydantic import BaseModel

VALID_TRANSITIONS = {
    "TRIGGERED": {"ASSIGNED"},
    "ASSIGNED": {"RESOLVED", "ESCALATED"},
    "ESCALATED": {"ASSIGNED", "SIGNED_OFF"},
    "RESOLVED": {"SIGNED_OFF"},
    "SIGNED_OFF": set(),
}


class Incident(BaseModel):
    ticket_id: str
    sector_id: str
    sensor_id: str
    risk_score: int
    severity: str  # RiskLevel: NORMAL | WARNING | CRITICAL
    status: str = "TRIGGERED"
    assigned_worker_id: Optional[str] = None
    field_remarks: Optional[str] = None
    resolution_photo_url: Optional[str] = None
    created_at: str
    resolved_at: Optional[str] = None


class IncidentUpdate(BaseModel):
    status: Optional[str] = None
    assigned_worker_id: Optional[str] = None
    field_remarks: Optional[str] = None
    resolution_photo_url: Optional[str] = None


class InvalidTransition(Exception):
    pass


_store: Dict[str, Incident] = {}
_counter = itertools.count(1)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def open_incident_for_sensor(sensor_id: str) -> Optional[Incident]:
    """Returns the sensor's current non-terminal ticket, if one is open."""
    for inc in _store.values():
        if inc.sensor_id == sensor_id and inc.status != "SIGNED_OFF":
            return inc
    return None


def trigger_incident(sensor_id: str, sector_id: str, risk_score: int, severity: str) -> Incident:
    """Called by the telemetry stream whenever a sensor goes non-NORMAL.
    Reuses the existing open ticket for that sensor instead of spawning
    duplicates while the hazard is still active."""
    existing = open_incident_for_sensor(sensor_id)
    if existing:
        existing.risk_score = max(existing.risk_score, risk_score)
        existing.severity = severity if risk_score >= existing.risk_score else existing.severity
        return existing

    ticket_id = f"INC-{next(_counter):04d}"
    inc = Incident(
        ticket_id=ticket_id,
        sector_id=sector_id,
        sensor_id=sensor_id,
        risk_score=risk_score,
        severity=severity,
        status="TRIGGERED",
        created_at=_now(),
    )
    _store[ticket_id] = inc
    return inc


def list_incidents(status: Optional[str] = None) -> List[Incident]:
    items = list(_store.values())
    if status:
        items = [i for i in items if i.status == status]
    return sorted(items, key=lambda i: i.created_at, reverse=True)


def get_incident(ticket_id: str) -> Optional[Incident]:
    return _store.get(ticket_id)


def update_incident(ticket_id: str, patch: IncidentUpdate) -> Incident:
    inc = _store.get(ticket_id)
    if inc is None:
        raise KeyError(ticket_id)

    if patch.status is not None and patch.status != inc.status:
        if patch.status not in VALID_TRANSITIONS.get(inc.status, set()):
            raise InvalidTransition(f"{inc.status} -> {patch.status} is not a valid transition")
        inc.status = patch.status
        if patch.status in ("RESOLVED", "SIGNED_OFF") and inc.resolved_at is None:
            inc.resolved_at = _now()

    if patch.assigned_worker_id is not None:
        inc.assigned_worker_id = patch.assigned_worker_id
    if patch.field_remarks is not None:
        inc.field_remarks = patch.field_remarks
    if patch.resolution_photo_url is not None:
        inc.resolution_photo_url = patch.resolution_photo_url

    return inc


def reset_all():
    """Test/demo helper."""
    _store.clear()