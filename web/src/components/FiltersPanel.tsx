// Event type, minimum magnitude, and rolling time-window filters.
// Writes to shared store state consumed by the 3D layer, ticker, and counters.
// Shared client-side filtering updates the globe, ticker, and counters.

import { SlidersHorizontal } from "lucide-react";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { useLocale, type MessageKey } from "@/components/locale-provider";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { filterEvents } from "@/lib/filters";
import { useStore } from "@/store/useStore";
import type { EventType, TimeWindow } from "@/types";

const TYPE_OPTIONS: { value: EventType | "all"; labelKey: MessageKey }[] = [
  { value: "all", labelKey: "all" },
  { value: "earthquake", labelKey: "earthquakes" },
  { value: "volcano", labelKey: "volcanoes" },
];

const WINDOW_OPTIONS: { value: TimeWindow; label: string; labelKey?: MessageKey }[] = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "", labelKey: "sevenDays" },
  { value: "all", label: "", labelKey: "all" },
];

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </span>
  );
}

export function FiltersPanel() {
  const { t } = useLocale();
  const events = useStore((s) => s.events);
  const filters = useStore((s) => s.filters);
  const setFilters = useStore((s) => s.setFilters);

  const shown = useMemo(() => filterEvents(events, filters).length, [events, filters]);
  const magDisabled = filters.eventType === "volcano";

  return (
    <Card className="glass pointer-events-auto" aria-label={t("filters")}>
      <CardHeader className="flex-row items-center justify-between space-y-0 px-3.5 py-2.5">
        <span className="eyebrow flex items-center gap-1.5 text-foreground/80">
          <SlidersHorizontal className="size-3" /> {t("filters")}
        </span>
        <Badge variant="muted" className="tabular-nums">
          {shown}/{events.length}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-3.5 px-3.5 pb-3.5 pt-0">
        <div className="space-y-1.5">
          <FieldLabel>{t("type")}</FieldLabel>
          <ToggleGroup
            type="single"
            value={filters.eventType}
            onValueChange={(v) => v && setFilters({ eventType: v as EventType | "all" })}
            aria-label={t("type")}
          >
            {TYPE_OPTIONS.map((o) => (
              <ToggleGroupItem key={o.value} value={o.value}>
                {t(o.labelKey)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <FieldLabel>{t("minMagnitude")}</FieldLabel>
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
            aria-label={t("minMagnitude")}
          />
          {magDisabled && (
            <p className="text-[10px] italic text-muted-foreground">
              {t("volcanoMagnitudeNA")}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <FieldLabel>{t("timeWindow")}</FieldLabel>
          <ToggleGroup
            type="single"
            value={filters.timeWindow}
            onValueChange={(v) => v && setFilters({ timeWindow: v as TimeWindow })}
            aria-label={t("timeWindow")}
          >
            {WINDOW_OPTIONS.map((o) => (
              <ToggleGroupItem key={o.value} value={o.value}>
                {o.labelKey ? t(o.labelKey) : o.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </CardContent>
    </Card>
  );
}
