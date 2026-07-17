import {
  Activity,
  BarChart3,
  History,
  Map,
  Menu,
  MousePointer2,
  Rotate3d,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import { AiAssistant } from "@/components/AiAssistant";
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
function TopBar({ menuOpen, onMenuOpen }: { menuOpen: boolean; onMenuOpen: () => void }) {
  const { t } = useLocale();
  return (
    <header
      className="safe-top hud-in pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-2 px-3 pb-3 sm:gap-3 sm:px-4 sm:pb-4"
      style={{ animationDelay: "1150ms" }}
    >
      <div className="glass pointer-events-auto flex min-w-0 items-center gap-1.5 rounded-2xl p-1.5 md:gap-3 md:rounded-xl md:px-3.5 md:py-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 rounded-xl md:hidden"
          onClick={onMenuOpen}
          aria-label={menuOpen ? t("closePanel") : t("openMenu")}
          aria-expanded={menuOpen}
          aria-controls="mobile-app-menu"
        >
          <Menu className="size-5" />
        </Button>

        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-inset ring-primary/25">
          <Activity className="size-4" />
        </div>
        <div className="flex min-w-0 flex-col leading-none">
          <span className="truncate text-sm font-semibold tracking-tight">DataPulse</span>
          <span className="mt-0.5 hidden text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground md:block">
            Geo-Tectonic Monitor
          </span>
        </div>
      </div>

      <div className="glass pointer-events-auto flex shrink-0 items-center gap-1 rounded-2xl px-1.5 py-1.5 md:gap-2.5 md:rounded-xl md:px-2.5">
        <DataStatus />
        <Separator orientation="vertical" className="hidden h-5 md:block" />
        <div className="hidden md:block"><LanguageToggle /></div>
        <Separator orientation="vertical" className="hidden h-5 md:block" />
        <div className="hidden md:block"><ModeToggle /></div>
      </div>
    </header>
  );
}

type MobilePanel = "overview" | "filters";

/** Compact mobile navigation keeps the globe usable while preserving every HUD tool. */
function MobileHud({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const [active, setActive] = useState<MobilePanel>("overview");
  const tabs = [
    { id: "overview" as const, label: t("overview"), icon: BarChart3 },
    { id: "filters" as const, label: t("filters"), icon: SlidersHorizontal },
  ];

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="mobile-drawer-backdrop pointer-events-auto absolute inset-0 z-40 md:hidden">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-background/45 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label={t("closePanel")}
      />

      <aside
        id="mobile-app-menu"
        className="mobile-drawer safe-top safe-bottom absolute inset-y-0 left-0 flex w-[min(88vw,360px)] flex-col px-3"
        role="dialog"
        aria-modal="true"
        aria-label={t("controlCenter")}
      >
        <div className="flex items-center gap-3 border-b border-border/60 pb-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-inset ring-primary/25">
            <Activity className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-tight">DataPulse</div>
            <div className="eyebrow mt-1">{t("controlCenter")}</div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ml-auto size-10 rounded-xl"
            onClick={onClose}
            aria-label={t("closePanel")}
          >
            <X className="size-5" />
          </Button>
        </div>

      <nav
        className="grid grid-cols-2 gap-1 py-3"
        aria-label={t("mobileTools")}
      >
        {tabs.map(({ id, label, icon: Icon }) => {
          const selected = active === id;
          return (
            <Button
              key={id}
              type="button"
              variant="ghost"
              className={cn(
                "h-14 flex-col gap-1 rounded-xl px-2 text-[10px]",
                selected && "bg-primary/15 text-primary hover:bg-primary/20",
              )}
              onClick={() => setActive(id)}
              aria-pressed={selected}
              aria-controls="mobile-hud-panel"
            >
              <Icon className="size-4" />
              {label}
            </Button>
          );
        })}
      </nav>

        <div
          id="mobile-hud-panel"
          className="mobile-hud-panel flex-1 overflow-y-auto overscroll-contain pb-3"
          aria-label={active === "filters" ? t("filters") : t("overview")}
        >
          <div className="space-y-3">
            {active === "overview" && (
              <>
                <StatsPanel />
                <SystemStatus />
              </>
            )}
            {active === "filters" && <FiltersPanel />}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-3">
          <span className="eyebrow">{t("preferences")}</span>
          <div className="flex items-center gap-1.5">
            <LanguageToggle />
            <ModeToggle />
          </div>
        </div>
      </aside>
    </div>
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
      className="safe-bottom hud-in pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col gap-2 px-3 pt-3 sm:p-4"
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

        <div className="glass pointer-events-auto mx-auto flex items-center gap-1 rounded-2xl p-1 sm:ml-auto sm:mr-0 sm:gap-1.5 sm:rounded-lg sm:p-1.5">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-11 min-w-[62px] flex-col gap-0.5 rounded-xl px-2 text-[9px] sm:h-7 sm:min-w-0 sm:flex-row sm:gap-1.5 sm:rounded-md sm:px-2.5 sm:text-xs",
              playbackActive && "bg-warning/15 text-warning hover:bg-warning/20",
            )}
            onClick={toggleReplay}
            disabled={events.length === 0}
            aria-label={t("replay")}
          >
            <History className="size-3.5" />
            <span>{t("replay")}</span>
          </Button>
          <Separator orientation="vertical" className="hidden h-4 sm:block" />
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-11 min-w-[62px] flex-col gap-0.5 rounded-xl px-2 text-[9px] sm:h-7 sm:min-w-0 sm:flex-row sm:gap-1.5 sm:rounded-md sm:px-2.5 sm:text-xs",
              showPlates && "bg-primary/15 text-primary hover:bg-primary/20",
            )}
            onClick={togglePlates}
            aria-label={t("plates")}
          >
            <Map className="size-3.5" />
            <span>{t("plates")}</span>
          </Button>
          <Separator orientation="vertical" className="hidden h-4 sm:block" />
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-11 min-w-[62px] flex-col gap-0.5 rounded-xl px-2 text-[9px] sm:h-7 sm:min-w-0 sm:flex-row sm:gap-1.5 sm:rounded-md sm:px-2.5 sm:text-xs",
              autoRotate && "bg-primary/15 text-primary hover:bg-primary/20",
            )}
            onClick={toggleAutoRotate}
            aria-label={`Auto-rotate ${autoRotate ? "on" : "off"}`}
          >
            <Rotate3d className="size-3.5" />
            <span className="sm:hidden">Auto</span>
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const daytime = resolvedTheme === "light";
  // Theme is the single source of truth for UI, background, and globe lighting.
  return (
    <div className={cn("app-shell relative h-[100dvh] w-screen overflow-hidden", resolvedTheme === "light" && "day-mode")}>
      <Scene daytime={daytime} />

      <TopBar menuOpen={mobileMenuOpen} onMenuOpen={() => setMobileMenuOpen(true)} />
      <MobileHud open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <AiAssistant />

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
