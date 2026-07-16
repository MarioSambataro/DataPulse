// Ticker eventi live: marquee orizzontale lungo il bordo inferiore con gli ultimi
// eventi (rispetta i filtri attivi). Auto-scroll continuo (in pausa su hover);
// click su una riga → seleziona l'evento (riusa select/selectedId + DetailPanel +
// SelectionMarker sul globo). Niente flicker: lista derivata dallo store.

import { Activity, Mountain, Radio } from "lucide-react";
import { useMemo } from "react";

import { timeAgo } from "@/lib/format";
import { useLocale } from "@/components/locale-provider";
import { filterEvents } from "@/lib/filters";
import { cn } from "@/lib/utils";
import { useStore } from "@/store/useStore";
import type { Event } from "@/types";

// Quanti eventi (più recenti) scorrere nel ticker.
const MAX_ITEMS = 40;

function TickerItem({
  ev,
  selected,
  onSelect,
  duplicate = false,
}: {
  ev: Event;
  selected: boolean;
  onSelect: (id: string) => void;
  duplicate?: boolean;
}) {
  const isQuake = ev.event_type === "earthquake";
  return (
    <button
      type="button"
      className={cn(
        "flex h-full shrink-0 items-center gap-2 border-r border-border/50 px-3.5 text-xs transition-colors hover:bg-primary/10",
        selected && "bg-primary/15",
      )}
      onClick={() => onSelect(ev.id)}
      title={ev.title}
      aria-hidden={duplicate || undefined}
      tabIndex={duplicate ? -1 : 0}
    >
      {isQuake ? (
        <Activity className="size-3 text-primary" />
      ) : (
        <Mountain className="size-3 text-warning" />
      )}
      {isQuake && (
        <span className="font-mono font-semibold text-warning">
          M{ev.magnitude?.toFixed(1) ?? "?"}
        </span>
      )}
      <span className="max-w-[220px] truncate text-foreground/90">{ev.place ?? ev.title}</span>
      <span className="font-mono text-[10px] text-muted-foreground">{timeAgo(ev.occurred_at)}</span>
    </button>
  );
}

function TickerFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="hud-in pointer-events-none absolute inset-x-0 bottom-[76px] z-20 px-3 sm:bottom-20 sm:px-4"
      style={{ animationDelay: "1500ms" }}
    >
      <div className="glass pointer-events-auto flex h-10 items-stretch overflow-hidden rounded-lg">
        <span className="flex shrink-0 items-center gap-1.5 bg-primary px-3.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary-foreground">
          <Radio className="size-3" /> Live
        </span>
        {children}
      </div>
    </div>
  );
}

export function EventTicker() {
  const { t } = useLocale();
  const events = useStore((s) => s.events);
  const filters = useStore((s) => s.filters);
  const selectedId = useStore((s) => s.selectedId);
  const select = useStore((s) => s.select);

  // Eventi già ordinati desc dall'API; applichiamo i filtri e tagliamo a MAX_ITEMS.
  const items = useMemo(
    () => filterEvents(events, filters).slice(0, MAX_ITEMS),
    [events, filters],
  );

  if (items.length === 0) {
    return (
      <TickerFrame>
        <span className="flex items-center px-4 text-xs text-muted-foreground">
          {t("noEvents")}
        </span>
      </TickerFrame>
    );
  }

  // Velocità proporzionale al numero di item per uno scorrimento costante.
  const duration = Math.max(24, items.length * 3.4);

  return (
    <TickerFrame>
      <div className="group relative flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_4%,#000_96%,transparent)]">
        <div
          className="absolute left-0 top-0 flex h-full animate-ticker-scroll items-center whitespace-nowrap will-change-transform group-hover:[animation-play-state:paused]"
          style={{ animationDuration: `${duration}s` }}
        >
          {/* Lista duplicata per il loop continuo senza stacco. */}
          {[0, 1].map((dup) =>
            items.map((ev) => (
              <TickerItem
                key={`${dup}:${ev.id}`}
                ev={ev}
                selected={ev.id === selectedId}
                onSelect={select}
                duplicate={dup === 1}
              />
            )),
          )}
        </div>
      </div>
    </TickerFrame>
  );
}
