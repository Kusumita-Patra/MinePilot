# MinePilot — Smart Mine Digital Twin

An AI-based Smart Mine Digital Twin platform (built for Smart India Hackathon).
It streams live mine telemetry, renders it in a 3D digital twin, and surfaces
AI-generated risk scores and alerts to a command-centre dashboard and a
simplified field view.

The project has three runnable pieces that talk to each other over HTTP/WebSocket:

| Piece | Location | Owner | Default port |
|---|---|---|---|
| Frontend (Next.js dashboard + field view + 3D twin) | repo root (`src/`) | T4 | `3000` |
| ML / risk-inference + telemetry simulator | repo root (`inference_api.py` and friends) | T2 | `8000` |
| Backend (auth, incidents, telemetry relay, KPIs) | `backend/` | T3 | `8001` |

You need all three running locally for the full app to work end-to-end. The
frontend and backend both degrade gracefully (mock data / retry-with-backoff)
if the other services aren't up yet, so you can bring them up in any order.

See `PLAN.md` for the full backend design and `CLAUDE.md` for team ownership
and working conventions.

---

## Prerequisites

- **Node.js 20+** and npm
- **Python 3.13** (recommended — better prebuilt wheels for `asyncpg`/`bcrypt`/`xgboost` than 3.14)
- A **Postgres** database (the project uses Supabase in production; any Postgres
  instance works for local dev) — only needed for the backend

---

## 1. Frontend (Next.js) — port 3000

```bash
# from the repo root
npm install
npm run dev
```

Open **http://localhost:3000**.

Create a `.env.local` file in the repo root (gitignored) with:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8001
NEXT_PUBLIC_WS_URL=ws://localhost:8001
```

(these point at the T3 backend, not the ML service directly).

---

## 2. ML / risk-inference service (T2) — port 8000

This generates synthetic telemetry and serves risk predictions. It has its
own Python environment, separate from the backend.

```bash
# from the repo root
python3.13 -m venv .venv-t2
./.venv-t2/bin/pip install -r requirements.txt

# one-time: generate synthetic telemetry + train the models
./.venv-t2/bin/python data_generator.py
./.venv-t2/bin/python train_anomaly_model.py
./.venv-t2/bin/python train_forecast_model.py

# start the service
./.venv-t2/bin/uvicorn inference_api:app --reload --port 8000
```

Swagger docs: **http://localhost:8000/docs**.

> If you skip training, `inference_api.py` still starts — it falls back to
> rule-based (threshold-only) scoring instead of the ML models.

Do not modify `inference_api.py`, `risk_scoring.py`, or `data_generator.py` —
they belong to T2 (see `CLAUDE.md`).

---

## 3. Backend (T3) — port 8001

```bash
cd backend
python3.13 -m venv .venv
./.venv/bin/pip install -r requirements.txt
cp .env.example .env
# fill in .env: DATABASE_URL (your Postgres connection string) and JWT_SECRET
```

Apply migrations, then run:

```bash
./.venv/bin/alembic upgrade head
./.venv/bin/uvicorn app.main:app --reload --port 8001
```

On startup the backend opens a WebSocket connection to the T2 service
(`ML_SERVICE_WS_URL`, default `ws://localhost:8000/ws/telemetry`) and starts
ingesting/persisting/rebroadcasting telemetry. If T2 isn't running yet, it
retries with backoff — the rest of the API works fine without it.

More detail (migrations, tests, known gaps): `backend/README.md`.

---

## Running everything together

Three terminals, in any order:

```bash
# terminal 1 — ML / telemetry simulator
./.venv-t2/bin/uvicorn inference_api:app --reload --port 8000

# terminal 2 — backend
cd backend && ./.venv/bin/uvicorn app.main:app --reload --port 8001

# terminal 3 — frontend
npm run dev
```

Then open **http://localhost:3000**.

---

## Design notes (T2 ML pipeline)

- **Why Isolation Forest, not just thresholds:** thresholds catch a single gas
  crossing its statutory limit; Isolation Forest catches *correlated drift*
  across multiple sensors before any single one breaches — e.g. methane
  trending up, temperature trending up, and displacement trending up
  together is a spontaneous-combustion / seam-breach signature even if each
  metric alone still looks "fine."
- **Why a deterministic guardrail on top of the ML models:** for a safety
  system, a false negative from an ML model is unacceptable when a statutory
  limit is already crossed. `calculate_risk_index` hard-clamps to
  `risk_score=100 / CRITICAL` on any threshold breach *before* consulting
  either model.
- **Why the forecast model matters operationally:** a 15-minute lead time is
  roughly enough for field staff to evacuate a sector via the incident
  ticket lifecycle (`TRIGGERED → ASSIGNED → …`) before a WARNING becomes
  CRITICAL.
- **Graceful degradation:** `risk_scoring.py` never crashes if a model file
  is missing — it falls back to rule-based scoring only.

Threshold values in `risk_scoring.THRESHOLDS` are grounded in DGMS
(Directorate General of Mines Safety, India) statutory gas limits, NIOSH
Mining Program publications, and CMPDI/CIL technical reports — cited for
threshold justification only; all telemetry itself is synthetic, generated by
`data_generator.py`.

---

## Learn more (Next.js)

- [Next.js Documentation](https://nextjs.org/docs)
- [Learn Next.js](https://nextjs.org/learn)
