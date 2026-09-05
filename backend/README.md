# MinePilot Backend (T3)

FastAPI + PostgreSQL (Supabase) backend implementing `PLAN.md`: JWT auth, incident
persistence, telemetry ingestion/broadcast, KPIs, analytics, and inspections.

See `../PLAN.md` for the full design (schema, endpoints, auth, WebSocket design,
build order, and flagged assumptions/open questions). This README is setup/ops only.

## Setup

```bash
cd backend
python3.13 -m venv .venv   # 3.13 has better prebuilt wheels than 3.14 for asyncpg/bcrypt
./.venv/bin/pip install -r requirements.txt
cp .env.example .env       # then fill in DATABASE_URL (Supabase pooler, port 6543) and JWT_SECRET
```

`.env` is gitignored. `DATABASE_URL` should be the Supabase **transaction pooler**
connection string (port 6543) - see CLAUDE.md §4 for why (`statement_cache_size=0`
handling is already wired into `app/db/database.py`).

## Run

```bash
./.venv/bin/uvicorn app.main:app --reload --port 8001
```

On startup, the app opens a background WebSocket client to T2's simulator
(`ML_SERVICE_WS_URL`, default `ws://localhost:8000/ws/telemetry`) and starts
ingesting/persisting/rebroadcasting telemetry immediately. If T2's service isn't
running yet, it retries with exponential backoff (logged, non-fatal) - the rest of
the API works fine without it.

## Migrations

```bash
./.venv/bin/alembic revision --autogenerate -m "message"
./.venv/bin/alembic upgrade head
```

## Tests

```bash
./.venv/bin/pytest -q
```

Current tests cover pure logic only (password hashing, JWT roundtrip, incident
transition/role rules) - no live-DB integration tests yet, to avoid needing a
second Postgres instance for CI in a hackathon timeframe. Worth adding before
this goes past demo scope.

## Known gaps (see PLAN.md §7 for the full list with reasoning)

- **`compliance_scores` has no writer.** `GET /api/analytics/compliance` will
  return `[]` until something populates that table - the plan only defines its
  storage shape, not the computation. Confirm with Banibrata whether this UI
  section is needed for the demo before building that out.
- **KPI `trend` is always `null`.** No historical KPI snapshots are stored, so a
  day-over-day trend can't be computed honestly yet.
- **`POST /api/auth/register` is public** (no invite/admin gate) - there's no
  admin UI to create users any other way yet.
