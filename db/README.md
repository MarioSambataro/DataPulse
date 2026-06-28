# db/

Migrazioni Alembic + SQL dello schema eventi unificato.

DB: **Postgres + PostGIS** (immagine `postgis/postgis:16-3.4`, vedi
`../docker-compose.yml`).

Popolata nella **SEZIONE 2 — DB & schema eventi unificato**:
- `alembic.ini` + cartella `migrations/`
- prima migrazione: `CREATE EXTENSION IF NOT EXISTS postgis;` + tabella `events`
- colonna `geom geography(Point,4326)` con indice GiST (oltre a `lat`/`lon` grezzi)

Vedi [`../docs/PIANO_SVILUPPO.md`](../docs/PIANO_SVILUPPO.md) → SEZIONE 2.
