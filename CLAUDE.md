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

## 12. Implementation status (as of 2026-09-09)

Running record of what's actually been built, so a new session (or teammate) doesn't have to re-derive it from git log. Update this section as work lands — don't let it go stale.

### Backend — built and working (`backend/`)

- **Auth** (`routers/auth.py` + `services/auth_service.py` + `schemas/auth.py`): register, login, `GET /me`, `POST /change-password`, `PATCH /me` (full name), `POST /update-email`. Email/password changes require current-password confirmation; a wrong current password returns **403**, not 401 — 401 is reserved strictly for "session/token invalid" since the frontend treats any 401 as a global logout signal.
- **Users**: `GET /api/users` (`mine_manager` only, via `require_role`).
- **Incidents**: full state machine (`TRIGGERED → ASSIGNED → RESOLVED → ESCALATED → SIGNED_OFF`) with per-role allowed-transition checks.
- **Telemetry**: WebSocket ingestion from T2's simulator (`inference_api.py`), persisted to Postgres, re-broadcast to authenticated frontend clients in the exact `shared/types/telemetry.ts` `SensorFrame` shape.
- **Inspections, KPIs, Analytics (compliance breakdown), Health** — all following the router→service→schema pattern in §6, all through the standard envelope in §7.
- **Mine Blueprints** (`models/blueprint.py`, `schemas/blueprint.py`, `services/blueprint_service.py`, `routers/blueprints.py`) — real backend, not mocked. `MineBlueprint` (an admin-uploaded aerial/plan image) has many `BlueprintSection` rows (an admin-traced tunnel polyline in the source image's pixel coordinates, plus a display name, a `sector_id` tying it to one of the 4 fixed sectors, a `level_label`, and a `depth`). `POST /api/blueprints` (multipart upload, `mine_manager` only) stores the image on local disk under `backend/uploads/blueprints/` (gitignored) and the row in Postgres; `GET /api/blueprints/active` returns the most-recently-uploaded blueprint + its sections (the "most recent = active" rule — no separate activation step yet) or `data: null` if none uploaded; `GET /api/blueprints/{id}/image` streams the file back (auth-gated, since `<img>` can't send an Authorization header — the frontend fetches it as a blob and uses an object URL); section CRUD is `mine_manager`-only. Migration `3b464ec79ddd`.
  - **Gotcha already hit and fixed**: `db.commit()` expires *every* ORM attribute by default (`expire_on_commit=True`), relationships included. `create_blueprint` must name `sections` explicitly in the post-commit `db.refresh(blueprint, attribute_names=["created_at", "sections"])` — otherwise `BlueprintResponse`'s serialization touches the expired `sections` relationship and lazy-loads outside an awaited context (`MissingGreenlet`). If a similar response schema ever nests a relationship again, refresh needs the same treatment.
- **DB**: Supabase Postgres via SQLAlchemy async + asyncpg, `NullPool` + a per-connection `prepared_statement_name_func` (uuid-based) to work around pgbouncer transaction-pooling mode rejecting named prepared statements. 3 Alembic migrations so far: initial schema, incident ticket sequence, blueprint tables.

### Frontend — built and working (`src/`)

