import { create } from "zustand";

import type { Event, Filters } from "../types";

/** Modalità di visualizzazione della superficie terrestre. */
export type GlobeView = "night" | "day";

// Store globale leggero (Zustand). In SEZIONE 6 tiene solo lo stato UI del globo
// e contenitori vuoti per eventi/filtri; SEZIONE 7 lo popolerà da GET /events.
interface AppState {
  events: Event[];
  filters: Filters;
  autoRotate: boolean; // intento utente: auto-rotazione lenta della camera
  interacting: boolean; // pausa transitoria dell'auto-rotazione (hover/drag/click)
  globeView: GlobeView; // notturno (luci città) vs diurno (Terra reale)
  selectedId: string | null; // evento selezionato (pannello dettaglio futuro)

  setEvents: (events: Event[]) => void;
  setFilters: (patch: Partial<Filters>) => void;
  setAutoRotate: (value: boolean) => void;
  toggleAutoRotate: () => void;
  setGlobeView: (view: GlobeView) => void;
  toggleGlobeView: () => void;
  select: (id: string | null) => void;
  pauseRotation: () => void; // ferma subito l'auto-rotazione (interazione in corso)
  resumeRotationAfter: (ms: number) => void; // riprende da sola dopo `ms` di inattività
}

// Timer di ripresa a livello modulo (solo client): evita di sporcare lo store.
let resumeTimer: ReturnType<typeof setTimeout> | null = null;

export const useStore = create<AppState>((set) => ({
  events: [],
  filters: { eventType: "all", minMagnitude: 0, timeWindow: "all" },
  autoRotate: true,
  interacting: false,
  globeView: "night",
  selectedId: null,

  setEvents: (events) => set({ events }),
  setFilters: (patch) => set((state) => ({ filters: { ...state.filters, ...patch } })),
  setAutoRotate: (value) => set({ autoRotate: value }),
  toggleAutoRotate: () => set((state) => ({ autoRotate: !state.autoRotate })),
  setGlobeView: (view) => set({ globeView: view }),
  toggleGlobeView: () => set((state) => ({ globeView: state.globeView === "night" ? "day" : "night" })),
  select: (id) => set({ selectedId: id }),

  pauseRotation: () => {
    if (resumeTimer) {
      clearTimeout(resumeTimer);
      resumeTimer = null;
    }
    set((state) => (state.interacting ? state : { interacting: true }));
  },
  resumeRotationAfter: (ms) => {
    if (resumeTimer) clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => {
      resumeTimer = null;
      set({ interacting: false });
    }, ms);
  },
}));
