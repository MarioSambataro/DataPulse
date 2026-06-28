# db/

Schema eventi unificato + migrazioni Alembic.

DB: **Postgres + PostGIS** (immagine `postgis/postgis:16-3.4`, vedi
`../docker-compose.yml`).

## Contenuto
- `models.py` — modello SQLAlchemy `Event` (tabella `events`, include `geom`).
- `alembic.ini` — config Alembic (URL letta da `DATABASE_URL`/`.env`).
- `migrations/` — env Alembic + revisioni; `0001` crea PostGIS + `events`.

## Uso (dalla root del repo)
```bash
docker compose up -d postgres
cp .env.example .env                       # PowerShell: Copy-Item .env.example .env
pip install -e ".[db]"
alembic -c db/alembic.ini upgrade head
```

La colonna `geom geography(Point,4326)` (indice GiST) è **derivata** da
`lat`/`lon` tramite trigger di DB — l'ETL scrive solo `lat`/`lon`.

Dettagli e mapping: [`../docs/SCHEMA_EVENTI.md`](../docs/SCHEMA_EVENTI.md).
