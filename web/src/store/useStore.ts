import { create } from "zustand";

import type { Event, Filters } from "../types";

/** Modalità di visualizzazione della superficie terrestre. */
export type GlobeView = "night" | "day";

// Store globale leggero (Zustand). In SEZIONE 6 tiene solo lo stato UI del globo
// e contenitori vuoti per eventi/filtri; SEZIONE 7 lo popolerà da GET /events.
interface AppState {
  events: Event[];
  filters: Filters;
  autoRotate: boolean; // auto-rotazione lenta della camera
  globeView: GlobeView; // notturno (luci città) vs diurno (Terra reale)
  selectedId: string | null; // evento selezionato (pannello dettaglio futuro)

  setEvents: (events: Event[]) => void;
  setFilters: (patch: Partial<Filters>) => void;
  setAutoRotate: (value: boolean) => void;
  toggleAutoRotate: () => void;
  setGlobeView: (view: GlobeView) => void;
  toggleGlobeView: () => void;
  select: (id: string | null) => void;
}

export const useStore = create<AppState>((set) => ({
  events: [],
  filters: { eventType: "all", minMagnitude: 0 },
  autoRotate: true,
  globeView: "night",
  selectedId: null,

  setEvents: (events) => set({ events }),
  setFilters: (patch) => set((state) => ({ filters: { ...state.filters, ...patch } })),
  setAutoRotate: (value) => set({ autoRotate: value }),
  toggleAutoRotate: () => set((state) => ({ autoRotate: !state.autoRotate })),
  setGlobeView: (view) => set({ globeView: view }),
  toggleGlobeView: () => set((state) => ({ globeView: state.globeView === "night" ? "day" : "night" })),
  select: (id) => set({ selectedId: id }),
}));
