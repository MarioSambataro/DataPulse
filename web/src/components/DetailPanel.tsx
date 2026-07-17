// DOM detail panel for the selected globe event, closed by its button or Escape.

import { Activity, Mountain, X } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLocale } from "@/components/locale-provider";
import { severityCss } from "@/lib/severity";
import { useStore } from "@/store/useStore";

function formatTime(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

/** Riga chiave-valore: etichetta tecnica a sinistra, valore mono a destra. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="eyebrow shrink-0">{label}</dt>
      <dd className="text-right font-mono text-xs text-foreground">{children}</dd>
    </div>
  );
}

export function DetailPanel() {
  const { t, numberLocale } = useLocale();
  const selectedId = useStore((s) => s.selectedId);
  const events = useStore((s) => s.events);
  const select = useStore((s) => s.select);

  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") select(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, select]);

  if (!selectedId) return null;
  const event = events.find((e) => e.id === selectedId);
  if (!event) return null;

  const isQuake = event.event_type === "earthquake";
  const sev = severityCss(event.severity);
  const TypeIcon = isQuake ? Activity : Mountain;

  return (
    <Card
      className="glass pointer-events-auto absolute bottom-[122px] left-3 right-3 z-30 w-auto max-w-none overflow-hidden p-0 sm:bottom-24 sm:left-4 sm:right-auto sm:w-[300px] sm:max-w-[82vw]"
      aria-live="polite"
    >
      {/* Event type, severity, and close control. */}
      <div className="flex items-center justify-between border-b border-border/60 px-3.5 py-2">
        <span className="flex items-center gap-2">
          <span
            className="size-1.5 rounded-full"
            style={{ background: sev, boxShadow: `0 0 6px ${sev}` }}
          />
          <TypeIcon className="size-3.5 text-muted-foreground" />
          <span className="eyebrow">{isQuake ? t("seismicEvent") : t("volcanicActivity")}</span>
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 text-muted-foreground"
          onClick={() => select(null)}
          aria-label={t("close")}
        >
          <X className="size-3.5" />
        </Button>
      </div>

      <div className="px-3.5 py-3">
        <h2 className="text-sm font-semibold leading-snug tracking-tight">{event.title}</h2>

        {isQuake && (
          <div className="mt-3 flex items-end justify-between gap-4">
            <div>
              <div className="eyebrow">{t("magnitude")}</div>
              <div className="mt-1 font-mono text-3xl font-semibold leading-none tracking-tight">
                {event.magnitude?.toFixed(1) ?? "—"}
              </div>
            </div>
            <div className="text-right">
              <div className="eyebrow">{t("depth")}</div>
              <div className="mt-1 font-mono text-sm leading-none">
                {event.depth_km != null ? `${event.depth_km.toFixed(0)} km` : "—"}
              </div>
            </div>
          </div>
        )}

        {/* Severity position on the green-to-amber-to-red gradient. */}
        <div className="mt-3">
          <div className="h-1 rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{
                width: `${Math.round((event.severity ?? 0.5) * 100)}%`,
                background: sev,
              }}
            />
          </div>
        </div>

        <dl className="mt-3 space-y-2 border-t border-border/60 pt-3">
          <Row label={t("place")}>
            <span className="line-clamp-2 font-sans">{event.place ?? "—"}</span>
          </Row>
          <Row label={t("timeUtc")}>{formatTime(event.occurred_at, numberLocale)}</Row>
          <Row label="Lat / Lon">
            {event.lat.toFixed(2)}° · {event.lon.toFixed(2)}°
          </Row>
        </dl>
      </div>
    </Card>
  );
}
