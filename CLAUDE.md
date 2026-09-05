@AGENTS.md

# CLAUDE.md — MinePilot Backend

Persistent context for Claude Code working in this repository. Read this before making any change.

---

## 1. Project

**MinePilot** — an AI-based Smart Mine Digital Twin platform built for Smart India Hackathon (SIH). It streams live mine telemetry, renders it in a 3D digital twin, and surfaces AI-generated risk scores and alerts to a command-centre dashboard and a simplified field view.

**Repository:** `github.com/Kusumita-Patra/MinePilot.git` (branch: `main`)

### Team ownership

| Team | Scope | Owns |
|---|---|---|
| T1 | 3D Digital Twin | `<MineDigitalTwin />` (React Three Fiber) — not yet delivered |
| T2 (Kusumita) | AI/ML risk inference | `inference_api.py`, `risk_scoring.py`, `data_generator.py`, model artifacts |
| **T3 (us)** | **Backend + WebSocket telemetry** | `backend/` — everything in this file |
| T4 (Banibrata) | Frontend | Next.js 16 / TypeScript / Tailwind — in progress, not finished |

### Our objective

Build the backend — **including authentication** — fully and correctly now, so that when the frontend is complete, Banibrata can wire the APIs up and it just works. No backend rework at integration time.

### Boundaries — do not cross

- **Risk inference is T2's, over REST, not ours.** The frontend already calls T2's `/predict` endpoint directly via `src/lib/predictRiskApi.ts`. Do not proxy it, re-implement it, or push risk scores through our WebSocket unless explicitly instructed.
- **Do not modify** `inference_api.py`, `risk_scoring.py`, or `data_generator.py`.
- **Do not modify** anything under `smart-mine-frontend/`.

---

## 2. Source of truth

1. **`PLAN.md`** — the authoritative backend plan: DB schema, endpoint list, auth strategy, WebSocket design, build order, and open questions. If this file and `PLAN.md` disagree on backend specifics, `PLAN.md` wins. If `PLAN.md` doesn't cover something, ask before improvising.
2. **`shared/types/telemetry.ts`** and **`shared/mock-data/sample-telemetry-stream.json`** — the frozen contract for telemetry shape. Read both before writing any telemetry serializer, model, or socket handler. **Never deviate.** The frontend silently falls back to mock data when the payload doesn't match, so a mismatch fails quietly rather than loudly.

---

## 3. Tech stack

- Python + **FastAPI**
- **PostgreSQL** (Supabase) via **SQLAlchemy** ORM, async
- **Pydantic** for schemas; **pydantic-settings** for config
- **Alembic** for migrations
- **JWT** authentication; **bcrypt/passlib** for password hashing
- Configuration via `.env`

---

## 4. Database connection — settled, do not re-ask

- `DATABASE_URL` **is already set in `.env`.** Read it via `os.getenv("DATABASE_URL")` / pydantic-settings in `app/core/config.py`. Never ask for the raw connection string. Never hardcode it. Never print or log it.
- **Supabase transaction pooler (port 6543) is in use.** asyncpg must run with `statement_cache_size=0` — pgbouncer in transaction-pooling mode does not support prepared statements, and omitting this produces connection errors. Set it in the engine config from the start:

  ```python
  create_async_engine(
      settings.DATABASE_URL,
      connect_args={"statement_cache_size": 0, "prepared_statement_cache_size": 0},
  )
  ```

- All schema changes go through **Alembic migrations**. No manual edits to the live schema.
- **CORS is mandatory.** The frontend runs on a different origin; a missing `CORSMiddleware` already cost this project a debugging cycle on T2's service. Add it to `app/main.py` on day one.

---

## 5. Project structure

```
backend/
├── app/
│   ├── routers/        # auth.py, users.py, ...
│   ├── models/         # SQLAlchemy models
│   ├── schemas/        # Pydantic: Create/Update/Response per resource
│   ├── services/       # business logic
│   ├── db/             # database.py, base.py
│   ├── core/           # config.py, security.py
│   ├── exceptions/     # custom_exceptions.py, handlers.py
│   ├── utils/
│   └── main.py
├── tests/
├── alembic/
├── .env / .env.example
├── requirements.txt
├── alembic.ini
└── README.md
```