- Zustand `authStore` (JWT + user, persisted to localStorage) and a `RequireAuth` role-gated route guard; sign-up and sign-in flows for both `mine_manager` and `field_worker`.
- Dashboard shell (`Header` + `Sidebar` + `RequireAuth`) wraps every `/dashboard/*` route automatically via `src/app/dashboard/layout.tsx`. **Settings lives at `/dashboard/settings`** inside that shell for managers (not a standalone page) — a collapsible "Update Personal Information" panel (full name / email / password, each its own accordion row; email and password changes require current-password confirmation). `/field` is the standalone field-worker view; its own `/settings` route (no sidebar) now only renders for field workers — a manager landing there gets redirected to `/dashboard/settings`.
- **Documents panel** (`/dashboard/documents`) and **Contractors panel** (`/dashboard/contractors` + `/dashboard/contractors/[contractorId]`): compliance-risk surfaces modeled on real Indian mine-compliance workflows (Mines Act 1952, DGMS, CLRA 1970) — statutory-document expiry tracking with an approval/version/acknowledgement/audit-trail model, and contractor workforce compliance (PME/vocational-training/gate-pass expiry blocks site entry), work permits, equipment, and a safety scorecard. Types in `shared/types/documents.ts` / `shared/types/contractors.ts`, mock data in `shared/mock-data/sample-documents.json` / `sample-contractors.json`.
  - **This is frontend-only for now** — no Documents/Contractors backend exists yet, and nothing in `PLAN.md` covers this scope. Every function in `src/lib/documentsApi.ts` / `src/lib/contractorsApi.ts` tries the real REST endpoint first (each call site has a `// TODO(Team 3): ...` comment documenting the intended contract) and falls back to the mock JSON on failure, so the UI is fully usable with the backend offline.
  - Team 2's contractor risk-scoring model isn't wired up either; `computeFallbackRiskScore` in `src/lib/complianceUtils.ts` computes a deterministic stand-in from compliance % and incident count, marked `// TODO(Team 2): replace with POST /predict/contractor-risk`.
  - New shared UI primitives added for this: `src/components/ui/{Drawer,Modal,Tabs,Badge,ProgressRing,EmptyState,SkeletonLoader}.tsx` — reuse these before adding new modal/drawer/tab chrome elsewhere.
- Fixed a real bug in `src/lib/api.ts`'s `apiFetch`: it unconditionally set `Content-Type: application/json`, which silently broke every `FormData` upload (the browser never got to set its own multipart boundary). Now conditional on `options.body instanceof FormData`.

### 3D Digital Twin (`src/components/digital-twin/`) — substantially built out this session

**Ownership note:** §1's team-ownership table lists the 3D twin as T1's, "not yet delivered." Team 1's upstream work (`MineDigitalTwinContainer`, `MineScene` skeleton, GLTF-loading scaffolding) is still what runs when a real `public/models/mine.glb` is present. Everything below is the **procedural fallback** (`MineTerrain.tsx` + `mineLayout.ts`), which — per direct, repeated user instruction across many turns in this session, not a T3-initiated scope grab — has grown from a placeholder into the actual working visualization, since no `mine.glb` exists yet. If T1 delivers a real model later, this fallback keeps working as the no-model case; nothing here needs to be torn out.

