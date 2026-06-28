# DataPulse — Piano di Sviluppo

> **Console di monitoraggio geo-tettonico** (sismico + vulcanico) con frontend
> **spaziale 3D**: globo terrestre interattivo stile *command-center*, epicentri
> pulsanti per magnitudo, marker vulcani in attività, ticker eventi live.
>
> Estetica: scura / tattica / spy, coerente col portfolio di Mario Sambataro.

---

## 0. Come usare questo piano (leggere SEMPRE per primo)

Questo piano è diviso in **sezioni autonome** (`SEZIONE 1 … N`). Regola d'oro per
**non bruciare token**:

1. **Una sessione = una sezione.** Non caricare l'intero piano né l'intero
   codebase. Apri solo: questo file (indice + la sezione corrente) e
   [`PROGRESS.md`](./PROGRESS.md).
2. **All'inizio di ogni sessione** leggi `PROGRESS.md` per sapere a che punto
   siamo e quali scelte sono già state prese.
3. **Alla fine di ogni sezione**:
   - aggiorna `PROGRESS.md` (stato sezione → ✅, scelte implementative, note);
   - fai un commit atomico con messaggio chiaro (`feat(etl): ingest USGS …`);
   - **fermati** e aspetta conferma prima di passare alla sezione successiva.
4. Se una scelta è ambigua, **chiedi** prima di scrivere codice; registra la
   risposta in `PROGRESS.md` (sezione "Decisioni").

### Workflow per ogni sezione
```
leggi PROGRESS.md  ->  implementa SOLO la sezione X  ->  test/lint locale
   ->  aggiorna PROGRESS.md  ->  git commit  ->  STOP (attendi ok)
```

---

## Stack tecnico (vincolante)

| Layer        | Tecnologia |
|--------------|-----------|
| ETL          | Python · Pandas · NumPy · `httpx`/`requests` |
| DB           | Postgres + **PostGIS** (geo) · migrazioni (Alembic) |
| API          | FastAPI · Pydantic v2 |
| Frontend     | React + TypeScript + Vite |
| **3D**       | **react-three-fiber + three.js** (globo) + `@react-three/drei` |
| Scheduling   | GitHub Actions cron (2 frequenze diverse) |
| Container    | Docker + docker-compose |
| CI           | GitHub Actions (lint `ruff`/`eslint` + test `pytest`/`vitest`) |
| Deploy       | Frontend → Vercel · Backend+DB → Render (o Railway) |

> **Nota 3D:** la libreria base scelta è `react-three-fiber` per pieno controllo
> dello shader del globo (atmosfera, glow, epicentri pulsanti). Alternativa più
> rapida ma meno personalizzabile: `globe.gl`. La scelta finale va confermata e
> registrata in `PROGRESS.md` → **SEZIONE 6**.

---

## Indice delle sezioni

| # | Sezione | Output principale | Stima |
|---|---------|-------------------|-------|
| 1 | Setup repo & scaffold | Struttura cartelle, docker-compose, CI vuota, `PROGRESS.md` | 0.5g |
| 2 | DB & schema eventi unificato | Migrazioni Postgres, modello, indici tempo/geo | 0.5g |
| 3 | ETL terremoti (USGS) | Job ingestion idempotente + normalizzazione Pandas | 1g |
| 4 | ETL vulcani (Smithsonian GVP) | Job ingestion settimanale → stesso schema | 1g |
| 5 | Scheduling (Actions cron) | 2 workflow cron a frequenze diverse + CI | 0.5g |
| 6 | Frontend base + globo 3D | React+R3F, globo terrestre dark, controlli camera | 1g |
| 7 | Layer di visualizzazione | Epicentri pulsanti per magnitudo + marker vulcani | 1g |
| 8 | UI command-center | Ticker live, pannello stat 24h, filtri, HUD | 1g |
| 9 | API FastAPI completa | Endpoint filtrabili + aggregati, paginazione, CORS | 0.5g |
| 10 | Dockerizzazione & Deploy | Dockerfile, deploy live, env | 0.5g |
| 11 | README & rifinitura | Diagramma ETL, badge, GIF/screenshot | 0.5g |

> L'ordine consigliato è 1→2→3→4→5, poi 9 (API) prima del frontend così il FE ha
> dati veri da consumare; poi 6→7→8, infine 10→11. Adatta se serve, ma annota la
> scelta in `PROGRESS.md`.

