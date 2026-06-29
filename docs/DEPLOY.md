# DataPulse — Deploy (SEZIONE 10)

Guida operativa per mettere online DataPulse. Architettura di produzione:

```
 GitHub Actions (cron ETL)  ──upsert──►  Postgres+PostGIS (Render)  ◄──read──  API FastAPI (Render, Docker)
                                                                                      ▲
                                                                                      │ HTTPS (CORS)
                                                                          Frontend (Vercel, build statica Vite)
```

- **Backend API + Postgres** → **Render** (piano free).
- **Frontend** → **Vercel** (build statica di `web/`).
- **Cron ETL** → **GitHub Actions** (già pronti, SEZIONE 5): scrivono sul DB Render.

> Perché Render: unico tra i due con un **free tier vero** (web service + Postgres gestito)
> e supporto **PostGIS** (vincolo forte del progetto). Trade-off del free: il web service va
> in **spin-down dopo ~15 min** di inattività (primo accesso ~50s di cold-start) e il
> **Postgres free ha durata limitata** (va ricreato alla scadenza). Accettabile per un portfolio.

---

## 0. Prerequisiti
- Account: [Render](https://render.com), [Vercel](https://vercel.com), GitHub (repo già su `origin`).
- Repo pushato con i file di questa sezione (`Dockerfile`, `render.yaml`, `web/vercel.json`, ...).

---

## 1. Backend + DB su Render (Blueprint)

Il file [`render.yaml`](../render.yaml) descrive **entrambe** le risorse (DB + API).

1. Render Dashboard → **New** → **Blueprint**.
2. Collega il repo `MarioSambataro/DataPulse`, branch `main`. Render legge `render.yaml`.
3. Conferma la creazione di:
   - `datapulse-db` — Postgres 16 free (region **frankfurt**).
   - `datapulse-api` — web service Docker (builda `./Dockerfile`).
4. **Apply**. Render builda l'immagine e avvia l'API. All'avvio l'entrypoint esegue
   `alembic upgrade head` → crea l'estensione PostGIS, la tabella `events`, indici e trigger.

### PostGIS
Il Postgres gestito di Render consente `CREATE EXTENSION postgis` (è nella allow-list). La
migrazione iniziale lo fa da sola. **Verifica** dopo il primo deploy (Render → datapulse-db →
*Connect* → PSQL): `SELECT postgis_version();` deve rispondere.

### Variabili d'ambiente (Render → datapulse-api → Environment)
| Variabile | Valore | Origine |
|-----------|--------|---------|
| `DATABASE_URL` | *(auto)* connection string **interna** del DB | iniettata dal blueprint |
| `RUN_MIGRATIONS` | `1` | blueprint (migrazioni al boot) |
| `CORS_ALLOW_ORIGINS` | `https://<tuo-progetto>.vercel.app` | **da impostare a mano** dopo lo step 2 |

> `CORS_ALLOW_ORIGINS` ha `sync:false`: non sta nel repo. Lo valorizzi quando conosci
> l'URL Vercel (step 2). Niente origin hard-coded nel codice (`api/config.py` la legge da env).

5. Annota l'URL pubblico dell'API: `https://datapulse-api.onrender.com` (varia col nome).
   Controlla `GET /health` → `{"status":"ok"}` e `/docs` (Swagger).

---

## 2. Frontend su Vercel

1. Vercel → **Add New** → **Project** → importa il repo.
2. **Root Directory** = `web` (il resto lo gestisce [`web/vercel.json`](../web/vercel.json): preset Vite, build `npm run build`, output `dist`).
3. **Environment Variables**: `VITE_API_URL` = URL Render dello step 1
   (es. `https://datapulse-api.onrender.com`). È build-time (Vite la inserisce nel bundle).
4. **Deploy**. Ottieni l'URL pubblico, es. `https://datapulse.vercel.app`.

### Chiudi il CORS
Torna su Render → `datapulse-api` → Environment → `CORS_ALLOW_ORIGINS` =
l'origin Vercel esatto (`https://datapulse.vercel.app`, **senza** slash finale).
Più origin → separali con virgola. Salva → Render ridistribuisce.

---

## 3. Cron ETL → DB di produzione (GitHub Actions)

I due workflow (`etl-earthquakes.yml`, `etl-volcanoes.yml`) leggono `secrets.DATABASE_URL`.

1. Render → `datapulse-db` → copia la connection string **ESTERNA** (External Database URL).
2. GitHub → repo → **Settings → Secrets and variables → Actions → New repository secret**:
   - Nome: `DATABASE_URL`
   - Valore: la connection string esterna. Se la connessione fallisce per TLS, appendi
     `?sslmode=require`.
3. Lancio manuale per popolare subito: **Actions** → *ETL earthquakes* → **Run workflow**
   (poi *ETL volcanoes*). Da lì in poi girano da soli (orario / giornaliero).

> Distinzione importante: l'**API** usa la URL **interna** (stessa region, no SSL, più veloce);
> le **Actions** girano fuori da Render → serve la URL **esterna**.

---

## 4. Verifica end-to-end
1. Actions → i due run ETL passano (verde) → scrivono su `events`.
2. API: `https://datapulse-api.onrender.com/events?limit=2` → envelope con dati;
   `/stats` → conteggi non nulli.
3. Frontend: apri l'URL Vercel → globo con epicentri/vulcani, ticker che scorre, SITREP
   popolato (tag **non** `DERIVED`/`OFFLINE` = sta leggendo l'API reale).

---

## Verifica locale dell'immagine (prima del deploy live)
Senza account cloud, l'immagine si prova contro il Postgres del compose:

```sh
cp .env.example .env                 # se non esiste già
docker compose up -d postgres        # DB + PostGIS
docker compose up -d --build api     # builda il Dockerfile e avvia l'API
curl http://localhost:8000/health    # {"status":"ok"}
# /docs nel browser → Swagger
docker compose logs api              # mostra "alembic upgrade head" all'avvio
```

---

## Costi / limiti (free tier Render)
- **Web service free**: spin-down dopo ~15 min idle, cold-start ~50s, 750h/mese.
- **Postgres free**: storage e durata limitati (il DB free scade e va ricreato; ri-applicare
  le migrazioni e rilanciare i cron ETL). Per "always-on" → upgrade a istanza a pagamento.
- **Vercel Hobby**: build statica gratis, ampiamente sufficiente.
- **GitHub Actions**: i cron rientrano nei minuti free dei repo pubblici.
