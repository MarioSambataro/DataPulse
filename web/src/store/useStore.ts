import { create } from "zustand";

import type { Event, Filters } from "../types";

/** Earth surface display mode. */
export type GlobeView = "night" | "day";

/** Replay state; a null playhead means live current time. */
export interface PlaybackState {
  playhead: number | null;
  playing: boolean;
  /** Data-time to real-time multiplier. */
  speed: number;
}

/** AI mode showing the result of one natural-language query. */
export interface AiMode {
  question: string;
  answer: string;
  total: number;
}

// Lightweight Zustand store for globe state, events, filters, replay, and AI mode.
interface AppState {
  events: Event[];
  filters: Filters;
  autoRotate: boolean; // User preference for slow camera rotation.
  interacting: boolean; // Temporary pause during hover, drag, or click.
  globeView: GlobeView; // Night city lights or daylight Earth.
  booting: boolean;
  selectedId: string | null; // Selected event for details and cinematic fly-to.
  live: boolean; // SSE connection state shown by the live badge.
  showPlates: boolean; // Tectonic plate boundary overlay.
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
  pauseRotation: () => void; // Pause rotation during interaction.
  resumeRotationAfter: (ms: number) => void; // Resume after an inactivity delay.
}

// Module-level client timer keeps transient scheduling outside persistent state.
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
  // Prepend live rows, deduplicate IDs, and retain the initial rendering cap.
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
