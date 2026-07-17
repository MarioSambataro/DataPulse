# DataPulse

[![CI](https://github.com/MarioSambataro/DataPulse/actions/workflows/ci.yml/badge.svg)](https://github.com/MarioSambataro/DataPulse/actions/workflows/ci.yml)
[![ETL Earthquakes](https://github.com/MarioSambataro/DataPulse/actions/workflows/etl-earthquakes.yml/badge.svg)](https://github.com/MarioSambataro/DataPulse/actions/workflows/etl-earthquakes.yml)
[![ETL Volcanoes](https://github.com/MarioSambataro/DataPulse/actions/workflows/etl-volcanoes.yml/badge.svg)](https://github.com/MarioSambataro/DataPulse/actions/workflows/etl-volcanoes.yml)

[Live demo](https://data-pulse-tau.vercel.app) ·
[API status](https://datapulse-api-09py.onrender.com/status) ·
[API documentation](https://datapulse-api-09py.onrender.com/docs)

DataPulse is a web-based geotectonic monitoring console that combines USGS
earthquakes and Smithsonian GVP volcanic activity on an interactive 3D globe.
It includes live updates, geospatial filters, temporal replay, and end-to-end
pipeline observability.

![DataPulse night view](web/datapulse-marker-night.png)

## What this project demonstrates

- Scheduled, idempotent ETL pipelines for heterogeneous data sources.
- A unified data model for seismic and volcanic events.
- PostGIS geospatial queries through FastAPI and SQLAlchemy.
- Server-Sent Events with polling fallback.
- WebGL rendering with Three.js and instanced markers.
- Temporal replay, event deep links, and day/night globe modes.
- Optional natural-language queries and AI-generated briefings.
- Health, readiness, Prometheus metrics, HTTP caching, and rate limiting.
- Unit, PostGIS integration, and Playwright end-to-end tests.

## Architecture

```text
USGS Earthquake API ─┐
                     ├─► GitHub Actions ETL ─► Neon PostgreSQL + PostGIS
Smithsonian GVP RSS ─┘                              │
                                                   ▼
                                            FastAPI on Render
                                      REST · SSE · Prometheus · AI
                                                   │
                                                   ▼
                                      React + Three.js on Vercel
```

The production frontend does not use hard-coded data. Events, statistics,
system status, and the SSE feed come from the backend. Add `?mock=1` only for
infrastructure-independent screenshots and end-to-end tests.

## Key features

- **3D globe:** day/night textures, atmosphere, tectonic plates, and animated camera.
- **Live events:** earthquakes and volcanoes with severity, hover, selection, and ticker.
- **Analysis:** event type, magnitude, and time-window filters; rolling 24-hour/7-day statistics.
- **Time travel:** configurable event replay with an interactive playhead.
- **Reliability:** cold-start retries, ETags, rate limiting, and ingestion health reporting.
- **Accessibility:** reduced-motion support, ARIA controls, and non-focusable decorative duplicates.
- **Internationalization:** English and Italian interface locales.

## Technology stack

| Layer | Technologies |
|---|---|
| Frontend | React, TypeScript, Vite, Three.js, react-three-fiber, Zustand |
| Backend | FastAPI, Pydantic, SQLAlchemy, SSE, Prometheus |
| Data | PostgreSQL, PostGIS, Alembic, pandas |
| Ingestion | USGS GeoJSON, Smithsonian GVP RSS, GitHub Actions |
| Quality | Ruff, Pytest, Vitest, ESLint, Playwright |
| Deployment | Neon, Render Docker, Vercel |

## Local development

Prerequisites: Docker, Node.js 20+, and Python 3.12+.

```bash
cp .env.example .env
docker compose up -d postgres api

cd web
npm install
npm run dev
```

- Dashboard: `http://localhost:5173`
- API: `http://localhost:8000`
- Swagger UI: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

## Quality checks

```bash
# Frontend
cd web
npm run lint
npm run test
npm run build
npm run e2e

# Backend, with Python 3.12 and PostGIS available
ruff check .
pytest
```

CI runs backend checks against a real PostGIS service and uploads the Playwright
report as an artifact when end-to-end tests fail.

## Deployment

The free-tier deployment uses Neon for persistent data, Render for the Dockerized
API, Vercel for the frontend, and GitHub Actions for scheduled ingestion.

See [docs/DEPLOY.md](docs/DEPLOY.md) for secrets, migrations, CORS, initial data
loading, and end-to-end verification.

## Data sources and assets

- [USGS Earthquake Catalog API](https://earthquake.usgs.gov/fdsnws/event/1/)
- [Smithsonian Global Volcanism Program](https://volcano.si.edu/)
- NASA public-domain Earth textures; attribution is documented in
  [web/public/textures/README.md](web/public/textures/README.md)

This visualization is informational and does not replace official civil
protection or scientific-agency bulletins.
