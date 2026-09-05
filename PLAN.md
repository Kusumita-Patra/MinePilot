# PLAN.md — MinePilot Backend (T3) Build Plan

Authoritative backend plan per `CLAUDE.md` §2. If this document and `CLAUDE.md` disagree on backend specifics, this document wins for backend specifics; `CLAUDE.md` still governs global conventions (error format, code style, architecture rules).

## 0. Architecture overview

T2's `inference_api.py` (port 8000, **not modified by T3**) remains the sensor simulator and ML scorer: it generates synthetic telemetry, computes `risk_score`/`risk_level`/`anomaly_factors` via `risk_scoring.py`, and exposes `/ws/telemetry` and `/api/v1/predict-risk`. T3's new backend (`backend/`, its own port — default `8001`) is the **persistent broker** sitting between T2 and the frontend:

```
T2 inference_api.py (port 8000)         T3 backend (port 8001)              Frontend (port 3000)
  - simulated sensors/ML scoring          - WS client -> ingests T2's         - REST calls -> T3 only
  - /ws/telemetry (simulated stream)        /ws/telemetry stream              - WS client -> T3's /ws/telemetry
  - /api/v1/predict-risk                  - persists sensors, telemetry
  - not modified, not called by             history, incidents (Postgres)
    frontend after integration            - owns auth (JWT), KPIs,
                                             analytics, inspections
                                           - re-broadcasts SensorFrame-
                                             shaped frames to the frontend
                                           - creates/updates incidents when
                                             risk_level != NORMAL
```

T3 never re-implements risk scoring — it only relays and persists the `risk_score`/`risk_level` fields that arrive on T2's stream, matching the frozen `SensorFrame` contract.

## 1. Database schema

PostgreSQL (Supabase), async SQLAlchemy, all changes via Alembic migrations only.

### Enums

| Enum | Values |
|---|---|
| `risk_level` | `NORMAL`, `WARNING`, `CRITICAL` |
| `incident_status` | `TRIGGERED`, `ASSIGNED`, `RESOLVED`, `ESCALATED`, `SIGNED_OFF` |
| `user_role` | `mine_manager`, `field_worker` |
| `inspection_status` | `SCHEDULED`, `IN_PROGRESS`, `COMPLETED` |
| `compliance_category` | `GAS_CONCENTRATION`, `VENTILATION`, `PAST_VIOLATIONS`, `OVERDUE_ACTIONS`, `EQUIPMENT_HEALTH` |

### `users`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | `default=gen_random_uuid()` |
| `email` | VARCHAR, unique, not null | |
| `password_hash` | VARCHAR, not null | bcrypt via passlib |
| `full_name` | VARCHAR, not null | |
| `role` | `user_role`, not null | |
| `is_active` | BOOLEAN, default `true` | |
| `created_at` | TIMESTAMPTZ, default `now()` | |
| `updated_at` | TIMESTAMPTZ, default `now()`, on-update `now()` | |

### `sensors` (live registry, upserted by the telemetry ingestion service)

| Field | Type | Notes |
|---|---|---|
| `sensor_id` | VARCHAR PK | matches T2's `sensor_id` string, e.g. `SNS-SEC4-CH4-01` |
| `sector_id` | VARCHAR, not null | |
| `last_coordinates` | JSONB, not null | `{x, y, z}` |
| `last_risk_score` | INTEGER, not null | |
| `last_risk_level` | `risk_level`, not null | |
| `last_seen_at` | TIMESTAMPTZ, not null | |
| `created_at` | TIMESTAMPTZ, default `now()` | |

### `telemetry_readings` (history, for analytics/audit)

| Field | Type | Notes |
|---|---|---|
| `id` | BIGSERIAL PK | |
| `sensor_id` | VARCHAR, FK -> `sensors.sensor_id`, not null | |
| `sector_id` | VARCHAR, not null | |
| `ch4_pct`, `co_ppm`, `dust_pm10`, `displacement_mm`, `temp_c` | FLOAT, not null | mirrors `TelemetryReading` |
| `risk_score` | INTEGER, not null | |
| `risk_level` | `risk_level`, not null | |
| `recorded_at` | TIMESTAMPTZ, not null | upstream frame timestamp |
| `created_at` | TIMESTAMPTZ, default `now()` | ingestion time |

Index: `(sensor_id, recorded_at DESC)`, `(sector_id, recorded_at DESC)`.

