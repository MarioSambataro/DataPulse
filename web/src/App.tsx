import { Activity, History, Map, MousePointer2, Rotate3d } from "lucide-react";

import { AiConsole } from "@/components/AiConsole";
import { DetailPanel } from "@/components/DetailPanel";
import { EventTicker } from "@/components/EventTicker";
import { FiltersPanel } from "@/components/FiltersPanel";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLocale } from "@/components/locale-provider";
import { ModeToggle } from "@/components/ModeToggle";
import { useTheme } from "@/components/theme-provider";
import { SplashScreen } from "@/components/SplashScreen";
import { StatsPanel } from "@/components/StatsPanel";
import { SystemStatus } from "@/components/SystemStatus";
import { TimeBar } from "@/components/TimeBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useDeepLink } from "@/hooks/useDeepLink";
import { useEventsLoader } from "@/hooks/useEventsLoader";
import { eventsTimeRange } from "@/lib/timeline";
import { cn } from "@/lib/utils";
import { Scene } from "@/three/Scene";
import { useStore } from "@/store/useStore";

/** Indicatore di stato del feed eventi (GET /events + stream SSE). */
function DataStatus() {
  const { status, error, count } = useEventsLoader();
  const live = useStore((s) => s.live);
  const { t, numberLocale } = useLocale();

  if (status === "loading") {
    return (
      <Badge variant="muted" className="gap-1.5 py-1">
        <span className="size-1.5 animate-pulse-dot rounded-full bg-muted-foreground" />
        {t("syncing")}
      </Badge>
    );
  }
  if (status === "error") {
    return (
      <Badge variant="destructive" className="gap-1.5 py-1" title={error ?? undefined}>
        <span className="size-1.5 rounded-full bg-destructive" />
        {t("feedOffline")}
      </Badge>
    );
  }
  return (
    <Badge variant="default" className="gap-1.5 py-1" title={live ? t("liveConnected") : undefined}>
      <span className="size-1.5 animate-pulse-dot rounded-full bg-primary" />
      {live && <span className="font-semibold tracking-wide">LIVE ·</span>}
      {count.toLocaleString(numberLocale)} {t("events")}
    </Badge>
  );
}

/** Barra superiore: brand + stato feed + switch tema. */
function TopBar() {
  return (
    <header
      className="hud-in pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 p-3 sm:p-4"
      style={{ animationDelay: "1150ms" }}
    >
      <div className="glass pointer-events-auto flex items-center gap-3 rounded-xl px-3.5 py-2">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-inset ring-primary/25">
          <Activity className="size-4" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-sm font-semibold tracking-tight">DataPulse</span>
          <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Geo-Tectonic Monitor
          </span>
        </div>
      </div>

      <div className="glass pointer-events-auto flex items-center gap-2.5 rounded-xl px-2.5 py-1.5">
        <DataStatus />
        <Separator orientation="vertical" className="h-5" />
        <LanguageToggle />
        <Separator orientation="vertical" className="h-5" />
        <ModeToggle />
      </div>
    </header>
  );
}

/** Controlli vista globo (replay, placche, giorno/notte, auto-rotazione). */
function GlobeControls() {
  const { t } = useLocale();
  const autoRotate = useStore((s) => s.autoRotate);
  const toggleAutoRotate = useStore((s) => s.toggleAutoRotate);
  const showPlates = useStore((s) => s.showPlates);
  const togglePlates = useStore((s) => s.togglePlates);
  const events = useStore((s) => s.events);
  const playbackActive = useStore((s) => s.playback.playhead != null);
  const setPlayback = useStore((s) => s.setPlayback);
  const stopPlayback = useStore((s) => s.stopPlayback);

  const toggleReplay = () => {
    if (playbackActive) {
      stopPlayback();
      return;
    }
    const range = eventsTimeRange(events);
    if (!range) return;
    // Il replay parte dall'evento più vecchio caricato e scorre verso il presente.
    setPlayback({ playhead: range.min, playing: true });
  };

  return (
    <div
      className="hud-in pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col gap-2 p-3 sm:p-4"
      style={{ animationDelay: "1600ms" }}
    >
      <div className="flex items-end justify-between gap-3">
        <div className="glass pointer-events-auto hidden items-center gap-3 rounded-lg px-3 py-1.5 text-[11px] text-muted-foreground sm:flex">
          <span className="inline-flex items-center gap-1.5">
            <MousePointer2 className="size-3" /> {t("dragRotate")}
          </span>
          <Separator orientation="vertical" className="h-3.5" />
          <span>{t("scrollZoom")}</span>
        </div>

        <div className="glass pointer-events-auto ml-auto flex items-center gap-1.5 rounded-lg p-1.5">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 gap-1.5 px-2.5",
              playbackActive && "bg-warning/15 text-warning hover:bg-warning/20",
            )}
            onClick={toggleReplay}
            disabled={events.length === 0}
          >
            <History className="size-3.5" />
            {t("replay")}
          </Button>
          <Separator orientation="vertical" className="h-4" />
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 gap-1.5 px-2.5",
              showPlates && "bg-primary/15 text-primary hover:bg-primary/20",
            )}
            onClick={togglePlates}
          >
            <Map className="size-3.5" />
            {t("plates")}
          </Button>
          <Separator orientation="vertical" className="h-4" />
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 gap-1.5 px-2.5",
              autoRotate && "bg-primary/15 text-primary hover:bg-primary/20",
            )}
            onClick={toggleAutoRotate}
          >
            <Rotate3d className="size-3.5" />
            Auto-rotate {autoRotate ? "on" : "off"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  // Deep-linking ?event=<id>: selezione da URL all'avvio, URL aggiornato alla selezione.
  useDeepLink();
  const { resolvedTheme } = useTheme();
  const daytime = resolvedTheme === "light";
  // Il tema e l'unica sorgente di verita: UI, sfondo e globo non possono divergere.
  return (
    <div className={cn("app-shell relative h-screen w-screen overflow-hidden", resolvedTheme === "light" && "day-mode")}>
      <Scene daytime={daytime} />

      <TopBar />

      {/* Console AI a sinistra: query in linguaggio naturale + SITREP generato. */}
      <aside
        className="hud-in pointer-events-none absolute left-3 top-20 z-20 hidden w-[280px] max-w-[82vw] flex-col gap-3 sm:left-4 md:flex"
        style={{ animationDelay: "1450ms" }}
      >
        <AiConsole />
      </aside>

      {/* Console laterale: statistiche 24h + filtri + stato sistema. */}
      <aside
        className="hud-in pointer-events-none absolute right-3 top-20 z-20 flex w-[264px] max-w-[82vw] flex-col gap-3 sm:right-4"
        style={{ animationDelay: "1350ms" }}
      >
        <StatsPanel />
        <FiltersPanel />
        <SystemStatus />
      </aside>

      <DetailPanel />
      <EventTicker />
      <TimeBar />
      <GlobeControls />

      {/* Splash di avvio: copre il caricamento e svanisce sul dolly-in. */}
      <SplashScreen />
    </div>
  );
}
