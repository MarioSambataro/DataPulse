import {
  Activity,
  BarChart3,
  History,
  Map,
  MousePointer2,
  Rotate3d,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { useState } from "react";

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

/** Event feed status for REST loading and SSE connectivity. */
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
      {live && <span className="hidden font-semibold tracking-wide sm:inline">LIVE ·</span>}
      <span className="tabular-nums">{count.toLocaleString(numberLocale)}</span>
      <span className="hidden sm:inline">{t("events")}</span>
    </Badge>
  );
}

/** Top bar with brand, feed state, and theme control. */
function TopBar() {
  return (
    <header
      className="safe-top hud-in pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-2 px-3 pb-3 sm:gap-3 sm:px-4 sm:pb-4"
      style={{ animationDelay: "1150ms" }}
    >
      <div className="glass pointer-events-auto flex min-w-0 items-center gap-2 rounded-xl px-2.5 py-2 sm:gap-3 sm:px-3.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-inset ring-primary/25">
          <Activity className="size-4" />
        </div>
        <div className="flex min-w-0 flex-col leading-none">
          <span className="text-sm font-semibold tracking-tight">DataPulse</span>
          <span className="mt-0.5 hidden text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground min-[430px]:block">
            Geo-Tectonic Monitor
          </span>
        </div>
      </div>

      <div className="glass pointer-events-auto flex shrink-0 items-center gap-1 rounded-xl px-1.5 py-1.5 sm:gap-2.5 sm:px-2.5">
        <DataStatus />
        <Separator orientation="vertical" className="hidden h-5 sm:block" />
        <LanguageToggle />
        <Separator orientation="vertical" className="hidden h-5 sm:block" />
        <ModeToggle />
      </div>
    </header>
  );
}

type MobilePanel = "overview" | "filters" | "ai" | null;

/** Compact mobile navigation keeps the globe usable while preserving every HUD tool. */
function MobileHud({
  active,
  onChange,
}: {
  active: MobilePanel;
  onChange: (panel: MobilePanel) => void;
}) {
  const { t } = useLocale();
  const tabs = [
    { id: "overview" as const, label: t("overview"), icon: BarChart3 },
    { id: "filters" as const, label: t("filters"), icon: SlidersHorizontal },
    { id: "ai" as const, label: "AI", icon: Sparkles },
  ];

  return (
    <>
      <nav
        className="hud-in pointer-events-none absolute left-3 top-[76px] z-30 flex md:hidden"
        style={{ animationDelay: "1350ms" }}
        aria-label={t("mobileTools")}
      >
        <div className="glass pointer-events-auto flex items-center gap-1 rounded-xl p-1">
          {tabs.map(({ id, label, icon: Icon }) => {
            const selected = active === id;
            return (
              <Button
                key={id}
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "h-9 gap-1.5 px-2.5 text-[11px]",
                  selected && "bg-primary/15 text-primary hover:bg-primary/20",
                )}
                onClick={() => onChange(selected ? null : id)}
                aria-expanded={selected}
                aria-controls="mobile-hud-panel"
              >
                <Icon className="size-3.5" />
                {label}
              </Button>
            );
          })}
        </div>
      </nav>

      {active && (
        <aside
          id="mobile-hud-panel"
          className="mobile-hud-panel hud-in pointer-events-auto absolute inset-x-3 bottom-[126px] top-[124px] z-30 overflow-y-auto overscroll-contain rounded-xl md:hidden"
          style={{ animationDelay: "0ms" }}
          aria-label={active === "filters" ? t("filters") : active === "ai" ? "AI Console" : t("overview")}
        >
          <div className="mb-2 flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="glass size-9"
              onClick={() => onChange(null)}
              aria-label={t("closePanel")}
            >
              <X className="size-4" />
            </Button>
          </div>

          <div className="space-y-3">
            {active === "overview" && (
              <>
                <StatsPanel />
                <SystemStatus />
              </>
            )}
            {active === "filters" && <FiltersPanel />}
            {active === "ai" && <AiConsole />}
          </div>
        </aside>
      )}
    </>
  );
}

/** Globe controls for replay, plates, day/night mode, and rotation. */
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
    // Replay begins at the oldest loaded event and advances toward the present.
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

        <div className="glass pointer-events-auto ml-auto flex items-center gap-1 rounded-xl p-1 sm:gap-1.5 sm:rounded-lg sm:p-1.5">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "size-10 gap-1.5 px-0 sm:h-7 sm:w-auto sm:px-2.5",
              playbackActive && "bg-warning/15 text-warning hover:bg-warning/20",
            )}
            onClick={toggleReplay}
            disabled={events.length === 0}
            aria-label={t("replay")}
          >
            <History className="size-3.5" />
            <span className="hidden sm:inline">{t("replay")}</span>
          </Button>
          <Separator orientation="vertical" className="hidden h-4 sm:block" />
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "size-10 gap-1.5 px-0 sm:h-7 sm:w-auto sm:px-2.5",
              showPlates && "bg-primary/15 text-primary hover:bg-primary/20",
            )}
            onClick={togglePlates}
            aria-label={t("plates")}
          >
            <Map className="size-3.5" />
            <span className="hidden sm:inline">{t("plates")}</span>
          </Button>
          <Separator orientation="vertical" className="hidden h-4 sm:block" />
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "size-10 gap-1.5 px-0 sm:h-7 sm:w-auto sm:px-2.5",
              autoRotate && "bg-primary/15 text-primary hover:bg-primary/20",
            )}
            onClick={toggleAutoRotate}
            aria-label={`Auto-rotate ${autoRotate ? "on" : "off"}`}
          >
            <Rotate3d className="size-3.5" />
            <span className="hidden sm:inline">Auto-rotate {autoRotate ? "on" : "off"}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  // Synchronize initial and current selections with ?event=<id>.
  useDeepLink();
  const { resolvedTheme } = useTheme();
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(null);
  const daytime = resolvedTheme === "light";
  // Theme is the single source of truth for UI, background, and globe lighting.
  return (
    <div className={cn("app-shell relative h-[100dvh] w-screen overflow-hidden", resolvedTheme === "light" && "day-mode")}>
      <Scene daytime={daytime} />

      <TopBar />
      <MobileHud active={mobilePanel} onChange={setMobilePanel} />

      {/* Console AI a sinistra: query in linguaggio naturale + SITREP generato. */}
      <aside
        className="hud-in pointer-events-none absolute left-3 top-20 z-20 hidden w-[280px] max-w-[82vw] flex-col gap-3 sm:left-4 md:flex"
        style={{ animationDelay: "1450ms" }}
      >
        <AiConsole />
      </aside>

      {/* Side console with rolling statistics, filters, and system status. */}
      <aside
        className="hud-in pointer-events-none absolute right-3 top-20 z-20 hidden w-[264px] max-w-[82vw] flex-col gap-3 sm:right-4 md:flex"
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

      {/* Startup splash covers loading and fades during the camera dolly. */}
      <SplashScreen />
    </div>
  );
}