---

## SEZIONE 1 — Setup repo & scaffold

**Obiettivo:** struttura del monorepo pronta, niente logica ancora.

**Task**
- Struttura cartelle:
  ```
  DataPulse/
  ├─ etl/            # job ingestion + normalizzazione (Python)
  ├─ api/            # FastAPI
  ├─ web/            # React + TS + Vite (frontend 3D)
  ├─ db/             # migrazioni Alembic + sql
  ├─ docs/           # questo piano + PROGRESS.md + diagrammi
  ├─ .github/workflows/
  ├─ docker-compose.yml
  ├─ .env.example
  └─ README.md
  ```
- `docker-compose.yml` con servizio `postgres` (volume) + placeholder `api`/`web`.
- `.env.example` con `DATABASE_URL`, `VITE_API_URL`.
- CI scheletro `.github/workflows/ci.yml` (lint+test che girano ma non rompono su repo vuoto).
- `pyproject.toml` (ruff + pytest) per `etl/` e `api/`; `package.json` per `web/`.

**Output atteso:** `docker compose up postgres` parte; `ruff check` e `eslint` girano a vuoto senza errori.

**Checkpoint → aggiorna `PROGRESS.md`:** struttura, versioni runtime (Python/Node), gestore pacchetti scelto.

---

## SEZIONE 2 — DB & schema eventi unificato

**Obiettivo:** un solo modello `events` che rappresenta sia terremoti sia vulcani.

**Schema unificato proposto** (`events`):

| Campo | Tipo | Note |
|-------|------|------|
| `id` | text PK | `source_id` deterministico (vedi idempotenza) |
| `source` | enum (`usgs`, `gvp`) | sorgente |
| `event_type` | enum (`earthquake`, `volcano`) | |
| `occurred_at` | timestamptz | UTC, indicizzato |
| `lat`, `lon` | double | coordinate "grezze" (comode per il frontend) |
| `geom` | `geography(Point,4326)` | **PostGIS** — punto geografico, indice GiST |
| `depth_km` | double null | solo terremoti |
| `magnitude` | double null | terremoti (mag); vulcani null |
| `severity` | double null | metrica normalizzata 0–1 per il rendering |
| `title` | text | label leggibile |
| `place` | text null | regione |
| `meta` | jsonb | campi specifici non normalizzati |
| `ingested_at` | timestamptz default now() | |

> **Geo: PostGIS (scelto).** Il DB usa l'estensione **PostGIS**. Oltre a `lat`/`lon`
> grezzi (usati dal frontend), la tabella ha una colonna `geom geography(Point,4326)`
> con indice spaziale **GiST**, così sono possibili query come "eventi entro N km da
> un punto" (`ST_DWithin`) e correlazioni spaziali terremoto↔vulcano. L'immagine
> Docker è `postgis/postgis:16-3.4`.

**Task**
- Alembic init + prima migrazione con tabella `events`.
- Migrazione iniziale: `CREATE EXTENSION IF NOT EXISTS postgis;` (prima della tabella).
- Colonna `geom geography(Point,4326)`; popolata da `lat`/`lon`
  (`ST_MakePoint(lon, lat)::geography`), idealmente mantenuta coerente (trigger o
  in fase di upsert ETL).
- Indici: `occurred_at DESC` (btree), `geom` (**GiST**), `event_type` (btree).
- Modello Pydantic `Event` condiviso (in `api/`), importabile. La risposta API
  espone `lat`/`lon` (non la geometria interna).

**Output atteso:** `alembic upgrade head` abilita PostGIS e crea lo schema;
documentazione del mapping in `docs/`.

**Checkpoint → `PROGRESS.md`:** schema finale, conferma PostGIS + colonna `geom`/GiST,
strategia indici, come si mantiene `geom` sincronizzata con `lat`/`lon`.

---

## SEZIONE 3 — ETL terremoti (USGS)

**Fonte:** USGS Earthquake API (GeoJSON, near-real-time, no API key)
`https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=...`

**Obiettivo:** ingestion idempotente dei terremoti recenti → `events`.