Always follow this layout. Split large files by responsibility. Nothing gets dumped into `main.py`.

---

## 6. Architecture rules

**Request flow:** Frontend → Router → Pydantic validation → Service → SQLAlchemy/DB
**Response flow:** DB → Service → Router → standardized JSON → Frontend

- **Routers are thin.** Endpoint definitions, schema validation, a service call, a response. No business logic, no DB queries, no password or JWT handling, no large `try/except` blocks.
- **Services hold all business logic** — registration, login, email uniqueness checks, hashing, JWT creation, DB operations.
- **Schemas are separated per resource** — `UserCreate`, `UserUpdate`, `UserResponse`. Response schemas **never** expose password hashes or other secrets.

---

## 7. Error handling

Centralized only. No repetitive per-router `try/except`.

- `app/exceptions/custom_exceptions.py` — an `AppException` class carrying `message`, `status_code`, and optional `errors`.
- `app/exceptions/handlers.py` — global handlers for `AppException`, FastAPI HTTP exceptions, Pydantic validation errors, SQLAlchemy/DB errors, and unexpected errors.

Rules:

- Raise `AppException(...)` for expected errors and let the global handler respond.
- Roll back the DB transaction on failure.
- Log the real error internally; return a safe message externally.
- **Never** expose stack traces, DB credentials, or raw SQL errors to the client.
- **Never** write `except Exception: pass`.

### Standard response formats

```json
// success
{ "success": true, "message": "Operation successful", "data": {} }
```

```json
// error
{ "success": false, "message": "User not found", "status_code": 404, "errors": [] }
```

```json
// validation error
{ "success": false, "message": "Validation failed", "status_code": 422,
  "errors": [{ "field": "email", "message": "Invalid email format" }] }
```

Every endpoint returns one of these three shapes. No exceptions.

---

## 8. Authentication

Flow: login → verify credentials → generate JWT → return token → frontend sends `Authorization: Bearer <token>` → backend verifies → allow or deny.

- Never store plaintext passwords.
- Never return password hashes.
- Never put sensitive data in the JWT payload.
- **Scope is hackathon-appropriate.** Do not add OTP, social login, or any other auth mechanism unless it is in `PLAN.md` and has been confirmed. Propose first; build after approval.

---

## 9. API conventions

- RESTful: `GET/POST/PATCH/DELETE /api/resource[/{id}]`
- Correct status codes: `200`, `201`, `204`, `400`, `401`, `403`, `404`, `409`, `422`, `500`

---

## 10. Code quality

- Type hints throughout; `async` where appropriate; PEP 8.
- `snake_case.py` filenames, `PascalCase` classes, `snake_case` functions and variables, `UPPER_CASE` constants.

---

## 11. Working agreement

- Work **module by module.** Finish and get review on one before starting the next.
- **Confirm the plan before writing code** for anything not already specified in `PLAN.md`.
- When the frontend recap leaves something undecided (KPI/alert/analytics payload shapes, user roles, notifications, alert persistence), pick a sensible default, implement it, and **flag it clearly** so Banibrata can confirm later. Don't silently guess.

---

## 12. Implementation status (as of 2026-09-05)

Running record of what's actually been built, so a new session (or teammate) doesn't have to re-derive it from git log. Update this section as work lands — don't let it go stale.

### Backend — built and working (`backend/`)

- **Auth** (`routers/auth.py` + `services/auth_service.py` + `schemas/auth.py`): register, login, `GET /me`, `POST /change-password`, `PATCH /me` (full name), `POST /update-email`. Email/password changes require current-password confirmation; a wrong current password returns **403**, not 401 — 401 is reserved strictly for "session/token invalid" since the frontend treats any 401 as a global logout signal.
- **Users**: `GET /api/users` (`mine_manager` only, via `require_role`).
- **Incidents**: full state machine (`TRIGGERED → ASSIGNED → RESOLVED → ESCALATED → SIGNED_OFF`) with per-role allowed-transition checks.
- **Telemetry**: WebSocket ingestion from T2's simulator (`inference_api.py`), persisted to Postgres, re-broadcast to authenticated frontend clients in the exact `shared/types/telemetry.ts` `SensorFrame` shape.
- **Inspections, KPIs, Analytics (compliance breakdown), Health** — all following the router→service→schema pattern in §6, all through the standard envelope in §7.
- **DB**: Supabase Postgres via SQLAlchemy async + asyncpg, `NullPool` + a per-connection `prepared_statement_name_func` (uuid-based) to work around pgbouncer transaction-pooling mode rejecting named prepared statements. 2 Alembic migrations so far: initial schema, incident ticket sequence.

