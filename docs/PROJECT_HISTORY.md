# DataPulse — Project history and engineering decisions

DataPulse was implemented as a sequence of independently verifiable milestones
between June and July 2026. This summary retains the decisions that are useful
for maintainers and technical reviewers without the obsolete session instructions
from the original development log.

## Current state

- Frontend: deployed on Vercel at <https://data-pulse-tau.vercel.app>.
- Backend: deployed on Render at <https://datapulse-api-09py.onrender.com>.
- Database: Neon PostgreSQL with PostGIS.
- Ingestion: hourly USGS and daily self-healing GVP GitHub Actions workflows.
- Application interface: English and Italian.
- Technical documentation and API descriptions: English.

## Major decisions

| Area | Decision | Rationale |
|---|---|---|
| Data model | One `events` table for earthquakes and volcanoes | Enables one API and one visualization pipeline across heterogeneous sources |
| Spatial data | `geography(Point,4326)` with a GiST index | Supports distance queries in metres and efficient spatial filtering |
| Geometry | Database trigger derives `geom` from `lat`/`lon` | Prevents divergence and keeps ETL independent of geometry serialization |
| Idempotency | Deterministic source keys with PostgreSQL upserts | Makes scheduled retries and overlapping time windows safe |
| Earthquake window | Fetch the latest 24 hours every hour | Recovers missed runs while deterministic IDs prevent duplicates |
| Volcano schedule | Run daily against a weekly source | A failed run self-heals the next day at negligible cost |
| API pagination | Return `EventPage {items,total,limit,offset}` | Gives the dashboard totals without a second request |
| Live transport | SSE plus periodic polling | Provides push updates while retaining a robust fallback |
| 3D rendering | react-three-fiber with instanced earthquake meshes | Provides shader control and stable performance for hundreds of events |
| Testing | Use a real PostGIS service in backend integration tests | Exercises spatial functions, native enums, and triggers accurately |
| Deployment | Neon + Render + Vercel | Offers a persistent free-tier portfolio deployment with clear boundaries |

## Delivery timeline

### Data foundation

The repository scaffold, PostgreSQL/PostGIS schema, Alembic migration, ORM model,
and public Pydantic contract were established first. Coordinate constraints,
temporal indexes, a GiST spatial index, and the synchronization trigger were
verified against a real database.

### Ingestion

The USGS pipeline converts GeoJSON to the unified schema, normalizes magnitude
severity, and upserts by earthquake code. The GVP pipeline parses the weekly RSS
feed as source bytes to respect its declared encoding, extracts volcano metadata,
assigns activity severity, and upserts one record per volcano and ISO week.

Both jobs use bounded HTTP retries, structured JSON logging, dry-run modes, and
offline fixtures. Scheduled workflows read the production connection string from
GitHub Actions secrets.

### API and observability

FastAPI exposes event pagination, temporal and bounding-box filters, PostGIS
proximity search, rolling statistics, readiness, health, Prometheus metrics, and
an SSE stream. Optional AI endpoints never receive direct database access; the
application validates generated filters before executing normal queries.

### Frontend

The React frontend renders day/night Earth textures, an atmospheric shader,
tectonic plate overlays, instanced seismic effects, volcano markers, cinematic
selection, filters, live ticker, rolling statistics, system status, time replay,
and English/Italian localization. `?mock=1` supports deterministic demos and E2E
tests without cloud infrastructure.

### Production readiness

The API image runs migrations at startup, exposes a health check, and reads CORS
origins from the environment. Vercel builds the static frontend, Render hosts the
Docker API, Neon stores geospatial data, and GitHub Actions populate the shared
database. The public README links to the live application, status endpoint, and
Swagger UI.

## Verified quality baseline

- Ruff and Pytest for Python code and PostGIS integration.
- ESLint, Vitest, TypeScript compilation, and Vite production build.
- Playwright end-to-end tests against deterministic mock data.
- Docker image build and API health verification.

See [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) for the completed milestone plan and
[EVENT_SCHEMA.md](EVENT_SCHEMA.md) for the database contract.
