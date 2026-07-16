# DataPulse — Deploy gratuito completo

Architettura di produzione per la demo portfolio:

```text
GitHub Actions (ETL) ──upsert──► Neon PostgreSQL + PostGIS ◄──read── Render FastAPI
                                                                         ▲
                                                                         │ HTTPS/CORS
                                                               Vercel React/Vite
```

- **Database persistente** → Neon Free.
- **Backend API** → Render Free, immagine Docker del repository.
- **Frontend** → Vercel Hobby, build statica della cartella `web/`.
- **ETL** → GitHub Actions, gratuiti per il repository pubblico.

Questa configurazione evita il Postgres Free di Render, che scade dopo 30 giorni.
Il web service Render Free rimane adatto a una demo, ma va in sospensione dopo un
periodo di inattività: il primo accesso può richiedere circa un minuto.

## 0. Prerequisiti

- Repository GitHub pubblico e aggiornato.
- Account gratuiti Neon, Render e Vercel.
- Nessun secret committato: `.env` è escluso da Git.

## 1. Database Neon + PostGIS

1. Neon Console → **New project**.
2. Scegliere una regione europea vicina a Render, preferibilmente Frankfurt.
3. Nel SQL Editor eseguire:

   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   SELECT postgis_version();
   ```

4. Da **Connect** copiare la connection string **diretta**:

   ```text
   postgresql://USER:PASSWORD@ENDPOINT.neon.tech/neondb?sslmode=require&channel_binding=require
   ```

La stringa contiene credenziali: deve vivere soltanto nei secret dei provider.

## 2. Backend FastAPI su Render

Il file `render.yaml` crea un singolo servizio Docker `datapulse-api`.

1. Render Dashboard → **New → Blueprint**.
2. Collegare il repository e il branch `main`.
3. Durante la creazione valorizzare:

   | Variabile | Valore |
   |---|---|
   | `DATABASE_URL` | connection string diretta Neon |
   | `CORS_ALLOW_ORIGINS` | origin Vercel; temporaneamente `http://localhost:5173` |
   | `RUN_MIGRATIONS` | già impostata a `1` nel Blueprint |

4. Applicare il Blueprint.

All'avvio `docker-entrypoint.sh` esegue `alembic upgrade head`, creando schema,
indici geografici e trigger sul database Neon. Il comando è idempotente.

Verificare:

```text
https://<servizio>.onrender.com/health
https://<servizio>.onrender.com/status
https://<servizio>.onrender.com/docs
```

La chiave `DEEPSEEK_API_KEY` è opzionale. Se disponibile, aggiungerla soltanto in
Render → Environment; non deve essere esposta a Vercel o GitHub.

## 3. Frontend su Vercel

1. Vercel → **Add New → Project** e importare il repository.
2. Impostare **Root Directory** = `web`.
3. Aggiungere la variabile build-time:

   ```text
   VITE_API_URL=https://<servizio>.onrender.com
   ```

4. Eseguire il deploy. `web/vercel.json` configura Vite, build e cartella `dist`.

Quando l'URL definitivo è noto, tornare su Render e impostare:

```text
CORS_ALLOW_ORIGINS=https://<progetto>.vercel.app
```

L'origin deve essere esatto e senza slash finale. Salvare e ridistribuire l'API.

## 4. ETL su GitHub Actions

GitHub → repository → **Settings → Secrets and variables → Actions**:

```text
Name:  DATABASE_URL
Value: connection string diretta Neon
```

Avviare manualmente, nell'ordine:

1. **ETL Earthquakes (USGS)**;
2. **ETL Volcanoes (GVP)**.

I workflow continueranno poi con la schedulazione configurata. API ed ETL usano
lo stesso database, quindi i dati appaiono nella dashboard senza passaggi aggiuntivi.

## 5. Verifica end-to-end

1. Entrambi i workflow ETL risultano verdi.
2. `GET /events?limit=2` restituisce record.
3. `GET /stats` restituisce conteggi valorizzati.
4. `GET /status` riporta database `ok` e una ingestione recente.
5. Il frontend mostra feed live, ticker, statistiche e marker sul globo.
6. La console del browser non contiene errori CORS.

## Limiti del percorso gratuito

- Render Free sospende il backend inattivo; il primo caricamento può essere lento.
- Neon Free offre risorse adatte a una demo, non a un carico produttivo continuo.
- Vercel Hobby è destinato a progetti personali e portfolio.
- Il dominio personalizzato è opzionale e il relativo acquisto non è gratuito.

Per rendere il cold start comprensibile, il frontend deve mostrare uno stato di
attesa e ritentare la richiesta invece di presentare immediatamente “feed offline”.
