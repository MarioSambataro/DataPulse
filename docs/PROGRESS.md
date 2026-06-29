# DataPulse — Progressi & Decisioni implementative

> **File di stato.** Da leggere all'INIZIO di ogni sessione e aggiornare alla
> FINE di ogni sezione. Tiene la memoria del progetto tra una sessione e l'altra,
> così non serve ricaricare tutto il contesto (= risparmio token).
>
> Vedi il piano: [`PIANO_SVILUPPO.md`](./PIANO_SVILUPPO.md)

---

## 📍 Stato attuale

- **Sezione in corso:** SEZIONE 10 ✅ fatta (file/config deploy + verifica locale immagine) → **prossima: SEZIONE 11** (README & rifinitura)
- **Ultimo aggiornamento:** 2026-06-29
- **Prossimo passo:** ordine **11**. Deploy preparato in modalità "file + guida": `Dockerfile` (API, python-slim, `.[api,db]`, entrypoint che fa `alembic upgrade head` poi `uvicorn`, healthcheck), `render.yaml` (Blueprint: Postgres free + web Docker), `web/vercel.json`, `docker-compose.yml` con servizio `api`, `docs/DEPLOY.md` (guida passo-passo). Provider scelto: **Render** (backend+DB) + **Vercel** (frontend). Immagine verificata in locale (build + run contro il Postgres del compose: `/health`, `/docs`, `/events` total 455). **Deploy live da fare TU** coi tuoi account (Render/Vercel/secret GitHub) seguendo `docs/DEPLOY.md`. Commit SEZIONE 10 locale da pushare (attendere ok).
- **Deciso:** 2 workflow cron attivi (terremoti `0 * * * *` orario, vulcani `0 6 * * *` giornaliero), entrambi con `workflow_dispatch` + concurrency group; `DATABASE_URL` da `secrets.DATABASE_URL` (secret + DB prod → SEZIONE 10); badge status nel README. CI invariata (lint+test su push/PR).

