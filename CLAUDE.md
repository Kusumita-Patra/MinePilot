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

## 12. Implementation status (as of 2026-09-11)

Running record of what's actually been built, so a new session (or teammate) doesn't have to re-derive it from git log. Update this section as work lands — don't let it go stale.

### Backend — built and working (`backend/`)

- **Auth** (`routers/auth.py` + `services/auth_service.py` + `schemas/auth.py`): register, login, `GET /me`, `POST /change-password`, `PATCH /me` (full name), `POST /update-email`. Email/password changes require current-password confirmation; a wrong current password returns **403**, not 401 — 401 is reserved strictly for "session/token invalid" since the frontend treats any 401 as a global logout signal. `POST /api/auth/register`'s `role` field is restricted to `mine_manager`/`field_worker` (`SelfRegisterableRole` in `schemas/auth.py`) — `administrator` is never self-registerable; see the Administrator role section below for how admin accounts actually get created.
- **Roles**: `administrator`, `mine_manager`, `field_worker` (Postgres native enum `user_role`, `backend/app/models/enums.py`). Two authorization primitives now exist side by side in `core/security.py`: `require_role(*roles)` — the original fixed dependency, still used for endpoints where "who can access this" is a hardcoded platform invariant (admin dashboard, mine-structure, and the permissions endpoints themselves — see below); and `require_permission(capability)` — a **dynamic, admin-editable** dependency that checks the `role_permissions` table instead of a hardcoded role list. `administrator` always bypasses `require_permission` entirely (hardcoded superuser, never stored in the table) — this is deliberate and is what prevents a bad permission edit from ever locking every administrator out of the system.
  - **This replaced an earlier fixed-RBAC design mid-session, per explicit user instruction** ("I don't want the fixed role based control access"): `/admin/roles` was originally a read-only static matrix; it's now a live editable one, and the following endpoints moved from `require_role` to `require_permission`: blueprint upload/section CRUD (`blueprint.write`), `GET /api/users` (`users.view`), user create/role/status (`users.manage`), `POST /api/inspections` (`inspections.schedule`), incident transitions (`incidents.transition`/`incidents.sign_off`, via `incident_service._check_role_permission`, now async + DB-aware), and `/api/admin/{audit-logs,system-health,alert-rules,compliance-rules}` (`audit_logs.view`/`system_health.view`/`governance.view`/`governance.edit`). The capability catalog lives in `backend/app/core/permissions.py`; seed defaults (migration `d4e5f6a7b8c9`) exactly match what each endpoint's old hardcoded role check used to allow, so applying the migration changes nothing until an administrator actually edits a cell.
