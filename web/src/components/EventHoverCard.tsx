// Drei HTML hover callout for globe events.
// SENZA distanceFactor: dimensione fissa in pixel schermo, mai gigante allo zoom.
// Compact cartographic callout with a leader line to the marker.

import { severityCss } from "@/lib/severity";
import { useLocale, type Locale } from "@/components/locale-provider";
import type { Event } from "@/types";

/** `38.42°N 14.96°E` — formato cartografico compatto. */
function formatCoords(lat: number, lon: number): string {
  const la = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"}`;
  const lo = `${Math.abs(lon).toFixed(2)}°${lon >= 0 ? "E" : "W"}`;
  return `${la} ${lo}`;
}

/** Tempo relativo compatto in italiano ("adesso", "12 min", "3 h", "2 g"). */
function timeAgo(iso: string, locale: Locale, nowLabel: string): string | null {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const mins = Math.max(0, Math.round((Date.now() - t) / 60_000));
  if (mins < 1) return nowLabel;
  if (mins < 60) return `${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.round(hours / 24)} ${locale === "it" ? "g" : "d"}`;
}

export function EventHoverCard({ event }: { event: Event }) {
  const { locale, t } = useLocale();
  const isQuake = event.event_type === "earthquake";
  const dot = severityCss(event.severity);
  const ago = timeAgo(event.occurred_at, locale, t("now"));

  const kind = isQuake
    ? `${t("quake")}${event.magnitude != null ? ` · M ${event.magnitude.toFixed(1)}` : ""}`
    : t("volcano");

  return (
    // Anchor the card above the projected point with a leader line to the marker.
    <div className="pointer-events-none flex -translate-x-1/2 -translate-y-full flex-col items-center pb-1">
      <div className="min-w-[150px] max-w-[230px] rounded-md border border-border/80 bg-popover/85 px-2.5 py-2 shadow-lg backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5">
            <span
              className="size-1.5 shrink-0 rounded-full"
              style={{ background: dot, boxShadow: `0 0 6px ${dot}` }}
            />
            <span className="eyebrow whitespace-nowrap">{kind}</span>
          </span>
          {ago && (
            <span className="font-mono text-[10px] leading-none text-muted-foreground">
              {ago}
            </span>
          )}
        </div>

        <p className="mt-1 line-clamp-2 text-xs font-medium leading-snug text-foreground">
          {event.place ?? event.title}
        </p>

        <p className="mt-1 font-mono text-[10px] leading-none text-muted-foreground">
          {formatCoords(event.lat, event.lon)}
          {isQuake && event.depth_km != null && ` · ${event.depth_km.toFixed(0)} km`}
        </p>
      </div>
      {/* Leader line to the marker. */}
      <span className="h-3 w-px bg-border" />
    </div>
  );
}
