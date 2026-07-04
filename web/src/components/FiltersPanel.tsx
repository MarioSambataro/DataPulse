// Pannello filtri: tipo evento, magnitudo minima (slider), finestra temporale.
// Scrive nello store (setFilters) → il layer 3D, il ticker e i contatori si
// aggiornano da soli (filtro client-side condiviso, lib/filters.filterEvents).

import { SlidersHorizontal } from "lucide-react";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { filterEvents } from "@/lib/filters";
import { useStore } from "@/store/useStore";
import type { EventType, TimeWindow } from "@/types";

const TYPE_OPTIONS: { value: EventType | "all"; label: string }[] = [
  { value: "all", label: "Tutti" },
  { value: "earthquake", label: "Sismici" },
  { value: "volcano", label: "Vulcani" },
];

const WINDOW_OPTIONS: { value: TimeWindow; label: string }[] = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7g" },
  { value: "all", label: "Tutto" },
];

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </span>
  );
}

export function FiltersPanel() {
  const events = useStore((s) => s.events);
  const filters = useStore((s) => s.filters);
  const setFilters = useStore((s) => s.setFilters);

  const shown = useMemo(() => filterEvents(events, filters).length, [events, filters]);
  const magDisabled = filters.eventType === "volcano";

  return (
    <Card className="glass pointer-events-auto" aria-label="Filtri">
      <CardHeader className="flex-row items-center justify-between space-y-0 px-3.5 py-2.5">
        <span className="eyebrow flex items-center gap-1.5 text-foreground/80">
          <SlidersHorizontal className="size-3" /> Filtri
        </span>
        <Badge variant="muted" className="tabular-nums">
          {shown}/{events.length}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-3.5 px-3.5 pb-3.5 pt-0">
        <div className="space-y-1.5">
          <FieldLabel>Tipo</FieldLabel>
          <ToggleGroup
            type="single"
            value={filters.eventType}
            onValueChange={(v) => v && setFilters({ eventType: v as EventType | "all" })}
            aria-label="Tipo evento"
          >
            {TYPE_OPTIONS.map((o) => (
              <ToggleGroupItem key={o.value} value={o.value}>
                {o.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <FieldLabel>Magnitudo min</FieldLabel>
            <span
              className={
                magDisabled
                  ? "font-mono text-sm font-semibold text-muted-foreground"
                  : "font-mono text-sm font-semibold text-primary"
              }
            >
              {filters.minMagnitude.toFixed(1)}
            </span>
          </div>
          <Slider
            min={0}
            max={8}
            step={0.5}
            value={[filters.minMagnitude]}
            disabled={magDisabled}
            onValueChange={([v]) => setFilters({ minMagnitude: v })}
            aria-label="Magnitudo minima"
          />
          {magDisabled && (
            <p className="text-[10px] italic text-muted-foreground">
              n/d · i vulcani non hanno magnitudo
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <FieldLabel>Finestra</FieldLabel>
          <ToggleGroup
            type="single"
            value={filters.timeWindow}
            onValueChange={(v) => v && setFilters({ timeWindow: v as TimeWindow })}
            aria-label="Finestra temporale"
          >
            {WINDOW_OPTIONS.map((o) => (
              <ToggleGroupItem key={o.value} value={o.value}>
                {o.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </CardContent>
    </Card>
  );
}