### Frontend — built and working (`src/`)

- Zustand `authStore` (JWT + user, persisted to localStorage) and a `RequireAuth` role-gated route guard; sign-up and sign-in flows for both `mine_manager` and `field_worker`.
- Dashboard shell (`Header` + `Sidebar` + `RequireAuth`) wraps every `/dashboard/*` route automatically via `src/app/dashboard/layout.tsx`. **Settings lives at `/dashboard/settings`** inside that shell for managers (not a standalone page) — a collapsible "Update Personal Information" panel (full name / email / password, each its own accordion row; email and password changes require current-password confirmation). `/field` is the standalone field-worker view; its own `/settings` route (no sidebar) now only renders for field workers — a manager landing there gets redirected to `/dashboard/settings`.
- The 3D digital twin was merged in from Team 1's upstream work (`MineDigitalTwinContainer`, `MineScene`, etc.). A missing `mine.glb` is handled by a `useModelAvailability` HEAD-check hook (`src/components/digital-twin/useModelAvailability.ts`) so a missing model falls back to `MineTerrain` without ever throwing (avoids a false-positive Next.js dev-overlay error).
- **Documents panel** (`/dashboard/documents`) and **Contractors panel** (`/dashboard/contractors` + `/dashboard/contractors/[contractorId]`): compliance-risk surfaces modeled on real Indian mine-compliance workflows (Mines Act 1952, DGMS, CLRA 1970) — statutory-document expiry tracking with an approval/version/acknowledgement/audit-trail model, and contractor workforce compliance (PME/vocational-training/gate-pass expiry blocks site entry), work permits, equipment, and a safety scorecard. Types in `shared/types/documents.ts` / `shared/types/contractors.ts`, mock data in `shared/mock-data/sample-documents.json` / `sample-contractors.json`.
  - **This is frontend-only for now** — no Documents/Contractors backend exists yet, and nothing in `PLAN.md` covers this scope. Every function in `src/lib/documentsApi.ts` / `src/lib/contractorsApi.ts` tries the real REST endpoint first (each call site has a `// TODO(Team 3): ...` comment documenting the intended contract) and falls back to the mock JSON on failure, so the UI is fully usable with the backend offline.
  - Team 2's contractor risk-scoring model isn't wired up either; `computeFallbackRiskScore` in `src/lib/complianceUtils.ts` computes a deterministic stand-in from compliance % and incident count, marked `// TODO(Team 2): replace with POST /predict/contractor-risk`.
  - New shared UI primitives added for this: `src/components/ui/{Drawer,Modal,Tabs,Badge,ProgressRing,EmptyState,SkeletonLoader}.tsx` — reuse these before adding new modal/drawer/tab chrome elsewhere.

### Git / branch state

| Branch | Contents | Status |
|---|---|---|
| `main` | Upstream (`Kusumita-Patra/MinePilot`) | — |
| `t3-backend-integration` | Backend + auth + merged-in 3D twin + Settings redesign | PR #2 open into `main` |
| `feature/documents-contractors-panels` | Documents + Contractors panels | Pushed to origin, **not yet merged** into `t3-backend-integration` |

### Known follow-ups

- Documents/Contractors need a real backend (models, endpoints, and a file-storage decision for actual uploads) before the `TODO(Team 3)` markers can be wired up. This is genuinely new scope — treat it with the same schema/endpoint-table rigor as the rest of this file, and confirm before building rather than improvising, per §11.
- `POST /predict/contractor-risk` (Team 2) doesn't exist yet — see `computeFallbackRiskScore` above.
