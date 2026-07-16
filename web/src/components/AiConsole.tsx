// Console AI (DeepSeek): due capacità
//  - query in linguaggio naturale → POST /ai/query traduce nei filtri di
//    GET /events; il fetch lo fa il client e il globo entra in "modalità AI"
//    (polling/SSE non sovrascrivono finché non si fa reset);
//  - SITREP: bollettino sintetico generato dai dati reali (GET /ai/briefing).
// Se il backend non ha DEEPSEEK_API_KEY (503) la console si spegne con una nota.

import { CornerDownLeft, RotateCcw, Sparkles } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useLocale } from "@/components/locale-provider";
import { Separator } from "@/components/ui/separator";
import {
  AiUnavailableError,
  aiQuery,
  fetchBriefing,
  fetchEvents,
  fetchEventsWithParams,
  isMockMode,
} from "@/lib/api";
import type { AiFilters } from "@/types";
import { useStore } from "@/store/useStore";

/** Converte i filtri AI nei query param di GET /events (solo i valorizzati). */
function toParams(filters: AiFilters): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.event_type) params.event_type = filters.event_type;
  if (filters.min_magnitude != null) params.min_magnitude = String(filters.min_magnitude);
  if (filters.start) params.start = filters.start;
  if (filters.end) params.end = filters.end;
  if (filters.near_lat != null && filters.near_lon != null && filters.radius_km != null) {
    params.near_lat = String(filters.near_lat);
    params.near_lon = String(filters.near_lon);
    params.radius_km = String(filters.radius_km);
  }
  return params;
}

export function AiConsole() {
  const { t, numberLocale } = useLocale();
  const aiMode = useStore((s) => s.aiMode);
  const setAiMode = useStore((s) => s.setAiMode);
  const setEvents = useStore((s) => s.setEvents);
  const setFilters = useStore((s) => s.setFilters);
  const stopPlayback = useStore((s) => s.stopPlayback);

  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [briefing, setBriefing] = useState<string | null>(null);
  const [briefingBusy, setBriefingBusy] = useState(false);

  if (isMockMode()) return null;

  const ask = async () => {
    const q = question.trim();
    if (q.length < 3 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await aiQuery(q);
      const page = await fetchEventsWithParams(toParams(result.filters));
      stopPlayback();
      // I filtri client tornano neutri: il dataset è GIÀ filtrato dall'API.
      setFilters({ eventType: "all", minMagnitude: 0, timeWindow: "all" });
      setEvents(page.items);
      setAiMode({ question: q, answer: result.answer, total: page.total });
    } catch (err) {
      if (err instanceof AiUnavailableError) setUnavailable(true);
      else setError(t("queryFailed"));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setAiMode(null);
    setQuestion("");
    try {
      const page = await fetchEvents();
      setEvents(page.items);
    } catch {
      // il prossimo giro di polling rimetterà a posto i dati
    }
  };

  const loadBriefing = async () => {
    if (briefingBusy) return;
    setBriefingBusy(true);
    setError(null);
    try {
      const res = await fetchBriefing();
      setBriefing(res.briefing);
    } catch (err) {
      if (err instanceof AiUnavailableError) setUnavailable(true);
      else setError(t("briefingUnavailable"));
    } finally {
      setBriefingBusy(false);
    }
  };

  return (
    <Card className="glass pointer-events-auto" aria-label="Console AI">
      <CardHeader className="flex-row items-center justify-between space-y-0 px-3.5 py-2.5">
        <span className="eyebrow flex items-center gap-1.5 text-foreground/80">
          <Sparkles className="size-3" /> AI Console
        </span>
        <Badge variant="muted" className="font-mono text-[9px]">
          deepseek-v4-flash
        </Badge>
      </CardHeader>

      <CardContent className="space-y-2.5 px-3.5 pb-3.5 pt-0">
        {unavailable ? (
          <p className="text-[11px] text-muted-foreground">{t("aiNotConfigured")}</p>
        ) : (
          <>
            <form
              className="flex items-center gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                void ask();
              }}
            >
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={t("aiPlaceholder")}
                maxLength={300}
                disabled={busy}
                aria-label={t("naturalLanguageQuestion")}
                className="h-8 w-full rounded-md border border-border/60 bg-muted/30 px-2.5 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="h-8 w-8 shrink-0 px-0 text-primary"
                disabled={busy || question.trim().length < 3}
                aria-label={t("sendQuestion")}
              >
                <CornerDownLeft className="size-3.5" />
              </Button>
            </form>

            {busy && (
              <p className="animate-pulse text-[11px] text-muted-foreground">{t("querying")}</p>
            )}
            {error && <p className="text-[11px] text-warning">{error}</p>}

            {aiMode && (
              <div className="space-y-1.5 rounded-lg border border-primary/25 bg-primary/10 p-2.5">
                <p className="text-[11px] leading-snug text-foreground/90">{aiMode.answer}</p>
                <div className="flex items-center justify-between">
                  <Badge variant="default" className="tabular-nums">
                    {aiMode.total.toLocaleString(numberLocale)} {t("results")}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1 px-2 text-[11px]"
                    onClick={() => void reset()}
                  >
                    <RotateCcw className="size-3" /> Reset
                  </Button>
                </div>
              </div>
            )}

            <Separator />

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  SITREP AI
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px]"
                  onClick={() => void loadBriefing()}
                  disabled={briefingBusy}
                >
                  {briefingBusy ? t("generating") : briefing ? t("refresh") : t("generate")}
                </Button>
              </div>
              {briefing && (
                <p className="text-[11px] leading-relaxed text-foreground/85">{briefing}</p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
