import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Locale = "it" | "en";

const messages = {
  it: {
    syncing: "Sincronizzazione…",
    feedOffline: "Feed offline",
    liveConnected: "Feed live SSE connesso",
    events: "eventi",
    switchDay: "Passa alla modalità giorno",
    switchNight: "Passa alla modalità notte",
    toDay: "Passa a giorno",
    toNight: "Passa a notte",
    dragRotate: "Trascina · ruota",
    scrollZoom: "Scroll · zoom",
    replay: "Replay",
    plates: "Placche",
    filters: "Filtri",
    overview: "Dati",
    mobileTools: "Strumenti dashboard",
    closePanel: "Chiudi pannello",
    openMenu: "Apri menu",
    controlCenter: "Control Center",
    preferences: "Preferenze",
    type: "Tipo",
    all: "Tutti",
    earthquakes: "Sismici",
    volcanoes: "Vulcani",
    minMagnitude: "Magnitudo min",
    volcanoMagnitudeNA: "n/d · i vulcani non hanno magnitudo",
    timeWindow: "Finestra",
    system: "Sistema",
    database: "Database",
    lastIngestion: "Ultima ingestione",
    latencyUptime: "Latenza · uptime",
    error: "errore",
    notAvailable: "n/d",
    offline: "Offline",
    derived: "Derivato",
    statsUnavailable: "Statistiche non disponibili",
    stats24: "Statistiche 24 ore",
    sevenDays: "7g",
    earthquakes24: "Sismici 24h",
    maxMag24: "Mag max 24h",
    events7d: "Eventi 7g",
    volcanoes7d: "Vulcani 7g",
    aiNotConfigured: "AI non configurata sul backend (manca DEEPSEEK_API_KEY).",
    aiAssistant: "DataPulse AI",
    aiOnline: "Online · dati live",
    openAiAssistant: "Apri DataPulse AI",
    closeAiAssistant: "Chiudi DataPulse AI",
    newAiChat: "Nuova conversazione AI",
    aiGreeting: "Ciao! Posso analizzare gli eventi e applicare i risultati direttamente al globo.",
    aiPromptSummary: "Riassumi ultime 24h",
    aiPromptStrongest: "Eventi più rilevanti",
    aiPromptVolcanoes: "Attività vulcanica recente",
    aiChatPlaceholder: "Chiedi a DataPulse…",
    aiDemoReply: "Questa è una risposta dimostrativa. Nel sito live userò i dati reali del globo.",
    aiPlaceholder: 'es. "terremoti M≥5 vicino al Giappone"',
    naturalLanguageQuestion: "Domanda in linguaggio naturale",
    sendQuestion: "Invia domanda",
    querying: "Interrogo i dati…",
    queryFailed: "Query fallita: riprova.",
    results: "risultati",
    briefingUnavailable: "Briefing non disponibile.",
    generating: "Genero…",
    refresh: "Aggiorna",
    generate: "Genera",
    seismicEvent: "Evento sismico",
    volcanicActivity: "Attività vulcanica",
    close: "Chiudi",
    magnitude: "Magnitudo",
    depth: "Profondità",
    place: "Luogo",
    timeUtc: "Ora UTC",
    pause: "Pausa",
    play: "Riproduci",
    playbackSpeed: "Velocità di riproduzione",
    eventTimeline: "Timeline eventi",
    backLive: "Torna al live",
    noEvents: "Nessun evento in vista",
    now: "adesso",
    quake: "Sisma",
    volcano: "Vulcano",
    buildingLayers: "Costruzione dei layer geotettonici…",
  },
  en: {
    syncing: "Synchronizing…",
    feedOffline: "Feed offline",
    liveConnected: "Live SSE feed connected",
    events: "events",
    switchDay: "Switch to day mode",
    switchNight: "Switch to night mode",
    toDay: "Day mode",
    toNight: "Night mode",
    dragRotate: "Drag · rotate",
    scrollZoom: "Scroll · zoom",
    replay: "Replay",
    plates: "Plates",
    filters: "Filters",
    overview: "Overview",
    mobileTools: "Dashboard tools",
    closePanel: "Close panel",
    openMenu: "Open menu",
    controlCenter: "Control Center",
    preferences: "Preferences",
    type: "Type",
    all: "All",
    earthquakes: "Seismic",
    volcanoes: "Volcanic",
    minMagnitude: "Min magnitude",
    volcanoMagnitudeNA: "n/a · volcanoes have no magnitude",
    timeWindow: "Window",
    system: "System",
    database: "Database",
    lastIngestion: "Last ingestion",
    latencyUptime: "Latency · uptime",
    error: "error",
    notAvailable: "n/a",
    offline: "Offline",
    derived: "Derived",
    statsUnavailable: "Statistics unavailable",
    stats24: "24-hour statistics",
    sevenDays: "7d",
    earthquakes24: "Seismic 24h",
    maxMag24: "Max mag 24h",
    events7d: "Events 7d",
    volcanoes7d: "Volcanoes 7d",
    aiNotConfigured: "AI is not configured on the backend (DEEPSEEK_API_KEY is missing).",
    aiAssistant: "DataPulse AI",
    aiOnline: "Online · live data",
    openAiAssistant: "Open DataPulse AI",
    closeAiAssistant: "Close DataPulse AI",
    newAiChat: "New AI conversation",
    aiGreeting: "Hi! I can analyze events and apply the results directly to the globe.",
    aiPromptSummary: "Summarize the last 24h",
    aiPromptStrongest: "Most relevant events",
    aiPromptVolcanoes: "Recent volcanic activity",
    aiChatPlaceholder: "Ask DataPulse…",
    aiDemoReply: "This is a demo response. On the live site I will use real globe data.",
    aiPlaceholder: 'e.g. "M≥5 earthquakes near Japan"',
    naturalLanguageQuestion: "Natural-language question",
    sendQuestion: "Send question",
    querying: "Querying the data…",
    queryFailed: "Query failed. Try again.",
    results: "results",
    briefingUnavailable: "Briefing unavailable.",
    generating: "Generating…",
    refresh: "Refresh",
    generate: "Generate",
    seismicEvent: "Seismic event",
    volcanicActivity: "Volcanic activity",
    close: "Close",
    magnitude: "Magnitude",
    depth: "Depth",
    place: "Location",
    timeUtc: "UTC time",
    pause: "Pause",
    play: "Play",
    playbackSpeed: "Playback speed",
    eventTimeline: "Event timeline",
    backLive: "Return to live",
    noEvents: "No events in view",
    now: "now",
    quake: "Earthquake",
    volcano: "Volcano",
    buildingLayers: "Building geotectonic layers…",
  },
} as const;

export type MessageKey = keyof (typeof messages)["it"];

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: (key: MessageKey) => string;
  numberLocale: string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);
const STORAGE_KEY = "datapulse-locale";

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() =>
    window.localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "it",
  );

  const setLocale = (next: Locale) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    setLocaleState(next);
  };

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      toggleLocale: () => setLocale(locale === "it" ? "en" : "it"),
      t: (key) => messages[locale][key],
      numberLocale: locale === "it" ? "it-IT" : "en-US",
    }),
    [locale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used inside LocaleProvider");
  return context;
}
