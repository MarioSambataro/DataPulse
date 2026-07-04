// Pannello SITREP: statistiche 24h/7g da GET /stats (o derivate in mock/offline).
// Card shadcn con griglia KPI 2×2. Gestisce loading/errore.

import { Activity, Gauge, Layers, Mountain } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useStatsLoader } from "@/hooks/useStatsLoader";
import { cn } from "@/lib/utils";

function Metric({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="size-3" />
        <span className="text-[10px] font-medium uppercase tracking-[0.12em]">{label}</span>
      </div>
      <div
        className={cn(
          "mt-1.5 font-mono text-2xl font-semibold leading-none tabular-nums",
          accent ? "text-warning" : "text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function StatsPanel() {
  const { stats, status, source } = useStatsLoader();

  let tag: { text: string; variant: "muted" | "warning" } | null = null;
  if (source === "derived") {
    tag =
      status === "error"
        ? { text: "Offline", variant: "warning" }
        : { text: "Derivato", variant: "muted" };
  }

  return (
    <Card className="glass pointer-events-auto gap-0 py-0" aria-label="Statistiche 24 ore">
      <CardHeader className="flex-row items-center justify-between space-y-0 px-3.5 py-2.5">
        <span className="eyebrow text-foreground/80">SITREP · 24h</span>
        {tag && <Badge variant={tag.variant}>{tag.text}</Badge>}
      </CardHeader>

      <CardContent className="px-3.5 pb-3.5 pt-0">
        {status === "loading" ? (
          <div className="grid grid-cols-2 gap-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[68px] animate-pulse rounded-lg bg-muted/40" />
            ))}
          </div>
        ) : status === "error" && !stats ? (
          <p className="py-3 text-center text-xs text-warning">Statistiche non disponibili</p>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            <Metric
              icon={Activity}
              label="Sismici 24h"
              value={String(stats?.earthquakes_24h ?? 0)}
            />
            <Metric
              icon={Gauge}
              label="Mag max 24h"
              value={stats?.max_magnitude_24h != null ? stats.max_magnitude_24h.toFixed(1) : "—"}
              accent
            />
            <Metric icon={Layers} label="Eventi 7g" value={String(stats?.events_7d ?? 0)} />
            <Metric
              icon={Mountain}
              label="Vulcani 7g"
              value={String(stats?.active_volcanoes_7d ?? 0)}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
