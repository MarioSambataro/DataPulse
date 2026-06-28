# DataPulse — Progressi & Decisioni implementative

> **File di stato.** Da leggere all'INIZIO di ogni sessione e aggiornare alla
> FINE di ogni sezione. Tiene la memoria del progetto tra una sessione e l'altra,
> così non serve ricaricare tutto il contesto (= risparmio token).
>
> Vedi il piano: [`PIANO_SVILUPPO.md`](./PIANO_SVILUPPO.md)

---

## 📍 Stato attuale

- **Sezione in corso:** SEZIONE 9 ✅ fatta → **prossima: SEZIONE 6** (Frontend base + globo 3D)
- **Ultimo aggiornamento:** 2026-06-28
- **Prossimo passo:** ripreso l'ordine del piano dopo l'anticipo dell'API: **6 → 7 → 8 → 10 → 11**. Ora il FE (SEZIONE 6+) ha un'API reale da consumare (`/events`, `/stats`). Commit doc locale `c33f5fe` + commit SEZIONE 9 da pushare (attendere ok). Secret `DATABASE_URL` + DB prod ancora da SEZIONE 10.
- **Deciso:** 2 workflow cron attivi (terremoti `0 * * * *` orario, vulcani `0 6 * * *` giornaliero), entrambi con `workflow_dispatch` + concurrency group; `DATABASE_URL` da `secrets.DATABASE_URL` (secret + DB prod → SEZIONE 10); badge status nel README. CI invariata (lint+test su push/PR).

### Avanzamento sezioni
| # | Sezione | Stato |
|---|---------|-------|
| 1 | Setup repo & scaffold | ✅ fatto |
| 2 | DB & schema eventi unificato | ✅ fatto |
| 3 | ETL terremoti (USGS) | ✅ fatto |
| 4 | ETL vulcani (GVP) | ✅ fatto |
| 5 | Scheduling (Actions cron) | ✅ fatto |
| 6 | Frontend base + globo 3D | ⬜ da fare |
| 7 | Layer visualizzazione | ⬜ da fare |
| 8 | UI command-center | ⬜ da fare |
| 9 | API FastAPI completa | ✅ fatto |
| 10 | Dockerizzazione & Deploy | ⬜ da fare |
| 11 | README & rifinitura | ⬜ da fare |

> Legenda: ⬜ da fare · 🟨 in corso · ✅ fatto · ⛔ bloccato

---

## 🧠 Decisioni implementative

Ogni scelta tecnica non ovvia va registrata qui (con il *perché*), così le
sessioni future non la rimettono in discussione.

