# DataPulse — Unified event schema

The `events` model represents both USGS earthquakes and Smithsonian GVP volcanic
activity. Two sources with different formats and schedules are normalized into
one queryable contract.

Database stack: PostgreSQL 16 with PostGIS, managed through Alembic migrations in
[`../db/migrations/`](../db/migrations/).

## `events` table

| Field | SQL type | Nullable | Purpose |
|---|---|:---:|---|
| `id` | `text` primary key | no | Deterministic ETL key, such as `usgs:<code>` or `gvp:<number>:<week>` |
| `source` | `source_enum` | no | `usgs` or `gvp` |
| `event_type` | `event_type_enum` | no | `earthquake` or `volcano` |
| `occurred_at` | `timestamptz` | no | Event time in UTC; indexed descending |
| `lat` | `double precision` | no | Latitude in `[-90, 90]` |
| `lon` | `double precision` | no | Longitude in `[-180, 180]` |
| `geom` | `geography(Point,4326)` | no | PostGIS point derived from `lat` and `lon`; GiST indexed |
| `depth_km` | `double precision` | yes | Earthquake depth |
| `magnitude` | `double precision` | yes | Earthquake magnitude; `null` for volcanoes |
| `severity` | `double precision` | yes | Normalized rendering metric in `[0, 1]` |
| `title` | `text` | no | Human-readable label |
| `place` | `text` | yes | Region or location |
| `meta` | `jsonb` | no | Source-specific fields; defaults to `{}` |
| `ingested_at` | `timestamptz` | no | Database write time; defaults to `now()` |

Constraints enforce valid coordinates and a nullable severity in `[0, 1]`.

## Indexes

| Name | Column | Type | Use |
|---|---|---|---|
| `ix_events_occurred_at` | `occurred_at DESC` | btree | Latest-event feeds and time filters |
| `ix_events_event_type` | `event_type` | btree | Earthquake/volcano filtering |
| `ix_events_geom` | `geom` | GiST | `ST_DWithin`, bounding boxes, and spatial correlation |

## Geometry synchronization

The application never writes `geom` directly. A `BEFORE INSERT OR UPDATE OF
lat, lon` database trigger derives it from the canonical coordinates:

```sql
NEW.geom := ST_SetSRID(ST_MakePoint(NEW.lon, NEW.lat), 4326)::geography;
```

This design keeps `lat` and `lon` as the single source of truth, simplifies ETL
upserts, and prevents geometry drift regardless of the write path. PostGIS uses
`X=longitude` and `Y=latitude`, so coordinate order matters.

## Application mapping

| Layer | Artifact | Location |
|---|---|---|
| Database/ORM | SQLAlchemy `Event`, including `geom` | [`../db/models.py`](../db/models.py) |
| Public API | Pydantic `Event`, exposing coordinates but not `geom` | [`../api/schemas.py`](../api/schemas.py) |

The API model uses `from_attributes=True`, allowing
`Event.model_validate(orm_object)`. The internal PostGIS geometry is never
serialized. Source and event-type values are aligned between the ORM enums and
Pydantic literals.

## Setup commands

```bash
docker compose up -d postgres
cp .env.example .env            # PowerShell: Copy-Item .env.example .env
pip install -e ".[db]"
alembic -c db/alembic.ini upgrade head
```

The initial migration enables PostGIS, creates the enums and table, builds the
indexes, and installs the geometry synchronization trigger.