### `incidents` (T3's persisted source of truth — supersedes T2's in-memory store)

| Field | Type | Notes |
|---|---|---|
| `ticket_id` | VARCHAR PK | format `INC-0001`, from a Postgres sequence |
| `sensor_id` | VARCHAR, FK -> `sensors.sensor_id`, not null | |
| `sector_id` | VARCHAR, not null | |
| `risk_score` | INTEGER, not null | |
| `severity` | `risk_level`, not null | |
| `status` | `incident_status`, not null, default `TRIGGERED` | |
| `assigned_worker_id` | UUID, FK -> `users.id`, nullable | |
| `field_remarks` | TEXT, nullable | |
| `resolution_photo_url` | TEXT, nullable | |
| `created_at` | TIMESTAMPTZ, not null, default `now()` | |
| `resolved_at` | TIMESTAMPTZ, nullable | |
| `updated_at` | TIMESTAMPTZ, default `now()`, on-update `now()` | |

Valid transitions (enforced in `incident_service.py`, mirrors T2's `VALID_TRANSITIONS`):
`TRIGGERED -> ASSIGNED`, `ASSIGNED -> {RESOLVED, ESCALATED}`, `ESCALATED -> {ASSIGNED, SIGNED_OFF}`, `RESOLVED -> SIGNED_OFF`, `SIGNED_OFF -> {}` (terminal).

Incidents are **never created via a public POST endpoint** — only the telemetry ingestion service creates them, reusing an existing open (non-`SIGNED_OFF`) ticket per `sensor_id` and bumping `risk_score`/`severity` if the new reading is worse, exactly mirroring T2's `trigger_incident`.

### `inspections` (new — backs the "Inspections (This Month)" KPI and analytics breakdown)

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `sector_id` | VARCHAR, not null | |
| `status` | `inspection_status`, not null, default `SCHEDULED` | |
| `scheduled_date` | DATE, not null | |
| `completed_at` | TIMESTAMPTZ, nullable | |
| `inspector_id` | UUID, FK -> `users.id`, nullable | |
| `notes` | TEXT, nullable | |
| `created_at`, `updated_at` | TIMESTAMPTZ | |

### `compliance_scores` (new — backs "Overall Compliance" KPI and the compliance-by-category analytics chart; **flagged, see §7**)

| Field | Type | Notes |
|---|---|---|
| `id` | BIGSERIAL PK | |
| `category` | `compliance_category`, not null | |
| `sector_id` | VARCHAR, nullable | `NULL` = mine-wide |
| `score_pct` | FLOAT, not null | 0–100 |
| `recorded_at` | TIMESTAMPTZ, not null, default `now()` | |

No dedicated table for "mine risk ranking" — repurposed as a computed sector-risk ranking from `sensors`/`telemetry_readings` (see §7). No `notifications` table for v1 — the header's notification badge is derived from the count of open incidents.

## 2. API endpoints

Base path `/api`. Every endpoint returns one of CLAUDE.md's three standard shapes (`{success:true, message, data}` on success; the two error shapes on failure) — **including incidents and telemetry**, per the confirmed "envelope everywhere" decision.

### Auth (`routers/auth.py`)

| Route | Method | Auth | Purpose | Request | Response `data` | Status codes |
|---|---|---|---|---|---|---|
| `/api/auth/register` | POST | public | create a user | `{email, password, full_name, role}` | `UserResponse` | 201, 409 (duplicate email), 422 |
| `/api/auth/login` | POST | public | issue JWT | `{email, password}` | `{access_token, token_type: "bearer", user: UserResponse}` | 200, 401, 422 |
| `/api/auth/me` | GET | required | current user | — | `UserResponse` | 200, 401 |

`UserResponse`: `{id, email, full_name, role, is_active, created_at}` — never includes `password_hash`.

### Incidents (`routers/incidents.py`)

| Route | Method | Auth | Purpose | Request | Response `data` | Status codes |
|---|---|---|---|---|---|---|
| `/api/incidents` | GET | required | list, filterable | query: `status?`, `sector_id?`, `severity?` | `Incident[]` | 200, 401 |
| `/api/incidents/{ticket_id}` | GET | required | detail | — | `Incident` | 200, 401, 404 |
| `/api/incidents/{ticket_id}` | PATCH | required | transition/update | `{status?, assigned_worker_id?, field_remarks?, resolution_photo_url?}` | `Incident` | 200, 401, 403 (role not permitted), 404, 409 (invalid transition), 422 |

`Incident` response matches `shared/types/telemetry.ts`'s `Incident` interface exactly (`ticket_id, sector_id, sensor_id, risk_score, severity, status, assigned_worker_id?, field_remarks?, resolution_photo_url?, created_at, resolved_at?`).

Role rules (flagged assumption, see §7): `field_worker` may perform `TRIGGERED->ASSIGNED`, `ASSIGNED->RESOLVED`, `ASSIGNED->ESCALATED`, `ESCALATED->ASSIGNED`. `mine_manager` may additionally perform `RESOLVED->SIGNED_OFF`, `ESCALATED->SIGNED_OFF`.

### Telemetry (`routers/telemetry.py`)

| Route | Method | Auth | Purpose | Request | Response `data` | Status codes |
|---|---|---|---|---|---|---|
| `/api/telemetry/latest` | GET | required | latest reading per sensor | query: `sector_id?` | `SensorFrame[]` | 200, 401 |
| `/api/telemetry/history` | GET | required | time-series for charts | query: `sensor_id?`, `sector_id?`, `from?`, `to?`, `limit?` | `SensorFrame[]` | 200, 401 |
| `/ws/telemetry` | WS | required (`?token=`) | live stream | — | one `SensorFrame` JSON object per message | connect closes with policy-violation code if token missing/invalid |

`SensorFrame` on the wire matches `shared/types/telemetry.ts` exactly (`sensor_id, sector_id, coordinates{x,y,z}, telemetry{ch4_pct,co_ppm,displacement_mm,temp_c,dust_pm10}, risk_score, risk_level, timestamp`) — no extra fields such as T2's `anomaly_factors` are forwarded to the frontend, honoring "never deviate."

### KPIs (`routers/kpis.py`)

| Route | Method | Auth | Purpose | Response `data` |
|---|---|---|---|---|
| `/api/kpis` | GET | required | dashboard KPI cards | `{overall_compliance: {value, trend}, open_violations: {value, trend}, pending_actions: {value, trend}, inspections_this_month: {value, trend}}` |

### Analytics (`routers/analytics.py`)

| Route | Method | Auth | Purpose | Response `data` |
|---|---|---|---|---|
| `/api/analytics/compliance` | GET | required | compliance-by-category chart | `[{category, score_pct}]` |
| `/api/analytics/risk-ranking` | GET | required | sector risk ranking (repurposes "mine ranking") | `[{sector_id, avg_risk_score, risk_level}]` |
| `/api/analytics/inspections` | GET | required | inspections status breakdown | `{completed, in_progress, scheduled}` |

### Inspections (`routers/inspections.py`)

| Route | Method | Auth | Purpose | Request | Response `data` | Status codes |
|---|---|---|---|---|---|---|
| `/api/inspections` | GET | required | list | query: `status?`, `month?` | `Inspection[]` | 200, 401 |
| `/api/inspections` | POST | `mine_manager` only | schedule | `{sector_id, scheduled_date, notes?}` | `Inspection` | 201, 403, 422 |
| `/api/inspections/{id}` | PATCH | required | update status/notes | `{status?, notes?, completed_at?}` | `Inspection` | 200, 401, 404, 422 |

### Health

| Route | Method | Auth | Response `data` |
|---|---|---|---|
| `/api/health` | GET | public | `{}` (message: `"ok"`) |

## 3. Authentication design

- **Flow**: `POST /api/auth/login` verifies email + bcrypt-hashed password, issues a JWT, client sends `Authorization: Bearer <token>` on every subsequent request; `get_current_user` dependency decodes and validates it.
- **Token payload**: `{sub: user_id, role, exp, iat}` — no email, name, or other PII in the payload (per CLAUDE.md §8).
- **Expiry**: 24 hours, no refresh-token flow (flagged in §7 — acceptable for hackathon demo length).
- **Password storage**: bcrypt via passlib; hashes never leave `services/auth_service.py` or appear in any response schema.
- **Public routes**: `/api/auth/register`, `/api/auth/login`, `/api/health`.
- **Protected routes**: everything else, via a `get_current_user` FastAPI dependency; role-gated routes (e.g. `POST /api/inspections`) additionally use a `require_role("mine_manager")` dependency.
- **WebSocket auth**: browsers cannot set custom headers on a native `WebSocket` connection, so the token is passed as a query parameter (`wss://.../ws/telemetry?token=...`), validated before accepting the connection, and the socket is closed immediately (policy-violation close code) if invalid or missing. Flagged in §7.
- **Roles**: exactly two, `mine_manager` and `field_worker`, matching the frontend's existing (currently unused) `useRoleStore`. No `admin` role — flagged in §7 if user management ever needs one.

## 4. WebSocket telemetry design

**Ingestion (upstream, server-side, no browser involved):**
1. On FastAPI startup (lifespan handler), a background task opens a WebSocket client connection to `ML_SERVICE_WS_URL` (env var, default `ws://localhost:8000/ws/telemetry` — T2's simulator).
2. Each received JSON frame is parsed into an internal model (superset of `SensorFrame` including T2's extra `anomaly_factors`, kept server-side only).
3. `sensors` row is upserted (`sensor_id`, `sector_id`, `last_coordinates`, `last_risk_score`, `last_risk_level`, `last_seen_at`).
4. A `telemetry_readings` row is inserted (full history for analytics/charts).
5. If `risk_level != "NORMAL"`, `incident_service.trigger_incident(...)` is called — reuses an existing open ticket for that `sensor_id` or creates a new one, exactly mirroring T2's in-memory logic but against the `incidents` table.
6. The frame is re-shaped to **exactly** the frozen `SensorFrame` fields (dropping `anomaly_factors`) and broadcast to all currently-connected frontend WebSocket clients via an in-process connection manager (a simple broadcast list is sufficient for a single-instance hackathon deployment — no Redis pub/sub needed).
7. If the upstream connection to T2 drops, the ingestion task retries with backoff; downstream frontend clients stay connected and simply receive no new frames until it recovers (flagged in §7 — no backfill/replay).

**Downstream (frontend-facing):**
- `GET /ws/telemetry?token=...` — validates the JWT, accepts the connection, registers it with the broadcast manager, and streams one `SensorFrame` JSON object per message (matching the frontend hook's existing per-message `JSON.parse` handling in `useTelemetryWebSocket.ts` — no batching/array wrapping).
- `GET /api/telemetry/latest` gives the frontend an initial snapshot (from the `sensors` table) to render before the first WebSocket frame arrives, avoiding a blank state.

T3 never calls `risk_scoring.py` or re-implements scoring — `risk_score`/`risk_level` are always relayed verbatim from T2's stream.

## 5. Folder / module structure

```
backend/
├── app/
│   ├── main.py              # FastAPI app, CORSMiddleware, router includes,
│   │                         # exception handlers, WS-ingestion lifespan startup/shutdown
│   ├── routers/
│   │   ├── health.py
│   │   ├── auth.py           # register, login, me
│   │   ├── users.py          # minimal: nothing beyond /me is needed for MVP
│   │   ├── incidents.py      # list, detail, PATCH
│   │   ├── telemetry.py      # latest, history, /ws/telemetry
│   │   ├── kpis.py
│   │   ├── analytics.py
│   │   └── inspections.py
│   ├── models/               # SQLAlchemy models, one file per table
│   │   ├── enums.py           # risk_level, incident_status, user_role, inspection_status, compliance_category
│   │   ├── user.py
│   │   ├── sensor.py
│   │   ├── telemetry_reading.py
│   │   ├── incident.py
│   │   ├── inspection.py
│   │   └── compliance_score.py
│   ├── schemas/               # Pydantic Create/Update/Response per resource
│   │   ├── common.py           # SuccessResponse/ErrorResponse envelope generics
│   │   ├── auth.py             # LoginRequest, RegisterRequest, TokenResponse
│   │   ├── user.py             # UserResponse
│   │   ├── incident.py         # IncidentResponse, IncidentUpdate
│   │   ├── telemetry.py        # SensorFrameSchema mirroring the frozen contract exactly
│   │   ├── kpi.py
│   │   ├── analytics.py
│   │   └── inspection.py       # InspectionCreate/Update/Response
│   ├── services/               # all business logic lives here
│   │   ├── auth_service.py      # register, login, JWT issuance
│   │   ├── incident_service.py  # transition validation + role rules, trigger_incident
│   │   ├── telemetry_service.py # WS ingestion loop, connection/broadcast manager
│   │   ├── kpi_service.py
│   │   ├── analytics_service.py
│   │   └── inspection_service.py
│   ├── db/
│   │   ├── database.py         # async engine (statement_cache_size=0 per CLAUDE.md §4), session factory
│   │   └── base.py             # declarative base, naming convention for Alembic
│   ├── core/
│   │   ├── config.py           # pydantic-settings: DATABASE_URL, JWT_SECRET, JWT_EXPIRE_MINUTES,
│   │   │                        # ML_SERVICE_WS_URL, ML_SERVICE_REST_URL, FRONTEND_ORIGIN
│   │   └── security.py         # password hashing, JWT encode/decode, get_current_user, require_role
│   ├── exceptions/
│   │   ├── custom_exceptions.py # AppException + NotFoundError, InvalidTransitionError, DuplicateEmailError, etc.
│   │   └── handlers.py          # global handlers, registered in main.py
│   └── utils/
│       └── ticket_id.py         # INC-0001 sequence-backed generator
├── tests/
│   ├── test_auth.py
│   ├── test_incidents.py
│   ├── test_telemetry_ingestion.py
│   ├── test_kpis.py
│   └── test_inspections.py
├── alembic/
│   ├── versions/
│   └── env.py                  # wired to the async engine + models' metadata
├── .env / .env.example
├── requirements.txt
├── alembic.ini
└── README.md
```

## 6. Build order

1. **Scaffold** — `backend/` tree, `requirements.txt`, `.env.example`, `core/config.py` (pydantic-settings), `db/database.py` (async engine with `statement_cache_size=0`/`prepared_statement_cache_size=0`), `db/base.py`.
2. **App skeleton** — `app/main.py`: FastAPI instance, `CORSMiddleware` (from `FRONTEND_ORIGIN`), `exceptions/` global handlers registered from day one, `routers/health.py` wired in — verifies the standard response envelope end-to-end before anything else is built on top of it.
3. **Alembic** — `alembic init`, `env.py` wired to the async engine and models' metadata.
4. **Models + first migration** — all tables/enums in §1 (`users`, `sensors`, `telemetry_readings`, `incidents`, `inspections`, `compliance_scores`); generate and apply the initial Alembic migration.
5. **Core security** — `core/security.py`: password hashing, JWT encode/decode, `get_current_user`/`require_role` dependencies.
6. **Auth module** — `schemas/auth.py`, `schemas/user.py`, `services/auth_service.py`, `routers/auth.py` (register/login/me). Fully testable in isolation.
7. **Incidents module** — `schemas/incident.py`, `services/incident_service.py` (transition table + role rules), `routers/incidents.py` (list/detail/PATCH). Seed a couple of incidents by hand to verify before wiring telemetry.
8. **Telemetry ingestion + WebSocket** — `services/telemetry_service.py` (WS client to T2, upsert `sensors`, insert `telemetry_readings`, call `incident_service` on non-`NORMAL` risk), `routers/telemetry.py` (latest/history REST + `/ws/telemetry` broadcast), wired into `main.py`'s lifespan startup/shutdown. This is the highest-risk module — verify against a running `inference_api.py` before moving on.
9. **Inspections, KPIs, analytics** — build `inspections` CRUD first (concrete, no ambiguity), then `kpi_service`/`analytics_service` reading from `incidents`/`inspections`/`compliance_scores`. Confirm the §7 assumptions with Banibrata before investing further here — this is the most speculative area.
10. **Polish** — unit tests per service, `backend/README.md`, and a full end-to-end pass: run T2's `inference_api.py`, T3's backend, and the frontend together; confirm the dashboard, field view, and sign-off flow all work against real (persisted) data instead of frontend's mock fallback.

## 7. Assumptions and open questions

Per CLAUDE.md §11 ("pick a sensible default, implement it, and flag it clearly") — these are defaults, not silent decisions. Please confirm before or during the corresponding build step.

| # | Assumption / default chosen | Why | Confirm before |
|---|---|---|---|
| 1 | T3's backend runs on its own port (default `8001`, configurable) and becomes the frontend's target for incidents + telemetry; T2's `inference_api.py` stays internal-only, reachable only by T3's ingestion service. | Confirmed with user (architecture decision). | Step 8 — also requires Banibrata to update `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_WS_URL` in the frontend's `.env` once T3 is live. |
| 2 | Every endpoint (including incidents/telemetry) uses the `{success, message, data}` envelope. | Confirmed with user (matches CLAUDE.md's unconditional §7 rule). | Requires Banibrata to update `src/lib/api.ts` to unwrap `.data` — flag to him directly once T3's incidents endpoints are ready. |
| 3 | T3 builds its own `incidents.py`/tables from scratch under `backend/`; the root-level `incidents.py` (T2's in-memory store) is left completely untouched, even though CLAUDE.md's do-not-modify list doesn't name it explicitly (it only names `inference_api.py`, `risk_scoring.py`, `data_generator.py`). | `incidents.py` is imported by and tightly coupled to T2's `inference_api.py`; safest reading of "boundaries" is to not touch anything in that service. | Before step 7, if you want this made explicit in CLAUDE.md too. |
| 4 | Incidents are created only by the telemetry ingestion service (§4), never via a public `POST /api/incidents`. | Mirrors T2's own design (`trigger_incident` is internal, not exposed as a create endpoint) and the frontend has no "create incident" UI. | Step 7. |
| 5 | Two roles only — `mine_manager`, `field_worker` — with the role permissions on incident transitions described in §2. No `admin` role. | Matches the frontend's existing (currently unused) `useRoleStore` exactly; no other role appears anywhere in the codebase. | Step 6, before wiring role checks into incident PATCH. |
| 6 | `POST /api/auth/register` is public (no invite/admin gate) for hackathon simplicity. | No signup UI or admin panel exists to create users any other way. | Step 6 — flag if you'd rather seed users via a script/migration instead and keep register admin-only or remove it. |
| 7 | JWT expiry is 24h with no refresh-token flow. | Simplicity; demo sessions are short-lived. | Step 6 — revisit if a demo needs to span multiple days without re-login. |
| 8 | WebSocket auth uses a `?token=` query parameter (native browsers can't set `Authorization` headers on `WebSocket`). | Standard workaround; acceptable for hackathon scope. | Step 8. |
| 9 | On T2 upstream WS disconnect, T3 retries with backoff; no frame backfill/replay to frontend clients for the gap. | Keeps the ingestion service simple; a full replay/backfill system is out of scope for a hackathon. | Step 8. |
| 10 | KPI "Overall Compliance" and Analytics "compliance-by-category" are backed by a new `compliance_scores` table using a 5-category taxonomy (`GAS_CONCENTRATION`, `VENTILATION`, `PAST_VIOLATIONS`, `OVERDUE_ACTIONS`, `EQUIPMENT_HEALTH`) borrowed from the frontend's already-hardcoded `AiRiskAnalysis.tsx` risk-factor names — but **no computation logic for populating these scores is specified anywhere**; this plan only defines the storage shape, not how scores get computed/seeded. | Nothing in CLAUDE.md, the shared types, or T2's code defines "compliance" at all — this is the most underspecified area of the whole system. | Before step 9 — confirm with Banibrata whether this UI section matters for the demo before investing backend effort in it; if not, consider stubbing it with static defaults instead of building real computation. |
| 11 | Analytics "mine ranking" widget is repurposed as a **sector** risk ranking (computed on the fly from `sensors`/`telemetry_readings`, no new table) rather than a literal multi-mine ranking. | The project appears single-mine (`Header.tsx` hardcodes "Raniganj Coalfield"); a genuine multi-mine schema would be speculative over-engineering. | Before step 9. |
| 12 | No `notifications` table; the header's notification badge count is derived from the count of currently-open incidents. | No notification concept exists anywhere except a hardcoded `5` in `Header.tsx`. | Before step 9, if a real notifications feature (e.g. read/unread, push) is actually wanted. |
| 13 | Once T3 ships, the frontend no longer needs to call T2's `/api/v1/predict-risk` directly for anything — risk scores arrive purely via T3's telemetry WebSocket/incidents. CLAUDE.md's mention of a `src/lib/predictRiskApi.ts` direct-call file is stale (that file doesn't exist in the current frontend). | Simplifies the integration surface to one backend for the frontend to talk to. | Confirm with Banibrata — if there's a standalone "test a hypothetical reading" UI feature planned, it would need a direct T2 call after all. |
| 14 | Root `README.md`'s unresolved git merge-conflict markers are out of scope for this backend work and are not touched by T3. | Not part of the backend; flagging so it isn't mistaken for already-fixed. | Whenever convenient — separate cleanup task. |
