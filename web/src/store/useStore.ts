import { create } from "zustand";

import type { Event, Filters } from "../types";

/** Modalità di visualizzazione della superficie terrestre. */
export type GlobeView = "night" | "day";

/** Stato del time-travel: playhead in epoch ms (null = live, "adesso"). */
export interface PlaybackState {
  playhead: number | null;
  playing: boolean;
  /** Moltiplicatore tempo-dati/tempo-reale (es. 3600 → 1h di dati al secondo). */
  speed: number;
}

/** Modalità AI: il globo mostra il risultato di una query in linguaggio naturale. */
export interface AiMode {
  question: string;
  answer: string;
  total: number;
}

// Store globale leggero (Zustand). SEZIONE 6-8: stato UI del globo + eventi/filtri.
// SEZIONE 12: playback time-travel, feed live SSE, overlay placche, modalità AI.
interface AppState {
  events: Event[];
  filters: Filters;
  autoRotate: boolean; // intento utente: auto-rotazione lenta della camera
  interacting: boolean; // pausa transitoria dell'auto-rotazione (hover/drag/click)
  globeView: GlobeView; // notturno (luci città) vs diurno (Terra reale)
  booting: boolean;
  selectedId: string | null; // evento selezionato (pannello dettaglio + fly-to)
  live: boolean; // feed SSE connesso (badge LIVE)
  showPlates: boolean; // overlay confini di placca tettonica
  playback: PlaybackState;
  aiMode: AiMode | null;

  setEvents: (events: Event[]) => void;
  mergeEvents: (incoming: Event[], cap?: number) => void;
  setFilters: (patch: Partial<Filters>) => void;
  setAutoRotate: (value: boolean) => void;
  toggleAutoRotate: () => void;
  setGlobeView: (view: GlobeView) => void;
  toggleGlobeView: () => void;
  setBooting: (value: boolean) => void;
  select: (id: string | null) => void;
  setLive: (value: boolean) => void;
  togglePlates: () => void;
  setPlayback: (patch: Partial<PlaybackState>) => void;
  stopPlayback: () => void;
  setAiMode: (mode: AiMode | null) => void;
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
  booting: true,
  selectedId: null,
  live: false,
  showPlates: true,
  playback: { playhead: null, playing: false, speed: 3600 },
  aiMode: null,

  setEvents: (events) => set({ events }),
  // Merge del feed live: i nuovi eventi in testa, dedup per id, cap alla stessa
  // dimensione del fetch iniziale (l'ordine resta occurred_at DESC lato render).
  mergeEvents: (incoming, cap = 1000) =>
    set((state) => {
      if (incoming.length === 0) return state;
      const seen = new Set(incoming.map((e) => e.id));
      const merged = [...incoming, ...state.events.filter((e) => !seen.has(e.id))];
      merged.sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at));
      return { events: merged.slice(0, cap) };
    }),
  setFilters: (patch) => set((state) => ({ filters: { ...state.filters, ...patch } })),
  setAutoRotate: (value) => set({ autoRotate: value }),
  toggleAutoRotate: () => set((state) => ({ autoRotate: !state.autoRotate })),
  setGlobeView: (view) => set({ globeView: view }),
  toggleGlobeView: () => set((state) => ({ globeView: state.globeView === "night" ? "day" : "night" })),
  setBooting: (value) => set({ booting: value }),
  select: (id) => set({ selectedId: id }),
  setLive: (value) => set({ live: value }),
  togglePlates: () => set((state) => ({ showPlates: !state.showPlates })),
  setPlayback: (patch) => set((state) => ({ playback: { ...state.playback, ...patch } })),
  stopPlayback: () => set((state) => ({ playback: { ...state.playback, playhead: null, playing: false } })),
  setAiMode: (mode) => set({ aiMode: mode }),

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
