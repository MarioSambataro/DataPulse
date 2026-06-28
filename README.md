# DataPulse

[![CI](https://github.com/MarioSambataro/DataPulse/actions/workflows/ci.yml/badge.svg)](https://github.com/MarioSambataro/DataPulse/actions/workflows/ci.yml)
[![ETL Earthquakes (USGS)](https://github.com/MarioSambataro/DataPulse/actions/workflows/etl-earthquakes.yml/badge.svg)](https://github.com/MarioSambataro/DataPulse/actions/workflows/etl-earthquakes.yml)
[![ETL Volcanoes (GVP)](https://github.com/MarioSambataro/DataPulse/actions/workflows/etl-volcanoes.yml/badge.svg)](https://github.com/MarioSambataro/DataPulse/actions/workflows/etl-volcanoes.yml)

> Console di monitoraggio geo-tettonico (sismico + vulcanico) con frontend
> spaziale 3D stile *command-center*: globo terrestre interattivo, epicentri
> pulsanti per magnitudo, marker vulcani, ticker eventi live.

ETL multi-sorgente (USGS + Smithsonian GVP) → schema eventi unificato → Postgres
→ API FastAPI → dashboard React/Three.js.

📄 **Piano di sviluppo:** [`docs/PIANO_SVILUPPO.md`](docs/PIANO_SVILUPPO.md)
📊 **Stato & decisioni:** [`docs/PROGRESS.md`](docs/PROGRESS.md)

🚧 In sviluppo — vedi il piano per le sezioni.

## Scheduling (GitHub Actions)

Le due pipeline ETL girano da sole, a frequenze diverse, in modo idempotente:

| Workflow | Cadenza | Cron (UTC) | Job |
|----------|---------|-----------|-----|
| `etl-earthquakes.yml` | oraria | `0 * * * *` | `python -m etl.jobs.earthquakes` |
| `etl-volcanoes.yml` | giornaliera | `0 6 * * *` | `python -m etl.jobs.volcanoes` |

Entrambi i workflow espongono anche un trigger **manuale** (`workflow_dispatch`):
tab **Actions** → seleziona il workflow → **Run workflow**.

### Secret richiesto: `DATABASE_URL`

I job leggono `DATABASE_URL` dal secret del repository. Finché non è impostato (o se
punta a un DB non raggiungibile da internet), i run **falliranno sullo step di
connessione al DB** — lo scheduling e i permessi funzionano comunque (lo step di
checkout/install passa). Il DB di produzione e il secret arrivano nella **SEZIONE 10**.

Per impostarlo: **Settings → Secrets and variables → Actions → New repository secret**,
nome `DATABASE_URL`, valore in formato `postgresql://user:pass@host:5432/dbname`
(i job normalizzano da soli il driver a psycopg v3).