| Data | Ambito | Decisione | Perché |
|------|--------|-----------|--------|
| 2026-06-28 | 3D | Libreria base candidata: `react-three-fiber` | Controllo shader per atmosfera/glow/pulse; da confermare in SEZIONE 6 |
| 2026-06-28 | Runtime | Python **3.12+** (testato in locale con 3.14), Node **20** in CI | Allineamento con stack moderno; CI fissa 3.12/20 per riproducibilità |
| 2026-06-28 | Pkg mgr | Python: `pip` + `pyproject.toml` unico (root) con extras `etl`/`api`/`dev`; Web: `npm` | Monorepo: un solo config ruff/pytest; extras installano i layer on-demand |
| 2026-06-28 | DB | Postgres **16** via docker-compose, immagine `postgis/postgis:16-3.4`, volume `postgres_data` | Versione LTS stabile + PostGIS preinstallato |
| 2026-06-28 | Geo | **PostGIS = SÌ.** Colonna `geom geography(Point,4326)` + indice GiST, oltre a `lat`/`lon` grezzi | Scelta dell'utente. Abilita query spaziali (`ST_DWithin`, correlazioni terremoto↔vulcano); `lat`/`lon` restano per il frontend |
| 2026-06-28 | CI | 2 job: `backend` (ruff+pytest reali) e `frontend` (eslint+vitest, `--if-present`) | Scheletro che gira verde su repo quasi-vuoto senza rompersi |
| 2026-06-28 | Deps DB | Extra dedicato `db` nel `pyproject.toml`: `sqlalchemy`, `alembic`, `psycopg[binary]`, `geoalchemy2`, `python-dotenv` | Installazione on-demand del layer DB; `psycopg[binary]` evita build di libpq su Windows. CI ora installa `[etl,api,db,dev]` |
| 2026-06-28 | DB driver | URL `postgresql://` nel `.env`; `env.py` la normalizza a `postgresql+psycopg://` (psycopg v3) | Un solo `.env` valido sia per docker-compose sia per SQLAlchemy/Alembic |
| 2026-06-28 | Geo sync | `geom` mantenuta da **trigger DB** (`BEFORE INSERT/UPDATE OF lat,lon`), non in fase di upsert ETL | `lat`/`lon` unica fonte di verità → `geom` non può divergere; ETL non tocca PostGIS; `ON CONFLICT DO UPDATE` ricalcola `geom` |
| 2026-06-28 | Enum | `source`/`event_type` come **enum nativi Postgres** (`source_enum`, `event_type_enum`) | Valori chiusi e noti; allineati ai `Literal` Pydantic in `api/schemas.py` |
| 2026-06-28 | Alembic | `alembic.ini` in `db/`, `script_location=%(here)s/migrations`; si lancia da root con `-c db/alembic.ini` | Migrazioni isolate sotto `db/`, path indipendenti dal cwd |
| 2026-06-28 | Modelli | ORM `db.models.Event` (con `geom`) vs Pydantic `api.schemas.Event` (`from_attributes`, espone `lat`/`lon`, mai `geom`) | Separazione netta: persistenza geo dentro il DB, contratto API senza geometria interna |
| 2026-06-28 | ETL window | Finestra terremoti default **24h** (`--hours`, parametrizzabile) | Copre la cadenza oraria dello scheduling (SEZIONE 5) con margine per recuperare run saltati |
| 2026-06-28 | Severity | `severity = clamp(magnitude/10, 0, 1)` (lineare); mag negative→0, `mag` null→`severity` null | Mappatura semplice/monotòna per il rendering (size/colore epicentro); coerente col CHECK `severity ∈ [0,1] or null` |
| 2026-06-28 | Idempotenza | Chiave `id = "usgs:" + properties.code`; upsert `INSERT ... ON CONFLICT (id) DO UPDATE` | Rilancio del job non duplica (verificato 213→213); dedup intra-finestra per `id` (USGS rivede gli eventi) |
| 2026-06-28 | ETL/geom | L'upsert scrive solo le colonne dati (no `geom`); il trigger DB ricalcola `geom` da `lat`/`lon` | Rispetta la decisione "single source of truth"; ETL non conosce PostGIS (verificato: 0 `geom` NULL) |
| 2026-06-28 | ETL HTTP | `httpx` con timeout 30s + retry (3 tentativi, backoff esponenziale) solo su 429/5xx; 4xx falliscono subito | Resilienza ai transitori senza martellare su errori non recuperabili |
| 2026-06-28 | Logging | Logging strutturato **JSON-line** (`etl.logging_setup`), campi `extra` inline | Output grepabile/ingeribile; un job CLI scrive eventi tracciabili (`job_start`/`usgs_fetch_ok`/`job_done`) |
| 2026-06-28 | GVP fonte | **Un solo feed**: Weekly Volcanic Activity Report RSS `https://volcano.si.edu/news/WeeklyVolcanoRSS.xml` | Ogni `<item>` contiene già numero vulcano (`<guid>…#vn_<num>`), posizione (`<georss:point>` = "lat lon") e categoria (nel `<title>`): niente WFS/dataset separato per le coordinate |
| 2026-06-28 | GVP encoding | Il client ritorna **bytes** (non `resp.text`); il parser XML rispetta la dichiarazione `ISO-8859-1` del feed | Evita mojibake sugli accenti (es. "Nevado de Longaví", "Geología") |
| 2026-06-28 | GVP severity | `severity` da **categoria di attività** (titolo): eruzione 0.8 / unrest 0.4 / ignoto 0.5, `+0.1` se "New …", clamp [0,1] → New Eruptive 0.9 · Continuing Eruptive 0.8 · New Unrest 0.5 · Continuing Unrest 0.4 | La categoria è l'unico campo sempre presente e uniforme; l'"Alert Level" nel testo è incoerente (scale 0-5 vs scale-colore variabili). Severity vulcani mai null (presenza nel report = attività rilevante) |
| 2026-06-28 | GVP idempotenza | Chiave `id = "gvp:" + volcano_number + ":" + week_iso`; `week_iso` = settimana ISO (`YYYY-Www`) della `pubDate` UTC; upsert `ON CONFLICT (id) DO UPDATE` | Cadenza settimanale → un record per vulcano per settimana, niente flood; rilancio non duplica (verificato 24→24). `pubDate` (RFC822) è deterministica, evita di parsare il range testuale "Report for …" |
| 2026-06-28 | GVP campi | `event_type=volcano`, `source=gvp`, `magnitude`/`depth_km`=**NULL**; `occurred_at`=`pubDate` UTC; `place`=paese; `meta` con num/nome/paese/categoria/settimana/periodo/link/summary (HTML strip) | I vulcani non hanno mag/profondità nello schema unificato; `meta` conserva i campi specifici GVP per ticker/tooltip futuri |
| 2026-06-28 | Cron terremoti | `etl-earthquakes.yml` → `0 * * * *` (orario, UTC) | Cadenza near-real-time USGS; finestra job 24h + idempotenza `usgs:<code>` → un run orario recupera anche run saltati senza duplicare |
| 2026-06-28 | Cron vulcani | `etl-volcanoes.yml` → `0 6 * * *` (**giornaliero**, non settimanale `0 6 * * 5`) | Fonte GVP settimanale (report giovedì ~23:00 UTC), ma idempotenza per settimana (`gvp:<num>:<week_iso>`) rende i run infrasettimanali innocui (riaggiornano gli stessi ~24 record). Giornaliero = **self-healing**: un run fallito si recupera il giorno dopo; settimanale = un venerdì fallito lascia i dati fermi una settimana. Costo trascurabile |
| 2026-06-28 | Trigger workflow | Entrambi i workflow: `schedule` + `workflow_dispatch` (run manuale dalla UI) + `concurrency` group (`etl-earthquakes`/`etl-volcanoes`, `cancel-in-progress: false`) | `workflow_dispatch` per testare a mano; concurrency evita run sovrapposti dello stesso job (l'idempotenza copre comunque eventuali corse) |
| 2026-06-28 | Secret/DB prod | I workflow leggono `DATABASE_URL` da `secrets.DATABASE_URL`; install ridotto `pip install -e ".[etl,db]"` | Secret e DB di produzione (Render/Railway) → **SEZIONE 10**. Finché manca, i run falliscono allo step di connessione DB (atteso): scheduling/checkout/install dimostrano comunque che le Actions girano. Il job da solo non serve `[api,dev]` |
| 2026-06-28 | CI invariata | `ci.yml` lasciato com'è (job `backend` ruff+pytest, `frontend` eslint+vitest, su `push`/`pull_request` su `main`) | Già conforme alla SEZIONE 5 (lint+test su ogni push/PR); nessuna modifica necessaria |
| 2026-06-28 | API engine/session | `api/db.py`: engine **condiviso** (lazy, cache di processo) che riusa `etl.db.get_engine` → `etl.config.database_url` (normalizzazione psycopg v3). `sessionmaker` + dependency FastAPI `get_session` (una `Session` per richiesta) | Un solo punto di verità per driver/URL (no duplicazione); l'API ha bisogno di `Session` ORM (l'ETL no), quindi sessionmaker dedicato sopra l'engine condiviso |
| 2026-06-28 | API risposta | `GET /events` ritorna **envelope** `EventPage {items, total, limit, offset}` (non lista nuda); `total` = match dei filtri ignorando limit/offset | Il FE command-center (SEZIONE 8) ha bisogno del totale per paginazione/contatori senza una seconda chiamata |
| 2026-06-28 | API filtri | `event_type`, `min_magnitude` (esclude record senza mag = vulcani), `start`/`end` (su `occurred_at`), bbox `min/max_lat`+`min/max_lon` (lati indipendenti), `near_lat/near_lon/radius_km`, `order` (asc/desc), `limit` (≤1000, default 100)/`offset`. Ordinamento `occurred_at` (default DESC), `id` come tiebreaker | Tiebreaker `id` → paginazione stabile; bbox a lati indipendenti = più flessibile di un box rigido; validazione coerenza (422): near tutti-e-tre-o-nessuno, `min_lat≤max_lat`, `min_lon≤max_lon` |
| 2026-06-28 | API vicinanza | `ST_DWithin(geom, ST_SetSRID(ST_MakePoint(lon,lat),4326)::geography, radius_km*1000)` su `geography` (metri) → sfrutta l'indice GiST | PostGIS lato query; l'API non espone mai `geom`. Verificato su dati reali: near California 100km→11, 10km→4 eventi |
| 2026-06-28 | /stats semantica | Finestre **rolling** rispetto a `now()` del DB (`generated_at`, UTC) su `occurred_at`: `events_24h`/`events_7d` (qualsiasi tipo), `earthquakes_24h`, `max_magnitude_24h` (max mag terremoti 24h, null se 0), `active_volcanoes_7d` = `count(distinct meta->>'volcano_number')` tra i vulcani negli ultimi 7g | "Vulcani attivi" = numeri GVP distinti con attività recente (GVP è settimanale → finestra 7g). Chiave meta reale = `volcano_number` (non `num`) |
| 2026-06-28 | API CORS | `CORSMiddleware` con `allow_origins` da env `CORS_ALLOW_ORIGINS` (origin separati da virgola), default dev `http://localhost:5173` (Vite). `allow_methods=["GET"]` | Configurabile senza toccare il codice; l'origin **Vercel** di produzione si aggiunge valorizzando la env sul backend in **SEZIONE 10** (non inventato qui) |
| 2026-06-28 | Test API | Postgres+PostGIS **reale** (scelta utente): in CI un `service postgis/postgis:16-3.4` + step `alembic upgrade head`; in locale il docker già attivo. Isolamento per test: connessione+transazione dedicata, `DELETE FROM events` (visibile solo in-transaction) → DB vuoto deterministico, **rollback** a fine test (dati reali locali intatti). `get_session` sovrascritta sulla sessione del test | Esercita davvero `ST_DWithin`/trigger `geom`/enum nativi; il rollback non sporca né dipende dai dati locali. `httpx` (per `TestClient`) già presente nell'extra `[etl]` → nessuna nuova dipendenza |