**Task**
- Client che scarica finestra temporale (es. ultime 24–48h, parametrizzabile).
- Normalizzazione Pandas: estrai `mag`, `place`, `time` (ms→UTC), coords, `depth`.
- Mappatura allo schema unificato; `severity = clamp(mag/10)` o scala log.
- **Idempotenza:** `id = "usgs:" + properties.code` (upsert `ON CONFLICT DO UPDATE`).
- Gestione errori/retry/timeout; logging strutturato.
- Test: parsing su un fixture GeoJSON salvato in `etl/tests/fixtures/`.

**Output atteso:** `python -m etl.jobs.earthquakes` popola `events`; rilanciarlo non duplica.

**Checkpoint → `PROGRESS.md`:** finestra temporale default, formula `severity`, chiave idempotenza.

---

## SEZIONE 4 — ETL vulcani (Smithsonian GVP)

**Fonte:** Global Volcanism Program — Weekly Volcanic Activity Report + posizioni
vulcani (feed/WFS). Cadenza **settimanale**, formato diverso dai terremoti.

**Obiettivo:** ingestion settimanale dei vulcani in attività → stesso schema `events`.

**Task**
- Recupero report settimanale + posizioni (lat/lon) per nome vulcano.
- Normalizzazione Pandas → schema unificato (`event_type=volcano`, `magnitude=null`,
  `severity` da livello di allerta o presenza nel weekly report).
- **Idempotenza:** `id = "gvp:" + volcano_number + ":" + week_iso` (upsert).
- Gestire il fatto che la cadenza è settimanale → niente flood, dedup per settimana.
- Test su fixture salvato.

**Output atteso:** `python -m etl.jobs.volcanoes` popola i vulcani; rilancio idempotente.

**Checkpoint → `PROGRESS.md`:** endpoint/feed esatti usati, mapping allerta→severity, chiave idempotenza.

> ⚠️ **Punto forte da raccontare nel README:** due sorgenti, cadenze diverse
> (minuti vs settimana), formati diversi → **un solo schema**. È il cuore "data
> engineer" del progetto.

---

## SEZIONE 5 — Scheduling (GitHub Actions cron)

**Obiettivo:** le due pipeline girano da sole, a frequenze diverse, idempotenti.

**Task**
- `.github/workflows/etl-earthquakes.yml` → cron orario (`0 * * * *`).
- `.github/workflows/etl-volcanoes.yml` → cron giornaliero (`0 6 * * *`).
- Entrambi: checkout → setup Python → install → run job → `DATABASE_URL` da secret.
- Badge "last run" nel README per ciascuno.
- CI `ci.yml`: lint (`ruff`, `eslint`) + test (`pytest`, `vitest`) su ogni push/PR.

**Output atteso:** workflow visibili e verdi; i job scrivono sul DB di produzione.

**Checkpoint → `PROGRESS.md`:** cron scelti, nomi secret, dove punta `DATABASE_URL`.

---

## SEZIONE 6 — Frontend base + globo 3D

**Obiettivo:** app React+TS con un **globo terrestre 3D** dark, navigabile.

**Task**
- Scaffold Vite + React + TS in `web/`.
- Setup `react-three-fiber` + `@react-three/drei` (`OrbitControls`, `Stars`).
- Globo: sfera con texture Terra dark (o shader procedurale notturno), atmosfera
  con glow (fresnel shader), campo stellato di sfondo.
- Camera con auto-rotazione lenta + drag per ruotare/zoom.
- Tema visuale: palette scura, accenti (es. ambra/ciano) coerenti col portfolio.
- Stato globale leggero (Zustand) per eventi e filtri.

**Output atteso:** `npm run dev` mostra un globo 3D che ruota, performante (60fps).

**Checkpoint → `PROGRESS.md`:** libreria 3D definitiva (R3F vs globe.gl), texture/shader scelti, palette.

---

## SEZIONE 7 — Layer di visualizzazione (epicentri + vulcani)

**Obiettivo:** dati reali sul globo, con il "wow".

**Task**
- Conversione `(lat, lon)` → posizione 3D sulla superficie della sfera.
- **Epicentri terremoti:** punti/anelli che **pulsano**; dimensione e colore
  scalati per magnitudo (es. gradiente verde→ambra→rosso). Animazione ring-pulse
  (shader o sprite animato).