### Avanzamento sezioni
| # | Sezione | Stato |
|---|---------|-------|
| 1 | Setup repo & scaffold | ✅ fatto |
| 2 | DB & schema eventi unificato | ✅ fatto |
| 3 | ETL terremoti (USGS) | ✅ fatto |
| 4 | ETL vulcani (GVP) | ✅ fatto |
| 5 | Scheduling (Actions cron) | ✅ fatto |
| 6 | Frontend base + globo 3D | ✅ fatto |
| 7 | Layer visualizzazione | ✅ fatto |
| 8 | UI command-center | ✅ fatto |
| 9 | API FastAPI completa | ✅ fatto |
| 10 | Dockerizzazione & Deploy | ✅ fatto (file/config + verifica locale; deploy live a cura utente) |
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
| 2026-06-29 | 3D lib (DEFINITIVA) | **`react-three-fiber` v8 + `@react-three/drei` v9 + three v0.169** (no globe.gl) | Confermata la candidata: controllo completo di shader (atmosfera fresnel, griglia, futuri epicentri pulsanti SEZ.7) e materiali. drei dà `OrbitControls`/`Stars`/`useTexture` pronti. R3F v8 = React 18 (stack maturo) |
| 2026-06-29 | Globo superficie | **Texture reali 4k** (giorno + luci notturne) su `MeshStandardMaterial` + **switch giorno/notte** + **griglia lat/lon procedurale** (shader) + **fallback procedurale** se le texture mancano | Scelta utente "wow + professionale": le luci città danno l'effetto, la griglia/atmosfera ambra-ciano danno l'identità command-center. Fallback (ErrorBoundary+Suspense) → globo sempre renderizzato (CI/offline robusti) |
| 2026-06-29 | Texture asset | NASA Blue/Black Marble via Solar System Scope (**CC BY 4.0**), 8k→**4k** (4096×2048) ridotte con `sharp` (transiente, `--no-save`) + mozjpeg q82 → **~0.8 MB** totali in `web/public/textures/` | 1k iniziale troppo soft a schermo intero; 8k = ~180 MB GPU/texture (rischio 60fps). 4k = nitido + ~45 MB GPU. `sharp` non resta tra le dipendenze. Attribuzione in `public/textures/README.md` |
| 2026-06-29 | Vista giorno/notte | `night` (mappa scurita #243447 + luci emissive ambra 1.7) ↔ `day` (Terra reale, earthshine emissivo 0.12 sul lato in ombra). Toggle HUD + deep-link `?view=day\|night` | Notte = look tattico DataPulse; giorno = Terra realistica leggibile. Param URL = vista condivisibile (e screenshot headless) |
| 2026-06-29 | Atmosfera/shader | Alone **fresnel** (sfera BackSide + blending additivo, `pow(1-|dot(view,normal)|, power)`): strato ciano largo (power 3.2) + strato ambra stretto (power 5). Griglia lat/lon via shader (linee fwidth-AA, attenuate sul lembo) | Effetto glow/atmosfera senza post-processing; doppio strato = profondità. Shader in `src/three/shaders.ts` (modulo non-componente, riusabile) |
| 2026-06-29 | Camera | drei `OrbitControls`: **auto-rotazione** lenta (speed 0.35, toggle store/HUD) + **drag** per ruotare, **scroll** zoom (no pan), damping, `minDistance 2.4`/`maxDistance 9` | Esperienza "globo che ruota da solo" + interazione fluida; limiti distanza evitano di entrare/uscire dalla scena |
| 2026-06-29 | FE struttura/store | Componenti: `App`(+HUD) · `three/{Scene,Globe,Atmosphere}` · `shaders.ts`; util pura `lib/geo.ts` (`latLonToVec3`, testata, no dipendenza three); stato globale **Zustand** (`store/useStore`): `events`/`filters`/`autoRotate`/`globeView`/`selectedId`; tipi `types.ts` allineati a `api/schemas` (`Event`/`EventPage`/`Stats`) | `geo.ts` pura = testabile in CI senza WebGL (base per posizionare eventi in SEZ.7); store già pronto a ricevere `GET /events`; tipi FE = contratto API |
| 2026-06-29 | Epicentri (tecnica) | **Un solo `InstancedMesh`** di quad (PlaneGeometry) tangenti alla superficie → effetto "radar ping". `ShaderMaterial` custom (`eventShaders.ts`): nucleo a disco + **anello che si espande e svanisce** (`uTime` condiviso, `aPhase` per-istanza dalla sequenza aurea → pulsazioni sfalsate). `toneMapped:false`, `NormalBlending`, `depthWrite:false` | InstancedMesh = un draw call per centinaia di eventi (60fps). Anello tangente = look command-center; back-hemisphere occluso dal globo opaco (depthTest). `toneMapped:false` per spiccare sulle luci città in vista notte |
| 2026-06-29 | Scala colori/dimensioni | `lib/severity.ts` (puro, testato): `severityColor(severity)` = gradiente **verde→ambra→rosso** (stop a 0/0.5/1, `null`→0.5); `magnitudeSize(mag)` = frazione del raggio, curva quadratica `0.012..0.062` (clamp mag 0..8), `null`→minima. Size epicentro `= magnitudeSize·radius·2.4` | Singola fonte di verità della palette eventi (usata da shader epicentri **e** marker vulcani **e** pannello). Funzione pura = testabile in CI senza WebGL (come `geo.ts`) |
| 2026-06-29 | Vulcani (marker) | **Mesh individuali** (pochi, ~24): cono radiale **auto-illuminato** (`color:#000`+`emissive`=severità, `toneMapped:false` → niente sbiancamento sotto la luce direzionale) + alone additivo + **tooltip drei `<Html>`** al hover (nome/luogo). Click → selezione | I vulcani sono decine, non centinaia → mesh singole = hover/tooltip/click semplici (niente raycast su instanceId). Auto-illuminati = colore costante in vista giorno/notte |
| 2026-06-29 | Selezione/dettaglio | Click su epicentro (`e.instanceId`→`events[i]`) o vulcano → `select(id)` nello store; `DetailPanel` (DOM, sopra il Canvas) legge `selectedId` e mostra **magnitudo/profondità (solo sismici)/luogo/ora UTC/coords**; chiusura ✕ o `Esc` | Pannello "minimale" richiesto; DOM (non in-canvas) = testo nitido e accessibile; profondità/magnitudo nascoste per i vulcani (null nello schema) |
| 2026-06-29 | Fetching / limite N | `lib/api.ts` `fetchEvents()` → `GET {VITE_API_URL}/events?order=desc&limit=1000` (= `MAX_LIMIT` API); hook `useEventsLoader` fa **un fetch one-shot al mount** (AbortController), gestisce `loading/ready/error` mostrati nell'HUD ("ACQUIRING FEED…"/"N EVENTS TRACKED"/"⚠ FEED OFFLINE"). **Polling/refresh → SEZIONE 8** | `VITE_API_URL` default dev `http://localhost:8000`. 1000 eventi = un InstancedMesh regge senza problemi; il polling è funzione della console live (SEZ.8) |
| 2026-06-29 | Mock screenshot | `?mock=1` carica un fixture statico `web/public/mock-events.json` (stesso envelope `EventPage`, 36 terremoti + 8 vulcani globali) invece di chiamare l'API | Demo/screenshot senza DB+API+ETL; opt-in, non tocca il percorso reale. Servito come asset statico (fuori dal bundle JS) |
| 2026-06-29 | Struttura layer | `three/EventsLayer` (split per tipo + applica i `filters` dello store) → `three/Epicenters` (instanced) + `three/Volcanoes`; shader in `three/eventShaders.ts`; util `lib/severity.ts`+test, `lib/api.ts`, `hooks/useEventsLoader.ts`, `components/DetailPanel.tsx`. **Nessuna nuova dipendenza npm** (`<Html>` è di drei già installato) | Coerente con la separazione SEZ.6 (componenti three sottili + util pure testabili + store). Il layer già rispetta `filters` (eventType/minMagnitude) così i controlli SEZ.8 funzionano senza rifattorizzare |
| 2026-06-29 | FE tooling | Vite 5 + `@vitejs/plugin-react`; ESLint flat (recommended + `react-hooks` + `react-refresh`, globals browser); tsconfig split (`app`/`node`, `tsc -b`); Vitest env **node** (test solo funzioni pure) | Allineato al job CI `frontend` (Node 20, `lint`+`test --if-present`, niente build). Test in `node` → niente jsdom/canvas fragili in CI |
| 2026-06-29 | FE filtri (SEZ.8) | **Solo client-side** (scelta utente): `lib/filters.filterEvents` (puro, testato) è l'unica fonte di verità del filtro, usata da `EventsLayer`, `EventTicker` e dal contatore dei `FiltersPanel`. `minMagnitude` si applica **solo ai terremoti** → i vulcani (mag null) restano visibili in modalità "all"; finestra temporale `24h`/`7d`/`all` su `occurred_at` | Istantaneo, niente flicker/latenza, niente chiamate extra. Il filtro API `min_magnitude` escluderebbe i vulcani anche in "all"; client-side evitiamo il problema. Opera sui ≤1000 eventi caricati (ampiamente sufficiente per il portfolio) |
| 2026-06-29 | FE polling (SEZ.8) | **120s** (`POLL_INTERVAL_MS` in `lib/api.ts`): `useEventsLoader` ri-fetcha `GET /events` e `useStatsLoader` `GET /stats`. Primo load = "loading"; refresh **silenziosi** (resta "ready") che rimpiazzano gli eventi nello store; un refresh fallito con dati già presenti NON sbandiera FEED OFFLINE | Cron ETL orario (terremoti)/giornaliero (vulcani) → i dati cambiano lentamente; 120s dà un feel "live" senza martellare il backend. `AbortController` per request; nessun flicker (l'InstancedMesh rimonta solo se cambia il numero di eventi) |
| 2026-06-29 | FE /stats (SEZ.8) | `useStatsLoader`: in reale usa `GET /stats`; in `?mock=1` (niente endpoint) **e come fallback se /stats fallisce** deriva le stat client-side da `lib/stats.deriveStats` (puro, testato) sugli eventi in store, con le stesse finestre rolling 24h/7g dell'API. `source` (`api`/`derived`) → tag **MOCK/DERIVED/OFFLINE** nel pannello | Il pannello SITREP è **sempre popolato** (screenshot/demo senza DB). `deriveStats` replica `api.queries.compute_stats`; vulcani attivi = `meta.volcano_number` distinti (fallback `id` se assente, es. mock) |
| 2026-06-29 | HUD struttura (SEZ.8) | Componenti DOM sopra il Canvas: `StatsPanel`+`FiltersPanel` in sidebar destra (`.side-stack`), `EventTicker` marquee CSS lungo il bordo inferiore (lista duplicata + `@keyframes ticker-scroll`, pausa su `:hover`, righe cliccabili→`select`), `DetailPanel` (SEZ.7) risalito sopra il ticker. In-canvas: `three/SelectionMarker` (reticolo ciano pulsante tangente sull'evento `selectedId`, additive, `toneMapped:false`). Util pure nuove: `lib/filters.ts`, `lib/stats.ts`, `lib/format.ts` (`timeAgo`) | Coerente con la separazione SEZ.6/7 (DOM per testo nitido + componenti three sottili + util pure testabili in CI). Ticker via CSS marquee = 0 costo JS per frame; reticolo reagisce a click globo **e** ticker (stesso `select`/`selectedId`). **0 nuove dipendenze npm** |
| 2026-06-29 | Deploy provider | **Render** (backend API + Postgres) + **Vercel** (frontend), cron ETL su **GitHub Actions** | Render = unico con free tier vero (web service + Postgres gestito) **e** supporto PostGIS (vincolo forte). Trade-off free accettati per portfolio: spin-down ~15min/cold-start ~50s; Postgres free a durata limitata (va ricreato). Railway scartato: niente free tier reale (trial $5 poi ~$5/mese). Modalità scelta: **file/config + guida passo-passo** (`docs/DEPLOY.md`); il deploy live lo esegue l'utente (l'agente non ha gli account cloud) |
| 2026-06-29 | Dockerfile API | `Dockerfile` in **root** (build context = root), `python:3.12-slim`, `pip install ".[api,db]"`, **niente** build-essential/libpq-dev (`psycopg[binary]` porta libpq) → immagine **~300MB**. `ENTRYPOINT docker-entrypoint.sh`; `CMD`→`uvicorn api.main:app` su `$PORT` (default 8000); `HEALTHCHECK` su `/health` legge `$PORT` a runtime. `.dockerignore` esclude web/docs/.env/VCS | Context root perché l'install dei package `etl/api/db` richiede `pyproject.toml` + sorgenti; `etl` incluso perché `api.db` riusa `etl.db`/`etl.config` (single source of verità URL). `$PORT` per compatibilità Render (inietta la porta). **Una sola immagine** (no immagine ETL separata): i cron restano su GitHub Actions con `pip install`, non serve un'immagine dedicata |
| 2026-06-29 | Migrazioni in prod | `alembic -c db/alembic.ini upgrade head` eseguito nell'**entrypoint del container** all'avvio (`docker-entrypoint.sh`, controllato da env `RUN_MIGRATIONS`, default `1`), **non** in un release/pre-deploy command | I pre-deploy/release command di Render sono **solo a pagamento**: l'entrypoint è l'equivalente free-tier. `alembic upgrade head` è **idempotente** (no-op se già aggiornato) → sicuro a ogni avvio/restart, self-healing. Disattivabile con `RUN_MIGRATIONS=0` (es. se in futuro si passa a un release command su tier a pagamento). Crea PostGIS+tabella+trigger al primo boot |
| 2026-06-29 | DATABASE_URL prod | **API (Render):** `DATABASE_URL` iniettata dal blueprint (`fromDatabase`, connection string **interna**, stessa region, no SSL). **Cron ETL (GitHub Actions):** secret `DATABASE_URL` = connection string **esterna** del Postgres Render (`?sslmode=require` se serve). Entrambe `postgresql://` → normalizzate a `postgresql+psycopg://` da `etl.config` | Interna = più veloce e senza SSL per l'API co-locata; esterna = obbligata per le Actions che girano fuori da Render. Un'unica normalizzazione del driver (decisione psycopg v3 rispettata) |
| 2026-06-29 | CORS prod | `CORS_ALLOW_ORIGINS` impostata **a mano** su Render (env `sync:false` nel blueprint) con l'origin Vercel (es. `https://datapulse.vercel.app`); `api/config.py` la legge da env (mai hard-coded) | L'URL Vercel si conosce solo dopo il deploy frontend → non può stare nel repo. `sync:false` lo tiene fuori dal blueprint. Rispetta la predisposizione SEZIONE 9 (origin da env) |
| 2026-06-29 | Frontend deploy | **Vercel**, Root Directory = `web`, `web/vercel.json` (preset Vite, build `npm run build`, output `dist`). `VITE_API_URL` = URL pubblico Render, impostata come env Vercel (**build-time**, entra nel bundle) | Build statica = zero costo/always-on su Vercel Hobby; nessuna SPA-rewrite necessaria (i deep-link usano query param `?view=`/`?mock=`, non path routing). 0 nuove dipendenze npm |
| 2026-06-29 | Compose api locale | `docker-compose.yml`: servizio `api` (stessa immagine prod) con override `DATABASE_URL` → host `postgres` (non `localhost`) | Permette di verificare l'immagine di produzione contro il Postgres del compose senza account cloud; il web resta fuori dal compose (va su Vercel) |
| 2026-06-28 | Test API | Postgres+PostGIS **reale** (scelta utente): in CI un `service postgis/postgis:16-3.4` + step `alembic upgrade head`; in locale il docker già attivo. Isolamento per test: connessione+transazione dedicata, `DELETE FROM events` (visibile solo in-transaction) → DB vuoto deterministico, **rollback** a fine test (dati reali locali intatti). `get_session` sovrascritta sulla sessione del test | Esercita davvero `ST_DWithin`/trigger `geom`/enum nativi; il rollback non sporca né dipende dai dati locali. `httpx` (per `TestClient`) già presente nell'extra `[etl]` → nessuna nuova dipendenza |

---

## 📝 Log delle sessioni

Aggiungi una voce in cima a ogni fine-sezione.

### 2026-06-29 — SEZIONE 10: Dockerizzazione & Deploy ✅
- Cosa è stato fatto: preparati **tutti i file/config di deploy** + guida passo-passo
  (modalità "file + guida": il deploy live lo esegue l'utente coi propri account, l'agente
  non ne ha). Provider: **Render** (API + Postgres) · **Vercel** (frontend) · cron ETL su
  **GitHub Actions** (già pronti, SEZIONE 5). Immagine API **verificata in locale** (build
  + run contro il Postgres del compose).
- File creati/modificati:
  - `Dockerfile` (root, build context root): `python:3.12-slim`, `pip install ".[api,db]"`,
    `HEALTHCHECK` su `/health`, `ENTRYPOINT docker-entrypoint.sh`
  - `docker-entrypoint.sh`: `alembic upgrade head` (se `RUN_MIGRATIONS=1`) → `uvicorn` su `$PORT`
  - `.dockerignore` (esclude web/docs/.env/VCS), `.gitattributes` (`*.sh` eol=lf, anti-CRLF)
  - `render.yaml` (Blueprint: `datapulse-db` Postgres 16 free + `datapulse-api` web Docker;
    `DATABASE_URL` `fromDatabase`, `CORS_ALLOW_ORIGINS` `sync:false`, `RUN_MIGRATIONS=1`)
  - `web/vercel.json` (preset Vite: build `npm run build`, output `dist`)
  - `docker-compose.yml` (abilitato servizio `api` per verifica locale; override `DATABASE_URL`→host `postgres`)
  - `.env.example` (+`RUN_MIGRATIONS`, note prod: DATABASE_URL interna/esterna, VITE_API_URL Vercel)
  - `docs/DEPLOY.md` (guida passo-passo: Render Blueprint, Vercel, secret Actions, verifica e2e, costi/limiti)
  - `docs/PROGRESS.md` (questo aggiornamento)
- Scelte prese: vedi tabella Decisioni (Render+Vercel e perché; Dockerfile root immagine
  unica ~300MB; migrazioni nell'entrypoint perché i release command Render sono a pagamento;
  DATABASE_URL interna per API / esterna per Actions; CORS Vercel da env `sync:false`;
  frontend Vercel build-time `VITE_API_URL`). **0 nuove dipendenze** npm/python.
- Verifiche eseguite (locale, contro il Postgres del compose):
  - `docker build -t datapulse-api .` → OK (wheel `datapulse-0.1.0` + `.[api,db]`), immagine **~300MB**
  - `docker compose up -d postgres` → healthy; `docker compose up -d --build api`
  - `docker compose logs api` → `[entrypoint] alembic upgrade head ...` poi `Application startup complete`
  - `GET /health` → `200 {"status":"ok"}` · `GET /docs` → `200` (Swagger)
  - `GET /events?limit=1` → `200`, envelope `total=455`, item reale (no `geom`); container **healthy**
  - container di test fermato (`docker compose stop api`); Postgres lasciato com'era
- Problemi aperti / TODO: **deploy live a cura utente** (Render Blueprint → impostare
  `CORS_ALLOW_ORIGINS` con l'URL Vercel; Vercel → `VITE_API_URL`; GitHub → secret `DATABASE_URL`
  esterno; lanciare i 2 cron; verifica e2e). Vincolo da verificare in live: `SELECT postgis_version()`
  sul Postgres Render (PostGIS è nella allow-list, ma conferma al primo deploy). Push SEZIONE 10
  in attesa di ok.

### 2026-06-29 — SEZIONE 8: UI command-center (HUD) ✅
- Cosa è stato fatto: il globo è ora una **console**. Aggiunti: **ticker eventi live**
  (marquee orizzontale lungo il bordo inferiore, pausa su hover, ultimi 40 eventi
  filtrati; click su una riga → seleziona l'evento + reticolo sul globo + DetailPanel);
  **pannello SITREP 24h** da `GET /stats` (terremoti 24h, max magnitudo 24h, eventi 7g,
  vulcani attivi 7g) con loading/errore e **fallback derivato** dagli eventi in `?mock=1`
  o se /stats fallisce; **pannello filtri** (tipo all/seismic/volcanic, slider magnitudo
  minima, finestra 24h/7d/all) cablato a `setFilters` → globo+ticker+contatori si
  aggiornano client-side; **polling 120s** di eventi+stats senza flicker; **reticolo**
  ciano pulsante sull'evento selezionato. HUD coerente (bordi, monospace, ambra/ciano).
- File creati/modificati:
  - `web/src/lib/filters.ts` (`filterEvents`/`timeWindowStart`, puro) + `filters.test.ts` (8 test)
  - `web/src/lib/stats.ts` (`deriveStats`, puro) + `stats.test.ts` (3 test)
  - `web/src/lib/format.ts` (`timeAgo` compatto)
  - `web/src/lib/api.ts` (+`fetchStats`, +`isMockMode`, +`POLL_INTERVAL_MS=120s`)
  - `web/src/hooks/useEventsLoader.ts` (+polling silenzioso, no-flicker, no-offline su buco)
  - `web/src/hooks/useStatsLoader.ts` (GET /stats + poll + fallback derivato, `source`)
  - `web/src/components/StatsPanel.tsx` · `FiltersPanel.tsx` · `EventTicker.tsx`
  - `web/src/three/SelectionMarker.tsx` (reticolo) + agganciato in `Scene.tsx`
  - `web/src/three/EventsLayer.tsx` (refactor: usa `filterEvents` condiviso)
  - `web/src/types.ts` (+`TimeWindow`, +`timeWindow` in `Filters`), `store/useStore.ts` (default)
  - `web/src/App.tsx` (+sidebar stat/filtri, +ticker), `web/src/styles.css` (console CSS)
- Scelte prese: vedi tabella Decisioni (filtri **solo client-side** con `minMagnitude` sui
  soli terremoti; **polling 120s**; /stats reale + **derivazione fallback**; struttura HUD
  DOM + reticolo in-canvas; **0 nuove dipendenze npm**).
- Verifiche eseguite:
  - `npm run lint` → eslint pulito · `npm run test` → **24 passed** (6 geo + 9 severity +
    8 filters + 3 stats; +2 file nuovi)
  - `npm run build` (`tsc -b` + vite) → ok (bundle 1.0 MB / 281 KB gzip; warning three
    >500 KB preesistente → SEZIONE 11)
  - `npm run dev` (:5173) + **screenshot headless** (Chrome `--use-angle=swiftshader`)
    con `?mock=1`: (a) vista **notte** — SITREP `DERIVED` (SEISMIC 31 / MAX MAG 6.8 /
    EVENTS 7D 44 / VOLCANOES 7D 8), filtri ALL, ticker che scorre; (b) **selezione** evento
    (Ridgecrest M4.3) → reticolo ciano sul globo + DetailPanel + riga ticker evidenziata,
    vista giorno; (c) filtro **VOLCANIC** → solo coni vulcano, MIN MAG disabilitato con nota
    "n/a · volcanoes have no magnitude", contatore 8/44, ticker con soli vulcani.
  - Console del browser pulita (nessun errore di pagina/three/React).
- Problemi aperti / TODO: push SEZIONE 8 in attesa di ok. Per stat **reali** (non derivate)
  serve `GET /stats` raggiungibile (API up); senza, il pannello mostra `DERIVED`/`OFFLINE`.

### 2026-06-29 — SEZIONE 7: Layer di visualizzazione (epicentri + vulcani) ✅
- Cosa è stato fatto: il globo ora mostra **dati reali**. Il FE fa un fetch one-shot
  di `GET /events` (envelope `EventPage`) via `VITE_API_URL`, popola lo store Zustand
  (`setEvents`) con stato loading/errore nell'HUD, e disegna due layer: **epicentri
  sismici** come singolo `InstancedMesh` di quad tangenti ("radar ping" pulsante,
  colore=severità verde→ambra→rosso, dimensione=magnitudo) e **vulcani** come coni
  auto-illuminati con alone + tooltip al hover. Click su un evento → selezione +
  **pannello dettaglio** minimale (mag/profondità/luogo/ora/coords). I `filters` dello
  store sono già applicati dal layer (i controlli arrivano in SEZIONE 8).
- File creati/modificati:
  - `web/src/lib/severity.ts` (`severityColor`/`magnitudeSize`, pure) + `severity.test.ts` (9 test)
  - `web/src/lib/api.ts` (`fetchEvents` da `VITE_API_URL`, `?mock=1`→fixture statico)
  - `web/src/hooks/useEventsLoader.ts` (fetch one-shot al mount, loading/ready/error)
  - `web/src/three/eventShaders.ts` (GLSL epicentri: nucleo + anello pulsante instanced)
  - `web/src/three/Epicenters.tsx` (InstancedMesh + attributi per-istanza aColor/aPhase,
    `uTime` in `useFrame`, click→`instanceId`→select)
  - `web/src/three/Volcanoes.tsx` (coni emissivi + alone additivo + `<Html>` tooltip hover)
  - `web/src/three/EventsLayer.tsx` (split per tipo + applica `filters`), agganciato in `Scene.tsx`
  - `web/src/components/DetailPanel.tsx` (DOM, legge `selectedId`, chiusura ✕/Esc)
  - `web/src/App.tsx` (+`DataStatus` nell'HUD, +`DetailPanel`), `web/src/styles.css`
    (+status feed, +tooltip vulcano, +pannello dettaglio)
  - `web/src/vite-env.d.ts` (tipo `VITE_API_URL`), `web/public/mock-events.json` (44 eventi)
- Scelte prese: vedi tabella Decisioni (tecnica radar-ping instanced; scala colori/dimensioni
  in `severity.ts` pura; vulcani come mesh individuali auto-illuminate + tooltip; selezione
  + DetailPanel; fetching one-shot + limite 1000; mock `?mock=1`; struttura layer; **0 nuove deps**).
- Verifiche eseguite:
  - `npm run lint` → eslint pulito · `npm run test` → **15 passed** (6 geo + 9 severity)
  - `npm run build` (`tsc -b` + vite) → ok (bundle 1.0 MB / 279 KB gzip; warning three
    >500 KB preesistente → SEZIONE 11)
  - `npm run dev` (porte 5173–5182 occupate → :5183) + **screenshot headless** (Chrome
    `--use-angle=swiftshader`) con `?mock=1`: vista **notte** e **giorno** mostrano i ping
    radar pulsanti scalati per magnitudo lungo Ande/California/Caraibi (ring verde a bassa
    severità in Rep. Dominicana, ambra/rosso più forti) e i coni vulcano (Popocatépetl,
    Fuego, Kilauea/Reykjanes). Status HUD "44 EVENTS TRACKED". Nessun errore di transform.
- Problemi aperti / TODO: push in attesa di ok. Per dati **reali** (non mock) serve
  `docker compose up -d postgres` + `uvicorn api.main:app` + un run ETL, poi aprire il FE
  senza `?mock=1`. Polling/refresh + controlli filtri/ticker/stat → SEZIONE 8.
  - ⚠️ Nota operativa: durante la verifica, lo stop del dev server con un filtro
    `CommandLine like *vite*` ha terminato **tutti** i processi Vite attivi (erano ~10,
    altri progetti aperti sulle porte 5173–5182). Nessun dato perso, vanno solo riavviati.

### 2026-06-29 — SEZIONE 6: Frontend base + globo 3D ✅
- Cosa è stato fatto: scaffold completo Vite + React + TS in `web/` (sopra lo scaffold
  eslint/vitest esistente) e **globo terrestre 3D** in stile command-center: superficie
  con texture reali 4k (giorno + luci notturne NASA), **switch giorno/notte** (richiesta
  utente), atmosfera fresnel a due strati (ciano+ambra), griglia tattica lat/lon
  procedurale, campo stellato, camera con auto-rotazione + drag/zoom, HUD tattico, store
  Zustand. I dati reali (epicentri/vulcani) arrivano in SEZIONE 7.
- File creati/modificati:
  - `web/package.json` (deps React/three/R3F/drei/zustand + dev vite/plugin-react/types/
    eslint-plugin-react-*; script `dev`/`build`/`preview`), `web/package-lock.json`
  - `web/vite.config.ts` (plugin react + config Vitest env node), `web/index.html`
  - `web/tsconfig.json` + `tsconfig.app.json` + `tsconfig.node.json` (split, `tsc -b`)
  - `web/eslint.config.js` (+ react-hooks, react-refresh, globals browser/node)
  - `web/src/main.tsx` (entry + deep-link `?view=`), `App.tsx` (shell + HUD), `styles.css`
  - `web/src/theme.ts` (palette ambra/ciano), `types.ts` (Event/EventPage/Stats = contratto API)
  - `web/src/lib/geo.ts` (`latLonToVec3`, pura) + `geo.test.ts` (6 test)
  - `web/src/store/useStore.ts` (Zustand: events/filters/autoRotate/globeView/selectedId)
  - `web/src/three/Scene.tsx` (Canvas, luci, Stars, OrbitControls), `Globe.tsx`
    (texture giorno/notte + griglia + fallback procedurale via ErrorBoundary/Suspense),
    `Atmosphere.tsx` (fresnel), `shaders.ts` (GLSL atmosfera + griglia)
  - `web/public/textures/{earth-map,earth-night}.jpg` (4k, ~0.8 MB) + `README.md` (attribuzione CC BY 4.0)
  - `web/README.md` (aggiornato), rimossi placeholder `src/index.ts` + `src/smoke.test.ts`
  - `docs/PROGRESS.md` (questo aggiornamento)
- Scelte prese: vedi tabella Decisioni (R3F+drei definitiva; texture 4k NASA + fallback;
  vista giorno/notte + `?view=`; atmosfera fresnel doppio strato + griglia shader;
  OrbitControls auto-rotate+drag; struttura componenti + store Zustand + `geo.ts` pura;
  tooling Vite/ESLint/Vitest allineato alla CI).
- Verifiche eseguite:
  - `cd web && npm install` → 126 pkg, ok
  - `npm run lint` → eslint pulito · `npm run test` → **6 passed** (geo) · `npm run build`
    (`tsc -b` + vite) → ok, bundle 985 KB / **273 KB gzip** (three pesante; code-split =
    rifinitura SEZIONE 11)
  - `npm run dev` → Vite ready (porta auto: 5173 occupata dal portfolio → 5183);
    serve HTML + texture (200) + tutti i moduli, nessun errore transform in console
  - **Screenshot headless** (Chrome `--use-angle=swiftshader`, WebGL): globo notturno
    (luci città 4k nitide su Americhe, griglia/atmosfera ciano, HUD) e diurno (Terra
    realistica blu/verde, nuvole) — switch funzionante via `?view=day|night`
- Problemi aperti / TODO: push in attesa di ok (commit doc + SEZIONE 9 + SEZIONE 6).
  Bundle three >500 KB (warning Vite): valutare code-split/manualChunks in SEZIONE 11.
  `VITE_API_URL` non ancora consumato (data fetching = SEZIONE 7).

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
- [x] ~~**Push del branch `main`**~~: fatto il 2026-06-29 (`6040c12`, include SEZIONE 9 +
      doc + SEZIONE 6). Remote `origin` (`https://github.com/MarioSambataro/DataPulse.git`)
      in pari. I 2 workflow ETL sono ora visibili nella tab Actions (falliranno allo step
      DB finché manca il secret `DATABASE_URL` → SEZIONE 10).
- [x] ~~Scegliere provider deploy backend / DB di produzione (Render vs Railway)~~ →
      **Render** scelto (SEZIONE 10, vedi Decisioni). File/config pronti (`render.yaml`,
      `Dockerfile`, `docs/DEPLOY.md`). **Da fare TU in live:** Render Blueprint + impostare
      il secret `DATABASE_URL` (connection string **esterna**) su GitHub Actions, poi
      lanciare i 2 cron.
- [ ] **CORS prod**: file pronti (`CORS_ALLOW_ORIGINS` `sync:false` nel blueprint, letta da
      env in `api/config.py`). **Da fare TU in live:** valorizzarla su Render con l'origin
      Vercel dopo il deploy frontend.
- [ ] **Deploy live (a cura utente)**: eseguire `docs/DEPLOY.md` (Render API+DB, Vercel
      frontend con `VITE_API_URL`, secret Actions, verifica e2e cron→API→globo). Poi
      annotare qui gli **URL live** e l'esito.
- [x] ~~Confermare libreria 3D definitiva (SEZIONE 6).~~ → **R3F v8 + drei v9 + three 0.169** (vedi Decisioni 2026-06-29).
- [x] ~~Il FE consuma `GET /events` (envelope `EventPage`)~~: fatto in SEZIONE 7
      (`lib/api.ts` + `hooks/useEventsLoader.ts`, `VITE_API_URL` default `:8000`, limit 1000).
- [x] ~~Consumare `GET /stats` + polling/refresh~~: fatto in SEZIONE 8 (`hooks/useStatsLoader.ts`
      + polling 120s in entrambi i loader; fallback derivato in mock/offline). I controlli
      filtri/ticker/SITREP sono cablati; tutto client-side (vedi Decisioni 2026-06-29).
- [ ] Bundle FE: chunk three.js >500 KB → valutare code-split/`manualChunks` in SEZIONE 11.
