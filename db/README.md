# `db/`

Unified event schema and Alembic migrations for PostgreSQL with PostGIS.

## Contents

- `models.py` — SQLAlchemy `Event` model, including `geom`.
- `alembic.ini` — Alembic configuration; the URL comes from `DATABASE_URL` or `.env`.
- `migrations/` — Alembic environment and revisions; `0001` creates PostGIS and `events`.

## Usage from the repository root

```bash
docker compose up -d postgres
cp .env.example .env                       # PowerShell: Copy-Item .env.example .env
pip install -e ".[db]"
alembic -c db/alembic.ini upgrade head
```

The GiST-indexed `geom geography(Point,4326)` column is derived from `lat` and
`lon` by a database trigger. ETL jobs write only the canonical coordinates.

See [`../docs/EVENT_SCHEMA.md`](../docs/EVENT_SCHEMA.md) for the complete mapping.