- **Vulcani:** marker distinti (icona/cono/glow), tooltip al hover.
- Performance: instanced meshes per N eventi (`InstancedMesh`), non un mesh per punto.
- Click su evento → pannello dettaglio (magnitudo, profondità, ora, luogo).

**Output atteso:** globo con epicentri pulsanti + vulcani, fluido con centinaia di eventi.

**Checkpoint → `PROGRESS.md`:** tecnica pulse, scala colori/dimensioni, limite N eventi renderizzati.

---

## SEZIONE 8 — UI command-center (HUD)

**Obiettivo:** trasformare il globo in una **console**.

**Task**
- **Ticker eventi live** (scroll laterale o bottom) con ultimi eventi.
- **Pannello statistiche 24h:** conteggio terremoti, max magnitudo, vulcani attivi.
- **Filtri:** magnitudo minima, finestra temporale, tipo evento → aggiornano il globo.
- HUD/overlay stile tattico: bordi, griglie, font monospace, micro-animazioni.
- Polling/refresh periodico dei dati dall'API (o SSE se si vuole live vero).

**Output atteso:** dashboard completa command-center che si aggiorna dai dati reali.

**Checkpoint → `PROGRESS.md`:** componenti HUD, intervallo di refresh, filtri implementati.

---

## SEZIONE 9 — API FastAPI completa

> Può essere anticipata **prima** della SEZIONE 6 così il frontend ha dati veri.

**Obiettivo:** servire eventi filtrabili + aggregati.

**Task**
- `GET /events` con filtri: `event_type`, `min_magnitude`, `start`, `end`,
  bounding box (`min_lat/max_lat/min_lon/max_lon`), `limit/offset`.
- (PostGIS) filtro opzionale "vicinanza": `near_lat`, `near_lon`, `radius_km`
  → `ST_DWithin(geom, ...)`. Sfrutta la colonna `geom` e l'indice GiST.
- `GET /stats` aggregati: conteggi 24h/7g, max magnitudo, n. vulcani attivi.
- Pydantic response models; CORS per il dominio Vercel.
- Paginazione e ordinamento per `occurred_at`.
- Test endpoint con `pytest` + DB di test.

**Output atteso:** `uvicorn api.main:app` espone `/events` e `/stats`; OpenAPI docs su `/docs`.

**Checkpoint → `PROGRESS.md`:** contratto endpoint, parametri, formato risposta.

---

## SEZIONE 10 — Dockerizzazione & Deploy

**Obiettivo:** tutto online e cliccabile.

**Task**
- `Dockerfile` per `api/` (e per i job ETL se serve immagine dedicata).
- Deploy backend + Postgres su **Render** (o Railway); configurare `DATABASE_URL`.
- Deploy frontend su **Vercel**; `VITE_API_URL` → backend pubblico.
- Configurare i secret GitHub Actions (`DATABASE_URL`) per i cron.
- Verifica end-to-end: cron scrive → API legge → globo mostra.

**Output atteso:** URL pubblico del frontend funzionante con dati reali.

**Checkpoint → `PROGRESS.md`:** URL live, provider, env di produzione, costi/limiti.

---

## SEZIONE 11 — README & rifinitura

**Obiettivo:** vetrina da portfolio.

**Task**
- README: 1 frase sul problema, GIF/screenshot del globo, link Live Demo + Codice.
- **Diagramma flusso ETL** (2 fonti → normalizza → DB → API → UI) — Mermaid o immagine.
- Sezione "schema eventi unificato" + nota sulle cadenze diverse.
- Badge: CI, "last run" dei due cron, licenza.
- Pulizia: rimuovi codice morto, controlla console FE pulita, Lighthouse.

**Definition of Done globale**
- [ ] Le due pipeline girano da sole (badge "last run" verdi).
- [ ] Dashboard live con globo 3D + ticker che si aggiornano dai dati reali.
- [ ] README con diagramma ETL + nota cadenze diverse.
- [ ] Schema eventi unificato documentato.
- [ ] Repo pubblico su GitHub con commit puliti e CI verde.

---

## Riferimenti rapidi

- USGS Earthquake API: <https://earthquake.usgs.gov/fdsnws/event/1/>
- Smithsonian GVP (Weekly Report): <https://volcano.si.edu/reports_weekly.cfm>
- react-three-fiber: <https://docs.pmnd.rs/react-three-fiber>
- drei helpers: <https://github.com/pmndrs/drei>
