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
