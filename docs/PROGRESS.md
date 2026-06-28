# DataPulse — Progressi & Decisioni implementative

> **File di stato.** Da leggere all'INIZIO di ogni sessione e aggiornare alla
> FINE di ogni sezione. Tiene la memoria del progetto tra una sessione e l'altra,
> così non serve ricaricare tutto il contesto (= risparmio token).
>
> Vedi il piano: [`PIANO_SVILUPPO.md`](./PIANO_SVILUPPO.md)

---

## 📍 Stato attuale

- **Sezione in corso:** SEZIONE 1 — Setup repo & scaffold (non iniziata)
- **Ultimo aggiornamento:** 2026-06-28
- **Prossimo passo:** creare struttura cartelle + docker-compose Postgres

### Avanzamento sezioni
| # | Sezione | Stato |
|---|---------|-------|
| 1 | Setup repo & scaffold | ⬜ da fare |
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
| | | | |

---

## 📝 Log delle sessioni

Aggiungi una voce in cima a ogni fine-sezione.

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
