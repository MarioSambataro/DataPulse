import { Activity, MousePointer2, Rotate3d, Sunrise } from "lucide-react";

import { DetailPanel } from "@/components/DetailPanel";
import { EventTicker } from "@/components/EventTicker";
import { FiltersPanel } from "@/components/FiltersPanel";
import { ModeToggle } from "@/components/ModeToggle";
import { StatsPanel } from "@/components/StatsPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useEventsLoader } from "@/hooks/useEventsLoader";
import { cn } from "@/lib/utils";
import { Scene } from "@/three/Scene";
import { useStore } from "@/store/useStore";

/** Indicatore di stato del feed eventi (GET /events). */
function DataStatus() {
  const { status, error, count } = useEventsLoader();

  if (status === "loading") {
    return (
      <Badge variant="muted" className="gap-1.5 py-1">
        <span className="size-1.5 animate-pulse-dot rounded-full bg-muted-foreground" />
        Sincronizzazione…
      </Badge>
    );
  }
  if (status === "error") {
    return (
      <Badge variant="destructive" className="gap-1.5 py-1" title={error ?? undefined}>
        <span className="size-1.5 rounded-full bg-destructive" />
        Feed offline
      </Badge>
    );
  }
  return (
    <Badge variant="default" className="gap-1.5 py-1">
      <span className="size-1.5 animate-pulse-dot rounded-full bg-primary" />
      {count.toLocaleString("it-IT")} eventi
    </Badge>
  );
}

/** Barra superiore: brand + stato feed + switch tema. */
function TopBar() {
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 p-3 sm:p-4">
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
        <ModeToggle />
      </div>
    </header>
  );
}

/** Controlli vista globo (giorno/notte, auto-rotazione) in basso a destra. */
function GlobeControls() {
  const autoRotate = useStore((s) => s.autoRotate);
  const toggleAutoRotate = useStore((s) => s.toggleAutoRotate);
  const globeView = useStore((s) => s.globeView);
  const toggleGlobeView = useStore((s) => s.toggleGlobeView);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col gap-2 p-3 sm:p-4">
      <div className="flex items-end justify-between gap-3">
        <div className="glass pointer-events-auto hidden items-center gap-3 rounded-lg px-3 py-1.5 text-[11px] text-muted-foreground sm:flex">
          <span className="inline-flex items-center gap-1.5">
            <MousePointer2 className="size-3" /> Trascina · ruota
          </span>
          <Separator orientation="vertical" className="h-3.5" />
          <span>Scroll · zoom</span>
        </div>

        <div className="glass pointer-events-auto ml-auto flex items-center gap-1.5 rounded-lg p-1.5">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 gap-1.5 px-2.5",
              globeView === "day" && "bg-primary/15 text-primary hover:bg-primary/20",
            )}
            onClick={toggleGlobeView}
          >
            <Sunrise className="size-3.5" />
            {globeView === "day" ? "Giorno" : "Notte"}
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
  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <Scene />

      {/* Vignette morbida per staccare l'UI dal globo. */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            "radial-gradient(120% 120% at 50% 42%, transparent 58%, hsl(var(--background) / 0.5) 100%)",
        }}
      />

      <TopBar />

      {/* Console laterale: statistiche 24h + filtri. */}
      <aside className="pointer-events-none absolute right-3 top-20 z-20 flex w-[264px] max-w-[82vw] flex-col gap-3 sm:right-4">
        <StatsPanel />
        <FiltersPanel />
      </aside>

      <DetailPanel />
      <EventTicker />
      <GlobeControls />
    </div>
  );
}
