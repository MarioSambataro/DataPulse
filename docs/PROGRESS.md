# DataPulse — Progressi & Decisioni implementative

> **File di stato.** Da leggere all'INIZIO di ogni sessione e aggiornare alla
> FINE di ogni sezione. Tiene la memoria del progetto tra una sessione e l'altra,
> così non serve ricaricare tutto il contesto (= risparmio token).
>
> Vedi il piano: [`PIANO_SVILUPPO.md`](./PIANO_SVILUPPO.md)

---

## 📍 Stato attuale

- **Sezione in corso:** SEZIONE 2 — DB & schema eventi unificato (prossima)
- **Ultimo aggiornamento:** 2026-06-28
- **Prossimo passo:** Alembic init + prima migrazione tabella `events` con PostGIS (vedi SEZIONE 2)
- **Deciso:** PostGIS = SÌ (colonna `geom` + indice GiST). Immagine DB già aggiornata a `postgis/postgis:16-3.4`.

### Avanzamento sezioni
| # | Sezione | Stato |
|---|---------|-------|
| 1 | Setup repo & scaffold | ✅ fatto |
| 2 | DB & schema eventi unificato | ⬜ da fare |
| 3 | ETL terremoti (USGS) | ⬜ da fare |
| 4 | ETL vulcani (GVP) | ⬜ da fare |
| 5 | Scheduling (Actions cron) | ⬜ da fare |
| 6 | Frontend base + globo 3D | ⬜ da fare |
| 7 | Layer visualizzazione | ⬜ da fare |
| 8 | UI command-center | ⬜ da fare |
| 9 | API FastAPI completa | ⬜ da fare |
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

---

## 📝 Log delle sessioni

Aggiungi una voce in cima a ogni fine-sezione.

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
- [ ] Creare repo remoto su GitHub e fare il primo push.
- [ ] Scegliere provider deploy backend (Render vs Railway).
- [ ] Confermare libreria 3D definitiva.
