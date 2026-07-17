# DataPulse — Development plan

This document records the product plan that shaped DataPulse. The original
milestone-based implementation is complete; current work is tracked under
**Next improvements**.

## Product goal

Build a portfolio-ready geotectonic command center with a spatial 3D frontend,
live earthquake and volcano data, temporal analysis, and a production-shaped
data pipeline.

## Completed milestones

| Milestone | Deliverable | Status |
|---|---|:---:|
| Repository foundation | Monorepo, Docker Compose, Python and web tooling, CI | Complete |
| Unified data model | PostgreSQL/PostGIS schema, Alembic migrations, geo indexes | Complete |
| Earthquake ingestion | Idempotent USGS GeoJSON normalization and upserts | Complete |
| Volcano ingestion | Idempotent Smithsonian GVP RSS normalization and upserts | Complete |
| Scheduling | Independent GitHub Actions schedules with manual dispatch | Complete |
| Backend API | Filterable REST endpoints, statistics, SSE, observability | Complete |
| 3D frontend | React/Three.js globe, animated layers, interactions, HUD | Complete |
| Time and AI features | Replay, live merging, optional natural-language tools | Complete |
| Deployment | Neon, Render, Vercel, and scheduled production ETL | Complete |
| Portfolio polish | English technical documentation and public live links | Complete |

## Key engineering requirements

- Normalize heterogeneous sources into the single schema documented in
  [EVENT_SCHEMA.md](EVENT_SCHEMA.md).
- Keep ingestion idempotent so retries and overlapping source windows are safe.
- Use PostGIS for proximity queries and keep public API coordinates simple.
- Render hundreds of events efficiently with instanced WebGL meshes.
- Keep the UI functional when optional AI features are not configured.
- Surface database health, data freshness, latency, and streaming state.
- Verify backend code against PostgreSQL/PostGIS rather than an incompatible mock.

## Definition of done

- Scheduled earthquake and volcano pipelines run successfully.
- The public dashboard renders real API data.
- API documentation is available and fully written in English.
- CI covers linting, unit tests, PostGIS integration tests, builds, and E2E tests.
- Deployment, schema, and architecture decisions are documented.
- No credentials or provider secrets are committed.

## Next improvements

- Reduce the initial Three.js bundle with route- or feature-level code splitting.
- Add contract tests against the deployed OpenAPI schema.
- Persist rate-limit state if the API moves beyond a single-process demo.
- Add historical partitions if the event table grows beyond portfolio scale.
- Add synthetic monitoring for Render cold starts and ETL freshness.