- **Users**: `GET /api/users` (`mine_manager` **and** `administrator` — the Manager Dashboard's Workforce page depends on this staying open to managers, don't lock it to admin-only). `POST /api/users`, `PATCH /api/users/{id}/role`, `PATCH /api/users/{id}/status` (all **administrator-only**, `services/user_service.py`) — role/status changes on your own account are blocked with a 409 (can't self-promote-away-from-admin or self-lockout).
- **Incidents**: full state machine (`TRIGGERED → ASSIGNED → RESOLVED → ESCALATED → SIGNED_OFF`) with per-role allowed-transition checks; `administrator` has the same allowed-targets set as `mine_manager` in `_check_role_permission`.
- **Telemetry**: WebSocket ingestion from T2's simulator (`inference_api.py`), persisted to Postgres, re-broadcast to authenticated frontend clients in the exact `shared/types/telemetry.ts` `SensorFrame` shape. The upstream client connects with `ping_interval=None` (`services/telemetry_service.py`) — T2's simulator loop doesn't reliably answer WebSocket pings in time, which was tripping the default 20s ping_timeout and dropping an otherwise-healthy connection roughly every second (visible as `0 sensors` on the Dashboard / 3D Mine View live feed despite the WS showing "connected"). We don't own that server, so the fix is on our client only; the constant frame stream is itself a sufficient liveness signal. `telemetry_service.get_ingestion_status()` now tracks the last-frame timestamp for the admin System Health check (module-level, additive — doesn't touch ingestion/persistence logic).
- **Inspections, KPIs, Analytics (compliance breakdown), Health** — all following the router→service→schema pattern in §6, all through the standard envelope in §7.
- **Mine Blueprints** (`models/blueprint.py`, `schemas/blueprint.py`, `services/blueprint_service.py`, `routers/blueprints.py`) — real backend, not mocked. `MineBlueprint` (an **administrator**-uploaded aerial/plan image — ownership moved from `mine_manager` to `administrator` for all 4 write endpoints: upload, section create/update/delete) has many `BlueprintSection` rows (an admin-traced tunnel polyline in pixel coordinates, a display name, `sector_id`, `level_label`, `depth`, plus `zone_type` — `NORMAL/RESTRICTED/EMERGENCY/HIGH_RISK/WORK_ZONE` — and `status` — `ACTIVE/CLOSED/UNDER_MAINTENANCE`, both added by migration `b2c3d4e5f6a7`). `GET /api/blueprints/active` and `GET /api/blueprints/{id}/image` stay open to **any authenticated role** (unchanged) — this is what keeps mine_manager's read-only view and the Digital Twin working without any change. `GET /api/blueprints/history` (new, any authenticated role) lists every uploaded blueprint oldest-first with a computed `version`/`is_active` (most-recent-timestamp = active, same rule as before — no new column). Migration `3b464ec79ddd` (original tables).
  - **Gotcha already hit and fixed**: `db.commit()` expires *every* ORM attribute by default (`expire_on_commit=True`), relationships included. `create_blueprint` must name `sections` explicitly in the post-commit `db.refresh(blueprint, attribute_names=["created_at", "sections"])` — otherwise `BlueprintResponse`'s serialization touches the expired `sections` relationship and lazy-loads outside an awaited context (`MissingGreenlet`). If a similar response schema ever nests a relationship again, refresh needs the same treatment.
- **Administrator governance** (new, `models/audit_log.py`, `models/alert_rule.py`, `models/compliance_requirement.py`, `services/admin_service.py`, `services/alert_rule_service.py`, `services/compliance_requirement_service.py`, `routers/admin.py`, migration `c3d4e5f6a7b8`):
  - `admin_audit_logs` — `AdminAuditLog(actor_user_id, actor_role, action, resource_type, resource_id, description, log_metadata [DB column `metadata`], created_at)`, written via `services/audit_service.py`'s `record()` (only accepts these named fields — never a raw request body, so a password/JWT can't end up in a log entry). Written after every blueprint write, user create/role-change/status-change, and alert/compliance rule change. `GET /api/admin/audit-logs` (paginated).
  - `GET /api/admin/system-health` — **real checks**, not hardcoded: `SELECT 1` for the DB, the telemetry ingestion loop's last-frame timestamp for the WebSocket, a short-timeout HTTP GET to `settings.ml_service_rest_url` for the AI Risk Service (any response = reachable, connection error/timeout = unavailable — doesn't assume any specific route on T2's service), and "responded to this request" for the backend API itself.
  - `GET /api/admin/mine-structure` — the mine's level/zone structure, derived entirely from the active blueprint's `BlueprintSection` rows grouped by `level_label` (no new `mine_levels`/`mine_zones` table — that data already lives on `BlueprintSection`).
  - `alert_rules` (`AlertRule`: `rule_key`, `display_name`, `warning_threshold`, `critical_threshold`, `unit`, `is_active`) and `compliance_requirements` (`ComplianceRequirement`: `applies_to` [WORKER/CONTRACTOR], `document_type`, `warning_threshold_days`, `critical_threshold_days`, `is_active`) — real admin-manageable governance tables (`GET`/`PATCH` and `GET`/`POST`/`PATCH` respectively, all administrator-only), seeded with the categories/documents from the product spec. **Important limitation, stated in the UI too**: these are stored governance records only — verified that `telemetry_service._process_frame` takes `risk_level`/`risk_score` verbatim from T2's upstream frame, so our backend has no independent threshold logic to wire these into yet, and T2's `risk_scoring.py` is off-limits per §1. Not fake, just not load-bearing yet.
  - `backend/scripts/promote_to_admin.py` — the only way to create the *first* administrator: register a normal account through the app (any role), then run `python -m scripts.promote_to_admin <email>` to promote it. After that, administrators create further admins/managers/workers via `POST /api/users`.
- **DB**: Supabase Postgres via SQLAlchemy async + asyncpg, `NullPool` + a per-connection `prepared_statement_name_func` (uuid-based) to work around pgbouncer transaction-pooling mode rejecting named prepared statements. 7 Alembic migrations: initial schema, incident ticket sequence, blueprint tables, administrator role (`ALTER TYPE user_role ADD VALUE` — the first migration in this repo to alter an enum post-creation; safe on Postgres 12+/Supabase since the new value is never used within the same migration), blueprint section zone fields, admin governance tables, `role_permissions` table (`d4e5f6a7b8c9`, seeded to match prior hardcoded behavior exactly).

### Frontend — built and working (`src/`)

- Zustand `authStore` (JWT + user, persisted to localStorage) and a `RequireAuth` role-gated route guard; sign-up and sign-in flows for both `mine_manager` and `field_worker`. `UserRole` is now `"administrator" | "mine_manager" | "field_worker"`; `RequireAuth`'s `ROLE_HOME` map and the login page's post-login redirect both route `administrator` → `/admin`. `authStore.AuthUser` also carries `is_active`/`created_at` now (always present on the backend's `UserResponse`, just never declared here until the admin Users page needed them).
- Dashboard shell (`Header` + `Sidebar` + `RequireAuth`) wraps every `/dashboard/*` route automatically via `src/app/dashboard/layout.tsx` — its `RequireAuth allowedRoles` is now `["mine_manager", "administrator"]` (an administrator can also use the operational Manager Dashboard; a small "Admin Console" link appears in the Header when signed in as one). **Settings lives at `/dashboard/settings`** inside that shell for managers (not a standalone page) — a collapsible "Update Personal Information" panel (full name / email / password, each its own accordion row; email and password changes require current-password confirmation). `/field` is the standalone field-worker view; its own `/settings` route (no sidebar) now only renders for field workers — a manager landing there gets redirected to `/dashboard/settings`.
- The 3D digital twin was merged in from Team 1's upstream work (`MineDigitalTwinContainer`, `MineScene`, etc.). A missing `mine.glb` is handled by a `useModelAvailability` HEAD-check hook (`src/components/digital-twin/useModelAvailability.ts`) so a missing model falls back to `MineTerrain` without ever throwing (avoids a false-positive Next.js dev-overlay error). It's wired up on both the Dashboard's inline panel *and* the standalone `/dashboard/mine-view` page (`src/app/dashboard/mine-view/page.tsx`) — the latter had been left rendering a leftover placeholder div ("Waiting for Team 1's `<MineDigitalTwin />` component") since whenever that route was scaffolded; fixed to render the real `<MineDigitalTwin />` with live sensor selection, same as the Dashboard.
- **Needs Sign-Off** (`src/app/dashboard/IncidentSignOff.tsx`) now shows the field worker's verification note (`Incident.field_remarks`) under each pending ticket — that field was already flowing end-to-end (worker's "Verification notes" textarea on `/field` → `PATCH /api/incidents/{id}` → DB → `GET /api/incidents`), it just wasn't rendered, so a manager was signing off blind.
- **Analytics → Sector Risk History** (`src/components/analytics/SectorRiskHistory.tsx`, extracted out of `analytics/page.tsx`) was redesigned to feel like a stock-price chart: 1H/2H/5H/12H/1D/2D/5D/7D/15D/30D range tabs (`src/lib/timeRanges.ts`), a metric toggle between Risk Score and each of the 5 raw telemetry fields, a big current-value + delta header (red-up/emerald-down, since rising risk is bad — the opposite of stock-app convention, done deliberately), and a crosshair hover that **linearly interpolates between the two bracketing data points** so the dot/tooltip slide continuously with the mouse instead of snapping between samples (the line itself uses `type="linear"` so this interpolation exactly matches what's drawn). The hover tooltip shows every field at that point (not just the active metric), and positions itself on whichever side/half of the chart the hovered point *isn't* in — preferring to stay inside the plot but allowed to spill into the surrounding card if there's no room, rather than ever covering the curve. `getTelemetryHistory` (`src/lib/api.ts`) now accepts `from`/`to` and returns the full `telemetry` object (the type was narrower than what the backend actually returned).
- **Analytics → Future Predictions** (`src/components/analytics/FutureRiskPrediction.tsx`, new card below Sector Risk History): calls T2's standalone `inference_api.py` `/api/v1/predict-risk` directly for a short-horizon (~15 min) forecast plus `anomaly_factors`, via a new `src/lib/predictRiskApi.ts` and a new env var `NEXT_PUBLIC_INFERENCE_API_URL` (default `http://localhost:8000`) — distinct from `NEXT_PUBLIC_API_URL`, which points at our own backend. `anomaly_factors` strings are mapped to plain-language mitigation suggestions via `src/lib/riskMitigationSuggestions.ts` (parsed against the exact string shapes `risk_scoring.py` produces — read-only reference, not modified). Degrades to a clean empty state if the inference service isn't reachable. **Flag for the team**: this is new cross-service integration scope not covered in `PLAN.md`, per §11.
- Added `src/lib/format.ts` (`formatSectorId`) and swapped every place a raw `sector_id` was being displayed (some with underscores untouched, e.g. "sector_north_wall", some already `.replace(/_/g, " ")`'d but not capitalized) to use it consistently — Sector Risk Ranking, Needs Sign-Off, Recent Alerts, the field-worker view, the incidents table, the telemetry inspector drawer, and the sector pickers/tables on Compliance, Mine View, Inspections, Reports, and Violations.
- Fixed a spurious double vertical scrollbar on `src/components/ui/Tabs.tsx`'s tab row — Tailwind's `overflow-x-auto` alone leaves `overflow-y` at its default, but per the CSS overflow spec that makes the browser treat the omitted axis as `auto` too; added `overflow-y-hidden` explicitly.
- **Documents panel** (`/dashboard/documents`) and **Contractors panel** (`/dashboard/contractors` + `/dashboard/contractors/[contractorId]`): compliance-risk surfaces modeled on real Indian mine-compliance workflows (Mines Act 1952, DGMS, CLRA 1970) — statutory-document expiry tracking with an approval/version/acknowledgement/audit-trail model, and contractor workforce compliance (PME/vocational-training/gate-pass expiry blocks site entry), work permits, equipment, and a safety scorecard. Types in `shared/types/documents.ts` / `shared/types/contractors.ts`, mock data in `shared/mock-data/sample-documents.json` / `sample-contractors.json`.
  - **This is frontend-only for now** — no Documents/Contractors backend exists yet, and nothing in `PLAN.md` covers this scope. Every function in `src/lib/documentsApi.ts` / `src/lib/contractorsApi.ts` tries the real REST endpoint first (each call site has a `// TODO(Team 3): ...` comment documenting the intended contract) and falls back to the mock JSON on failure, so the UI is fully usable with the backend offline. The new admin Compliance Rules page (`/admin/compliance`) is a separate, real-backend governance surface for document-type/expiry-threshold *master data* — it is deliberately not wired into these mock-backed panels.
  - Team 2's contractor risk-scoring model isn't wired up either; `computeFallbackRiskScore` in `src/lib/complianceUtils.ts` computes a deterministic stand-in from compliance % and incident count, marked `// TODO(Team 2): replace with POST /predict/contractor-risk`.
  - New shared UI primitives added for this: `src/components/ui/{Drawer,Modal,Tabs,Badge,ProgressRing,EmptyState,SkeletonLoader}.tsx` — reuse these before adding new modal/drawer/tab chrome elsewhere (the admin pages below reuse Modal/Badge/EmptyState rather than inventing new chrome).
- Fixed a real bug in `src/lib/api.ts`'s `apiFetch`: it unconditionally set `Content-Type: application/json`, which silently broke every `FormData` upload (the browser never got to set its own multipart boundary). Now conditional on `options.body instanceof FormData`.

### Administrator role & Admin Command Center (new, `src/app/admin/`)

- **Route tree**: `src/app/admin/layout.tsx` (`RequireAuth allowedRoles={["administrator"]}` + `AdminHeader` + `AdminSidebar`, same dark command-center visual language as the Manager Dashboard shell, reusing existing `ui/` primitives — no second design system) wraps `/admin` (dashboard), `/admin/mine/blueprint` (full upload/trace/history CRUD — the authoritative editor, superseding what `/dashboard/blueprint` used to be), `/admin/mine/zones` (Mine Levels & Zones, derived view), `/admin/users` (user management: create, role change, activate/deactivate, each destructive-ish action behind a confirmation modal, self-action disabled in the UI to match the backend's 409 guard), `/admin/roles` (a **live, editable** permission matrix — `GET`/`PATCH /api/admin/permissions`, backed by the `role_permissions` table; toggling a cell changes real backend authorization immediately, no redeploy; administrator's column is a fixed "Full" badge, not editable, by design), `/admin/compliance`, `/admin/alerts` (with a persistent on-page notice about the "governance record only, not yet wired to the risk engine" limitation described above), `/admin/audit-logs` (paginated), `/admin/system-health` (polls every 15s), `/admin/settings` (reuses the same role-agnostic `SettingsContent` component `/dashboard/settings` uses).
- **`/dashboard/blueprint` is now read-only** for whoever views it (manager or an administrator browsing the operational dashboard) — image + section list with zone_type/status badges, no upload/tracer/edit controls; administrators see a "Configure in Admin Console" link through to `/admin/mine/blueprint`. The Digital Twin's data contract (`GET /api/blueprints/active`'s shape) is completely unchanged, so nothing downstream of it needed touching.
- **`src/lib/api.ts`** gained the admin-only client functions (`getAdminDashboard`, `getSystemHealth`, `getAuditLogs`, `createUser`, `updateUserRole`, `updateUserStatus`, `getMineStructure`, `getAlertRules`/`updateAlertRule`, `getComplianceRequirements`/`createComplianceRequirement`/`updateComplianceRequirement`); **`src/lib/blueprintApi.ts`** gained `zone_type`/`status` on `BlueprintSection`, `getBlueprintHistory`, and `updateBlueprintSection` (wiring up the backend's PATCH endpoint, which existed already but had no frontend caller before this).
- **Verified end-to-end**, not just type-checked: registered a manager and an admin-to-be account against the real Supabase dev DB, ran `promote_to_admin.py`, and exercised the full flow via curl + a real browser session — admin login → `/admin` redirect and dashboard render with live data; manager login → `/dashboard`; manager navigating directly to `/admin/users` gets silently redirected back to `/dashboard` (no admin nav visible in the Sidebar/Header at all); manager `POST /api/blueprints` → 403 in the standard envelope; unauthenticated `/api/admin/*` → 401; user create/role-change/status-change/self-action-409 all confirmed with real requests and cross-checked against `/api/admin/audit-logs`. The dynamic permission system was verified live too: granted `governance.edit` to `mine_manager` via `PATCH /api/admin/permissions/{id}`, confirmed the manager could immediately `POST /api/admin/compliance-rules` (previously 403), revoked it, confirmed 403 again — then repeated the grant/revoke by clicking the actual toggle in `/admin/roles` in a real browser. Full `next build` and `alembic upgrade head` against the live DB both succeed.
- **Bug fixed this session**: `/dashboard/blueprint` (and `/admin/mine/blueprint`'s tracer) originally gated their *entire* panel — including the section list, which needs no image at all — on the blueprint image blob successfully loading. Since `backend/uploads/blueprints/` is gitignored and local-disk-only, a fresh checkout/redeploy with no files on disk yet made the whole panel render nothing, not even a "no blueprint" message. Both pages now render the section list unconditionally once a blueprint exists, with a small "image unavailable" placeholder in the image slot instead of blanking the page — this is a real robustness gap in the local-disk storage approach, not just a first-run artifact, and would resurface on Render after any redeploy that doesn't persist `backend/uploads/`.

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
| `main` | Upstream (`Kusumita-Patra/MinePilot`) | Current branch as of this writing. `t3-backend-integration`, `feature/documents-contractors-panels`, and the analytics/3D-twin work referenced below are all merged in (see `927ec1c`/`b077249`/`022a2d8` in `git log`). The Administrator role & Admin Command Center work in this section was built directly against `main`. |

### Frontend caught up to the dynamic permission system (fixed same session)

Right after the dynamic RBAC rollout above, granting a capability to `mine_manager`/`field_worker` via `/admin/roles` had no visible effect in their portal — the backend enforced it correctly, but every relevant UI control was still hardcoded to only render for `administrator`. Fixed by making the frontend permission-aware end to end:

- `GET /api/auth/permissions` (new, any authenticated user) returns the caller's own `{capability: bool}` map (`services/permission_service.get_my_permissions`; administrator = everything true). `src/lib/permissionsStore.ts` (Zustand, keyed by user id so switching accounts in one tab can't leak stale permissions — cleared on `authStore.logout()`) + `src/hooks/usePermissions.ts` (`const { can } = usePermissions()`) is how every page below decides what to show.
- **Blueprint**: `UploadPanel`/`TracerPanel`/`BlueprintHistoryPanel`/`ActiveBlueprintSummary` extracted into `src/components/blueprint/BlueprintEditor.tsx`, shared by `/admin/mine/blueprint` (always full editor) and `/dashboard/blueprint` (full editor when `can('blueprint.write')`, else the original read-only viewer). One editor implementation, so a grant/revoke just changes which UI a role sees.
- **Users**: same pattern — `src/components/users/UserManagementPanel.tsx` (`canManage` prop) shared by `/admin/users` and `/dashboard/workforce` (`canManage={can('users.manage')}`). The old read-only-only `useUsers` hook was deleted as dead code once Workforce switched to the same `getUsers()`-based fetch as the admin panel.
- **Governance/Audit Logs/System Health** never had *any* manager-facing surface before (always admin-only by original design) — now real ones exist: `src/components/governance/{AlertRulesPanel,ComplianceRulesPanel}.tsx` (`canEdit` prop) power both `/admin/{alerts,compliance}` and the new `/dashboard/governance` (tabbed, shown when `can('governance.view')`, edit controls only when `can('governance.edit')` too); `src/components/audit/AuditLogsPanel.tsx` and `src/components/health/SystemHealthPanel.tsx` power both the admin pages and new `/dashboard/audit-logs` / `/dashboard/system-health`. `dashboard/Sidebar.tsx` shows a "Granted Access" nav group listing only the ones the signed-in user actually has.
- **Incident sign-off** (`IncidentSignOff.tsx` and `IncidentsTable.tsx`) now also requires `can('incidents.sign_off')`, not just incident status, so a revoked manager sees a disabled button instead of one that 403s. **Inspection scheduling** (`/dashboard/inspections`) similarly hides the schedule form unless `can('inspections.schedule')`.
- **Not yet done** (lower priority — defaults preserve today's behavior, this only matters if an admin *revokes* the default grant): `/field`'s assign/resolve/escalate buttons aren't permission-gated — field workers keep `incidents.transition` by default and this page's offline-queueing logic (`updateIncidentOffline`) wasn't touched to avoid destabilizing it under time pressure.

### field_worker renamed to "Field Inspector" in the UI, and its access made permanently fixed (fixed same session)

Per explicit user instruction: `field_worker` is displayed as **"Field Inspector"** everywhere in the frontend now (role labels in `Header.tsx`, `PersonalInfoSection.tsx`, `UserManagementPanel.tsx`, signup/login copy, `/admin/roles`, `/admin` dashboard stat card) — the backend role key, JWT claim, and DB enum value are all still `field_worker` (renaming those would mean an enum-value migration and touching every `"field_worker"` string comparison for no user-visible benefit; the display label was the only thing asked for).

More substantively: **Field Inspector access is no longer part of the dynamic permission system at all** — only `mine_manager` is admin-editable now.
- `backend/app/core/permissions.py`'s `FIELD_WORKER_FIXED_CAPABILITIES = {"incidents.transition"}` is the single source of truth. `permission_service.is_allowed`/`get_my_permissions` hardcode field_worker's answer from this set and never touch `role_permissions` for that role; `list_matrix` only reads `mine_manager` rows and reports field_worker's cell as `{id: None, allowed: <fixed value>}`; `update_permission` explicitly rejects (409) any attempt to modify a non-`mine_manager` row, even if a stale id were somehow reached.
- Migration `e5f6a7b8c9d0` deleted the now-dead `field_worker` seed rows from `role_permissions` (migration `d4e5f6a7b8c9`'s seed data) for hygiene — nothing reads them regardless.
- `/admin/roles`: Field Inspector's column is a locked, non-interactive badge (🔒 + check/✗ per row) instead of a toggle — matches Administrator's "Full" badge pattern, just showing the real per-capability fixed value instead of always-true.
- `administrator` was already hardcoded this way (never in the table, always allow) — Field Inspector now follows the same pattern, just with a narrow fixed set instead of "everything." The only role whose access an administrator can actually reconfigure at runtime is `mine_manager`.

### Sensor Registry & Spatial Placement (new)

Administrators can now register/configure/place sensors independent of the telemetry ingestion pipeline — this is a real, separate backend feature, not a UI mock.

- **`sensor_configs`** (new table, `backend/app/models/sensor_config.py`) is the administrator-owned registry — deliberately separate from `models/sensor.py`'s `Sensor` table, which remains untouched and is still a pure telemetry-ingestion cache auto-upserted by `telemetry_service._process_frame` with zero admin involvement. `sensor_configs.sensor_id` is a plain unique string, **not a foreign key** to `sensors.sensor_id` — an administrator can register/place a sensor before it has ever sent its first telemetry frame (configure → then monitor). Fields split cleanly into identity (`display_name`, `sensor_type`, `manufacturer`, `model`), lifecycle (`status`: `ACTIVE/INACTIVE/MAINTENANCE/RETIRED` — deliberately excludes `OFFLINE`, which is a *computed* `is_reporting` flag derived from `Sensor.last_seen_at` freshness, not a stored status, per the explicit instruction not to conflate "intentionally disabled" with "not currently reporting"), placement (`blueprint_id`, `section_id` [nullable], `sector_id`, `level_label`, `depth`, `pixel_x`/`pixel_y`), governance thresholds (`warning_threshold`/`critical_threshold` — **same honesty caveat as `AlertRule`**: verified `_process_frame` takes `risk_level`/`risk_score` verbatim from T2, so these don't feed real risk classification), and calibration (`last_calibration_at`/`next_calibration_at`, with `calibration_status` — `VALID`/`DUE_SOON`/`OVERDUE` — computed at read time, not stored).
- **Coordinate convention reused exactly from Blueprint sections, verified by reading `MineTerrain.tsx` directly** (not assumed): `pixel_x`/`pixel_y` are pixel coordinates on the blueprint source image (same as `BlueprintSection.path` points); `depth` is used as the raw world-Y coordinate with zero further scaling (`y={section.depth}` in `MineTerrain.tsx:425`). No new coordinate system was introduced.
- **Router** `backend/app/routers/sensors.py` (prefix `/api/sensors`): `GET ""`/`GET "/{id}"`/`GET "/{id}/history"` open to any authenticated role (Manager viewing — matches the existing telemetry endpoints' openness); `GET "/stats"`, `POST ""`, `PATCH "/{id}"`, `PATCH "/{id}/status"`, `PATCH "/{id}/location"` are **fixed `require_role(administrator)`** — deliberately *not* part of the dynamic `role_permissions` system, unlike `blueprint.write`/`users.manage`. The spec for this feature repeated "Manager MUST NOT modify authoritative configuration" far more emphatically than the blueprint-ownership framing did, so this is a structural boundary, not a togglable grant.
- **History reuses the existing `admin_audit_logs` table** (`admin_service.list_audit_logs_for_resource`, filtered by `resource_type='sensor'`) — no second audit/history table was created. Every mutation (`sensor.register`/`sensor.update`/`sensor.status_change`/`sensor.move`) is audited, verified live end-to-end including the move endpoint's before/after location metadata.
- **How this reaches the Manager's live 3D view — the actual integration point, and its honest limitation**: the Digital Twin's sensor markers (`SensorMarkers.tsx`/`SensorPin.tsx`) still render *exclusively* from live `SensorFrame` telemetry — this frozen contract was not touched, and no fake telemetry was fabricated to make a configured-but-not-yet-streaming sensor appear as a 3D marker. Instead, `TelemetryInspectorDrawer.tsx` (opened by the existing `onSelectSensor` click flow, unchanged) now additionally fetches `GET /api/sensors/{sensor_id}` and layers in a read-only "Registry Information" section (type, thresholds, calibration) when a config row exists for that `sensor_id` — verified live: clicking a live sensor with no registry entry shows the drawer exactly as before (no crash, no extra section); a registered sensor would show both. A sensor that's configured but not yet streaming has **no 3D marker at all** (nothing to render it from) — visible only in the Admin Sensor Registry. This is a documented limitation, not a gap being papered over.
- **Frontend**: `src/lib/sensorsApi.ts` (client), `/admin/mine/sensors` (registry table, search/filter/empty-state), `/admin/sensors/[sensorId]` (tabbed detail: Overview/Calibration/History, with Edit/Reactivate-Deactivate/Retire actions each behind a confirmation modal), and a **new "Sensors" tab on `/admin/mine/blueprint`** (`src/components/sensors/SensorPlacementPanel.tsx`) — click-to-place on the same blueprint image used for tunnel tracing, reusing that exact canvas pattern. This placement panel is **deliberately a separate component from `BlueprintEditor.tsx`'s shared `TracerPanel`** (which a manager can also render on their own dashboard if granted `blueprint.write`) — sensor placement must never appear for a manager regardless of that grant, so it only ever mounts on the admin-only blueprint page.
- **Verified end-to-end live** (not just type-checked): registered a sensor via curl, confirmed 403 for a manager attempting `POST /api/sensors`, moved it (old→new location captured in audit metadata), deactivated/reactivated it, confirmed the full history trail, confirmed `/api/sensors/stats` is admin-only, and confirmed in a real browser that (a) the registry table, detail page, and placement-tab UI all render correctly, and (b) clicking a *live, unregistered* telemetry sensor in the Manager Dashboard still opens the inspector drawer exactly as before with no registry section and no error.
- **Migration** `f6a7b8c9d0e1` — new `sensor_type`/`sensor_config_status` enums + `sensor_configs` table, no seed data (an empty registry with a real empty-state UI is the correct starting condition here, unlike `alert_rules`/`compliance_requirements`).

### Explicitly deferred from the Sensor Registry work (proposed shape only, not built)
- **Equipment Registry**: same pattern as `SensorConfig` — an `equipment_configs` table (`equipment_id`, `equipment_type` [CONVEYOR, VENTILATION_FAN, PUMP, EXCAVATOR, CRUSHER, HOIST, TRANSFORMER, CONTINUOUS_MINER], status, the same blueprint/section/sector/level/pixel/depth placement fields) plus its own router/schema/admin pages, reusing the same placement-canvas pattern. No existing equipment telemetry/health source exists yet, so an equipment row's "health" would have to stay unpopulated until one does.
- **Safety Zones**: an `mine_zones` table (name, `ZoneType` — already exists on `BlueprintSection`, would be reused — level, sector, a point-set in the same pixel-coordinate convention, status, description), Manager-visible/read-only in the 3D view, admin-only to define/edit.
- Both were explicitly scoped out of this pass per user confirmation (Sensors-only, fully real) — the spec's own phase ordering already lists them after the sensor phases, and this codebase now has a working, verified example of the full pattern (coordinate reuse, audit integration, fixed-vs-dynamic RBAC boundary) to replicate rather than design from scratch.

### Known follow-ups

- Documents/Contractors need a real backend (models, endpoints, and a file-storage decision for actual uploads) before the `TODO(Team 3)` markers can be wired up. This is genuinely new scope — treat it with the same schema/endpoint-table rigor as the rest of this file, and confirm before building rather than improvising, per §11.
- `POST /predict/contractor-risk` (Team 2) doesn't exist yet — see `computeFallbackRiskScore` above.
- `NEXT_PUBLIC_INFERENCE_API_URL` needs to land in every dev's local `.env.local` (see §4 of the README) for Future Predictions to work — it degrades gracefully without it, but silently.
- No blueprint "activate/switch" step — uploading a new blueprint always becomes the active one via most-recent-timestamp. Fine for one mine; would need a real activation endpoint if multiple blueprints need to coexist.
- Pixel→world scale for blueprint tracing is a fixed normalization (longest image side → ~500 world units), not real georeferencing — traced tunnels are proportionally-plausible, not metrically accurate to the source map's actual scale bar.
- The admin blueprint tracer UI's click-to-point math itself (tracing a *brand-new* section by clicking on the image) was not re-verified in-browser this session — the active blueprint's image file 404s in this local dev environment (`backend/uploads/blueprints/` is gitignored and empty here; the DB rows reference files that only ever existed on whoever's machine originally uploaded them), so the `<img>`/`<svg>` overlay never mounted to click-test against. The backend 404s cleanly and the frontend degrades gracefully (confirmed), and the *unmodified* click-handling code was already working before this session — but re-verify with a real uploaded image before relying on it for a demo.
- Compliance Rules and Alert Rules (`/admin/compliance`, `/admin/alerts`) are real, persisted, admin-editable governance tables — but their values are not read by any runtime logic yet (T2's `risk_scoring.py` is off-limits, and this backend has no independent alert-threshold logic to wire them into). Stated on both pages; don't assume changing a threshold there changes live behavior.
- No automated end-to-end HTTP+DB test harness exists (`backend/tests/` is pure unit/service-level, no `TestClient`/DB fixtures) — the role-enforcement tests match that existing convention (call `require_role(...)`/`require_permission(...)`'s dependency functions directly, using a small hand-rolled fake `AsyncSession` for the `require_permission` tests since those need a canned DB response), and the admin flows were instead verified manually via curl + a real browser session against the live dev DB this session. A future session may want to add a real `TestClient` + test-DB harness for true HTTP-level regression coverage.
- Blueprint images are local-disk-only (`backend/uploads/blueprints/`, gitignored) with no cloud storage — this survives fine on a single long-running server but not across a redeploy that wipes local disk (e.g. Render without a persistent volume) or a fresh checkout. The blueprint viewer pages now degrade gracefully when an image is missing (see the bug-fix note above), but the underlying image itself is still genuinely gone in that case — re-uploading is the only recovery. Worth a real object-storage backend (S3-compatible) if this needs to survive redeploys reliably.
- The dynamic permission system intentionally does not let anyone (including via the API) touch `administrator`'s own access, or grant/revoke who can view/edit `/admin/roles` itself (`/api/admin/permissions` and `/api/admin/dashboard`/`/api/admin/mine-structure` stayed on the original fixed `require_role(administrator)` for this reason) — this is a deliberate, permanent guardrail against a permission edit ever locking every administrator out, not a gap to "finish" later.