---

## 📝 Log delle sessioni

Aggiungi una voce in cima a ogni fine-sezione.

### 2026-06-28 — SEZIONE 9: API FastAPI completa ✅
- Cosa è stato fatto: API FastAPI che serve gli eventi unificati con filtri spaziali/
  temporali, paginazione e aggregati; engine/session condivisi (riuso normalizzazione
  URL dell'ETL), CORS configurabile, OpenAPI su `/docs`; test end-to-end su Postgres
  reale + servizio Postgres aggiunto alla CI. Anticipata prima del frontend.
- File creati/modificati:
  - `api/main.py` (app FastAPI, `GET /health` `/events` `/stats`, CORS, validazione 422)
  - `api/db.py` (engine condiviso lazy via `etl.db.get_engine`, `sessionmaker`,
    dependency `get_session`)
  - `api/config.py` (`cors_origins()` da env `CORS_ALLOW_ORIGINS`, default `:5173`)
  - `api/queries.py` (costruzione filtri/ordinamento, `ST_DWithin`, `list_events`,
    `compute_stats`)
  - `api/schemas.py` (+ `EventPage` envelope, + `Stats`)
  - `api/tests/conftest.py` (fixture Postgres reale: transazione+DELETE+rollback,
    override `get_session`, `TestClient`)
  - `api/tests/test_api.py` (16 test: envelope/no-geom, trigger geom, filtri tipo/mag/
    tempo/bbox, near PostGIS, 422 coerenza, ordinamento/paginazione, semantica /stats)
  - `.github/workflows/ci.yml` (job `backend`: + `service` postgis, env `DATABASE_URL`,
    step `alembic upgrade head` prima di pytest)
  - `.env.example` (+ `CORS_ALLOW_ORIGINS`)
  - `docs/PROGRESS.md` (questo aggiornamento)
- Scelte prese: vedi tabella Decisioni (engine/session in `api/db.py` che riusa l'ETL;
  envelope `EventPage`; filtri+validazione; vicinanza `ST_DWithin` su geography;
  semantica /stats rolling 24h/7g + `volcano_number`; CORS da env, Vercel → SEZIONE 10;
  test su Postgres reale + service in CI).
- Verifiche eseguite:
  - `docker compose up -d postgres` + `alembic -c db/alembic.ini upgrade head` OK
  - `python -m ruff check .` → All checks passed
  - `python -m pytest` → **52 passed** (36 preesistenti + 16 nuovi API)
  - `uvicorn api.main:app` su :8000, `/docs` esposto; chiamate reali contro i 237
    eventi (213 terremoti + 24 vulcani):
    - `/stats` → `events_24h=202, events_7d=213, earthquakes_24h=202,
      max_magnitude_24h=5.8, active_volcanoes_7d=0` (vulcani GVP del 2026-06-11,
      fuori finestra 7g → 0 corretto)
    - `/events?limit=2` → envelope `total=237`, item senza `geom`
    - `/events?event_type=earthquake&min_magnitude=4` → total 21
    - `/events?event_type=volcano` → total 24
    - vicinanza reale: near California (35.3,-117.8) r=100km→11, r=10km→4; params
      parziali → HTTP 422
- Problemi aperti / TODO: push del branch in attesa di ok (commit doc `c33f5fe` +
  commit SEZIONE 9). Nota: la finestra `active_volcanoes_7d` resterà 0 finché un run
  ETL vulcani non popola un report con `pubDate` negli ultimi 7 giorni.

### 2026-06-28 — SEZIONE 5: Scheduling (Actions cron) ✅
- Cosa è stato fatto: due workflow GitHub Actions per far girare le pipeline ETL da
  sole a frequenze diverse, in modo idempotente; trigger manuale e concurrency group;
  badge di stato nel README; documentazione del setup secret/DB. CI invariata (già
  conforme: lint+test su push/PR).
- File creati/modificati:
  - `.github/workflows/etl-earthquakes.yml` (cron `0 * * * *` + `workflow_dispatch`,
    concurrency `etl-earthquakes`, install `.[etl,db]`, `DATABASE_URL` da secret)
  - `.github/workflows/etl-volcanoes.yml` (cron `0 6 * * *` giornaliero + `workflow_dispatch`,
    concurrency `etl-volcanoes`, idem install/secret)
  - `README.md` (badge CI + 2 ETL; sezione "Scheduling" con tabella cadenze, come
    lanciare `workflow_dispatch`, come impostare il secret `DATABASE_URL`)
  - `docs/PROGRESS.md` (questo aggiornamento)
- Scelte prese: vedi tabella Decisioni (cron orario terremoti; **giornaliero** vulcani
  invece di settimanale per self-healing; `workflow_dispatch` + concurrency; secret
  `DATABASE_URL`; DB prod rinviato a SEZIONE 10; CI invariata).
- Verifiche eseguite:
  - YAML dei 3 workflow validati con `yaml.safe_load` → tutti OK (actionlint non
    disponibile in locale → revisione manuale di cron/trigger/step)
  - comandi degli step coerenti coi job reali (`python -m etl.jobs.earthquakes`/`volcanoes`)
  - `python -m ruff check .` → All checks passed · `python -m pytest` → 36 passed
- Da fare DOPO il push (con ok utente):
  - `git push` del branch `main` (commit non ancora pushati) → i 2 workflow compaiono
    nella tab **Actions**
  - lancio manuale: Actions → seleziona workflow → **Run workflow** (`workflow_dispatch`)
  - i run falliranno allo step di connessione DB finché `secrets.DATABASE_URL` non è
    impostato (atteso, dimostra che scheduling/permessi funzionano)
  - impostare il secret: **Settings → Secrets and variables → Actions → New repository
    secret**, nome `DATABASE_URL` (DB di produzione → SEZIONE 10)
- Problemi aperti / TODO: push del branch in attesa di ok; DB di produzione + secret
  da configurare in SEZIONE 10.

### 2026-06-28 — SEZIONE 4: ETL vulcani (GVP) ✅
- Cosa è stato fatto: pipeline di ingestion settimanale dei vulcani in attività dal
  Weekly Volcanic Activity Report dello Smithsonian/USGS (RSS → normalizzazione
  Pandas → upsert in `events`), idempotente per settimana, con retry/timeout HTTP,
  logging strutturato e test offline su fixture ISO-8859-1.
- File creati/modificati:
  - `etl/config.py` (+ costante `GVP_WEEKLY_RSS_URL`)
  - `etl/gvp.py` (client httpx, ritorna bytes, retry/backoff su 429/5xx, timeout)
  - `etl/normalize.py` (+ `severity_from_activity`, `normalize_weekly_report`,
    helper `_iso_week`/`_georss_point`/`_strip_html`; riusa `EVENT_COLUMNS`/`to_records`)
  - `etl/jobs/volcanoes.py` (orchestrazione + CLI `--dry-run`)
  - `etl/tests/fixtures/gvp_weekly_sample.xml` (5 item: 3 validi + 1 senza point +
    1 senza numero vulcano, da scartare; codificato ISO-8859-1 con accenti reali)
  - `etl/tests/test_normalize_gvp.py` (13 test: drop, id/settimana, schema, mag/depth
    null, ordine lat/lon, UTC, mapping severity, parsing titolo/place, decoding
    ISO-8859-1 + HTML strip, dedup per settimana)
- Scelte prese: vedi tabella Decisioni (feed RSS unico, encoding bytes, severity da
  categoria, idempotenza `gvp:<num>:<week_iso>`, campi volcano).
- Verifiche eseguite:
  - `python -m etl.jobs.volcanoes` → fetch 24 item, `job_done events=24`
  - rilancio → ancora 24 righe `source='gvp'` (idempotenza OK, 24→24)
  - DB: `geom_null=0` (trigger popola `geom`), `magnitude`/`depth_km` tutti NULL,
    `severity` mai null; `ST_AsText(geom)` coincide con `lat`/`lon`
    (es. Ambae `POINT(167.835 -15.389)`), severity coerente (New Eruptive=0.90)
  - `ruff check .` → All checks passed · `python -m pytest` → 36 passed
- Problemi aperti / TODO: nessuno bloccante.

### 2026-06-28 — SEZIONE 3: ETL terremoti (USGS) ✅
- Cosa è stato fatto: pipeline di ingestion idempotente dei terremoti USGS
  (GeoJSON → normalizzazione Pandas → upsert in `events`), con retry/timeout HTTP,
  logging strutturato e test offline su fixture.
- File creati:
  - `etl/config.py` (URL DB normalizzata psycopg, costanti USGS, finestra default 24h)
  - `etl/logging_setup.py` (formatter JSON-line + `configure_logging`)
  - `etl/usgs.py` (client httpx con retry/backoff su 429/5xx, timeout)
  - `etl/normalize.py` (GeoJSON→DataFrame, `severity_from_magnitude`, `to_records`)
  - `etl/db.py` (`get_engine`, `upsert_events` con `ON CONFLICT (id) DO UPDATE`)
  - `etl/jobs/earthquakes.py` (orchestrazione + CLI `--hours/--min-magnitude/--dry-run`)
  - `etl/tests/fixtures/usgs_sample.geojson` (5 feature, 1 senza `code` da scartare)
  - `etl/tests/test_normalize.py` (11 test: id, coords lon/lat/depth, ms→UTC,
    severity/clamp, meta, dedup, tipi puliti)
- Scelte prese: vedi tabella Decisioni (finestra 24h, severity `clamp(mag/10)`,
  idempotenza `usgs:<code>`, ETL non tocca `geom`, retry httpx, logging JSON).
- Verifiche eseguite:
  - `python -m etl.jobs.earthquakes` → fetch 213 feature 24h, `job_done events=213`
  - rilancio → ancora 213 righe `source='usgs'` (idempotenza OK, 213→213)
  - `SELECT count(*) ... WHERE geom IS NULL` → **0** (trigger popola `geom`);
    `ST_AsText(geom)` coincide con `lat`/`lon`, `severity = mag/10`
  - `ruff check .` → All checks passed · `python -m pytest` → 23 passed
- Problemi aperti / TODO: nessuno bloccante. (Promemoria: usare `python -m pytest`.)

### 2026-06-28 — SEZIONE 2: DB & schema eventi unificato ✅
- Cosa è stato fatto: schema `events` unificato (terremoti + vulcani) con PostGIS,
  prima migrazione Alembic, modello ORM + modello Pydantic condiviso, trigger di
  sincronizzazione `geom`, documentazione del mapping.
- File creati/modificati:
  - `pyproject.toml` (extra `db`, packages/ruff includono `db`, exclude migrazioni)
  - `db/models.py` (SQLAlchemy `Event` + enum `source`/`event_type`)
  - `db/alembic.ini`, `db/migrations/env.py`, `script.py.mako`, `README`
  - `db/migrations/versions/0001_initial_events_schema.py` (PostGIS + tabella + indici + trigger)
  - `api/schemas.py` (Pydantic v2 `Event`, espone `lat`/`lon`, non `geom`)
  - `docs/SCHEMA_EVENTI.md` (mapping schema + scelta trigger documentata)
  - `db/README.md` (aggiornato), `.github/workflows/ci.yml` (install `[etl,api,db,dev]`)
  - test: `db/tests/test_schema.py`, `api/tests/test_schemas.py`
- Scelte prese: vedi tabella Decisioni (extra `db`, driver psycopg, trigger geom,
  enum nativi, layout Alembic, separazione ORM/Pydantic).
- Verifiche eseguite:
  - `cp .env.example .env` + `docker compose up -d postgres` → container healthy
  - `pip install -e ".[etl,api,db,dev]"` → OK
  - `alembic -c db/alembic.ini upgrade head` → `Running upgrade -> 0001` (no errori)
  - `\d events` → PostGIS 3.4 attivo, colonna `geom geography(Point,4326)`, indici
    `ix_events_occurred_at` (btree DESC), `ix_events_event_type` (btree),
    `ix_events_geom` (**gist**), trigger `trg_events_sync_geom` presente
  - Test trigger: insert con solo `lat`/`lon` → `geom = POINT(15.65 38.1)` SRID 4326;
    update di `lat`/`lon` → `geom` ricalcolata a `POINT(0 0)`
  - `ruff check .` → All checks passed · `python -m pytest` → 12 passed
- Problemi aperti / TODO: nessuno bloccante. Nota: il `pytest` "nudo" sul PATH punta
  a un Python 3.11 senza le deps → usare **`python -m pytest`** (3.14).

### 2026-06-28 — SEZIONE 1: Setup repo & scaffold ✅
- Cosa è stato fatto: creata struttura monorepo, docker-compose Postgres,
  CI scheletro, config Python/Web; lint+test verdi in locale.
- File creati:
  - `pyproject.toml` (root: deps extras + config ruff/pytest)
  - `docker-compose.yml` (servizio `postgres` + placeholder `api`/`web`)
  - `.env.example` (`DATABASE_URL`, `VITE_API_URL`, credenziali Postgres)
  - `.github/workflows/ci.yml` (job backend + frontend)
  - `etl/` (`__init__`, `jobs/`, `tests/test_smoke.py`)
  - `api/` (`__init__`, `tests/test_smoke.py`)
  - `db/README.md` (placeholder per SEZIONE 2)
  - `web/` (package.json, eslint.config.js, tsconfig.json, `src/`, smoke test)
- Scelte prese: vedi tabella Decisioni (runtime, pkg manager, Postgres 16, CI).
- Verifiche eseguite:
  - `ruff check .` → All checks passed
  - `pytest` → 2 passed
  - `cd web && npm install && npm run lint && npm run test` → eslint pulito, 1 test passed
  - `docker compose config` → OK
- Problemi aperti / TODO: nessuno bloccante. Restano i TODO trasversali (remote
  GitHub, provider deploy, libreria 3D definitiva).

### 2026-06-28 — Kickoff
- Creato piano sezionato (`PIANO_SVILUPPO.md`) + questo file.
- Inizializzato repo git locale.
- TODO: collegare remote GitHub (vedi README/istruzioni).

<!--
TEMPLATE voce di log:

### YYYY-MM-DD — SEZIONE N: titolo
- Cosa è stato fatto:
- File creati/modificati:
- Scelte prese (spostare anche in tabella Decisioni):
- Problemi aperti / TODO:
- Comando di verifica usato:
-->

---

## ⚠️ Problemi aperti / TODO trasversali
- [ ] **Push del branch `main`**: remote `origin` collegato
      (`https://github.com/MarioSambataro/DataPulse.git`) ma commit locali non ancora
      pushati → i workflow non compaiono su GitHub finché non si fa `git push`.
- [ ] Scegliere provider deploy backend / DB di produzione (Render vs Railway) →
      poi impostare il secret `DATABASE_URL` su GitHub (SEZIONE 10).
- [ ] **CORS prod**: aggiungere l'origin Vercel valorizzando `CORS_ALLOW_ORIGINS`
      sul backend in SEZIONE 10 (env, non hard-coded).
- [ ] Confermare libreria 3D definitiva (SEZIONE 6).
- [ ] Il FE (SEZIONE 6+) consuma `GET /events` (envelope `EventPage`) e `GET /stats`;
      `VITE_API_URL` → backend (default dev `http://localhost:8000`).