- **Procedural mine layout** (`mineLayout.ts`): an organic "vein" generator (`buildVeinNetwork`/`growVein`, deterministic via a seeded `mulberry32` PRNG, not `Math.random`) grows branching tunnel trees from the shaft in 8 compass directions across the two tunnel-bearing sectors, each wandering/forking at irregular angles rather than a rigid grid. `resolveCrossings` does a single global pass finding every place two segments actually cross in the X/Z plane and splits both into a shared junction — real connections, not tunnels silently passing through each other. `addOrganicCrossLinks` stitches a handful of nearby branch tips into loops. Result: ~900 tunnel segments across both levels, plus a densified cluster rooted at the surface conveyor's own footprint. `terrainRadius` sized to the network's actual generated reach (checked numerically, not guessed).
- **Rendering style**: every tunnel is a round, segmented, open-ended tube (`CylinderGeometry`, not a rectangular corridor) rendered via a shared `Holo` component — a translucent fill shell + a wireframe shell over one merged geometry (`mergeGeometries` from `three/addons/utils/BufferGeometryUtils.js`), unlit `MeshBasicMaterial` so it reads as glowing wireframe rather than realistically lit. The segmented cylinder's wireframe naturally draws cross-section rings + lengthwise lines + the diagonal splitting each cell — a "cage" look matching the reference digital-twin imagery, without needing a custom cross-hatch line geometry (an earlier attempt at that was reverted in favor of just switching tunnels from boxes to tubes).
- **Risk color language, unified**: `riskColors.ts` is the single source of truth (`RISK_COLOR: NORMAL → blue #2f7dff, WARNING → yellow #ffd400, CRITICAL → red #ff3b30`), imported by both `MineTerrain.tsx` (sector/tunnel tinting) and `SensorPlaceholder.tsx` (sensor markers) — previously two different, inconsistent palettes.
- **Click-to-inspect**: clicking any tunnel/shaft/conveyor reports the specific place name (not just the broad sector — every procedural vein and every blueprint section carries its own name, threaded through generation/merging/splitting) plus live risk status (SAFE/CAUTION/DANGER) in a floating card, and flies the camera in to focus on that spot (`CameraController`'s `focusPoint`).
- **Camera controls**: plain drag now **pans** across the huge network (`OrbitControls.mouseButtons = {LEFT: PAN, RIGHT: ROTATE}`) rather than orbiting in place, since panning-to-explore matters more than rotating-in-place at this scale; a click-driven rotate D-pad (`rotateBy`) covers angle-shifting since drag no longer does; explicit zoom +/- buttons alongside scroll/pinch; 6 camera presets (Overview, North Section, Main Tunnel Network, Deep Shaft B, Surface Conveyor, Top Down).
- **Mine Blueprints integration**: `/dashboard/blueprint` (new admin page, sidebar entry "Blueprint") lets a `mine_manager` upload an aerial/plan image and trace tunnel paths on it by clicking points, naming each one and assigning it a sector/level/depth. The dashboard's twin (`src/app/dashboard/page.tsx`) fetches the active blueprint (`useActiveBlueprint` hook) and converts each section's pixel path to world coordinates (normalized so the image's longest side maps to ~500 world units, regardless of actual resolution). **Blueprint-traced tunnels always render additively, layered on top of the procedural network — never replacing it** (an earlier version swapped the whole procedural network out per-sector the moment any blueprint section existed for it; that was wrong and got reverted). Each blueprint section gets a persistent floating name label in addition to the click-to-inspect card.

### Git / branch state

| Branch | Contents | Status |
|---|---|---|
| `main` | Upstream (`Kusumita-Patra/MinePilot`) | **Everything in this section is uncommitted working-tree changes on `main`** as of this writing — not yet on a feature branch, not yet committed. See `git status` before assuming any of it is safe to discard. |
| `t3-backend-integration` | Backend + auth + merged-in 3D twin + Settings redesign | PR #2 (may since be merged — re-check before assuming still open) |
| `feature/documents-contractors-panels` | Documents + Contractors panels | Merged into `main` (see `c46582c`) |

### Known follow-ups

- Documents/Contractors need a real backend (models, endpoints, and a file-storage decision for actual uploads) before the `TODO(Team 3)` markers can be wired up. This is genuinely new scope — treat it with the same schema/endpoint-table rigor as the rest of this file, and confirm before building rather than improvising, per §11.
- `POST /predict/contractor-risk` (Team 2) doesn't exist yet — see `computeFallbackRiskScore` above.
- Mine Blueprints backend/frontend wiring has been exercised end-to-end via direct API calls (register → upload → trace sections → verify via `GET /active`) and passes `tsc --noEmit` + compiles clean, but **the tracer UI's click-to-point math has not been visually verified in a browser** — no browser access was available this session. Worth an actual click-through before relying on it.
- No blueprint "activate/switch" step — uploading a new blueprint always becomes the active one via most-recent-timestamp. Fine for one mine; would need a real activation endpoint if multiple blueprints need to coexist.
- Pixel→world scale for blueprint tracing is a fixed normalization (longest image side → ~500 world units), not real georeferencing — traced tunnels are proportionally-plausible, not metrically accurate to the source map's actual scale bar.
