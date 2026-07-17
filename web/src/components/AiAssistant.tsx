import { ArrowUp, Bot, RotateCcw, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useLocale } from "@/components/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AiUnavailableError,
  aiQuery,
  fetchEvents,
  fetchEventsWithParams,
  isMockMode,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { useStore } from "@/store/useStore";
import type { AiFilters } from "@/types";

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  text: string;
  total?: number;
}

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

/** Floating, contextual AI chat shared by the mobile and desktop dashboards. */
export function AiAssistant() {
  const { locale, numberLocale, t } = useLocale();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const events = useStore((s) => s.events);
  const selectedId = useStore((s) => s.selectedId);
  const setEvents = useStore((s) => s.setEvents);
  const setFilters = useStore((s) => s.setFilters);
  const setAiMode = useStore((s) => s.setAiMode);
  const stopPlayback = useStore((s) => s.stopPlayback);
  const aiMode = useStore((s) => s.aiMode);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedId) ?? null,
    [events, selectedId],
  );

  const prompts = useMemo(() => {
    const defaults = [t("aiPromptSummary"), t("aiPromptStrongest")];
    if (!selectedEvent) return [...defaults, t("aiPromptVolcanoes")];
    const selected = locale === "it"
      ? `Analizza l'evento a ${selectedEvent.place}`
      : `Analyze the event near ${selectedEvent.place}`;
    return [...defaults, selected];
  }, [locale, selectedEvent, t]);

  useEffect(() => {
    if (!open) return;
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 180);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const append = (message: Omit<ChatMessage, "id">) => {
    setMessages((current) => [...current, { ...message, id: Date.now() + current.length }]);
  };

  const ask = async (value = question) => {
    const q = value.trim();
    if (q.length < 3 || busy) return;

    setQuestion("");
    append({ role: "user", text: q });
    setBusy(true);

    if (isMockMode()) {
      window.setTimeout(() => {
        append({ role: "assistant", text: t("aiDemoReply") });
        setBusy(false);
      }, 450);
      return;
    }

    try {
      const result = await aiQuery(q);
      const page = await fetchEventsWithParams(toParams(result.filters));
      stopPlayback();
      setFilters({ eventType: "all", minMagnitude: 0, timeWindow: "all" });
      setEvents(page.items);
      setAiMode({ question: q, answer: result.answer, total: page.total });
      append({ role: "assistant", text: result.answer, total: page.total });
    } catch (error) {
      append({
        role: "assistant",
        text: error instanceof AiUnavailableError ? t("aiNotConfigured") : t("queryFailed"),
      });
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setMessages([]);
    setQuestion("");
    setAiMode(null);
    try {
      const page = await fetchEvents();
      setEvents(page.items);
    } catch {
      // The regular polling cycle restores the live dataset.
    }
  };

  return (
    <>
      {!open && (
        <Button
          type="button"
          size="icon"
          className="ai-fab pointer-events-auto absolute bottom-[132px] right-3 z-30 size-[52px] rounded-full md:bottom-[120px] md:left-4 md:right-auto"
          onClick={() => setOpen(true)}
          aria-label={t("openAiAssistant")}
        >
          <Sparkles className="size-5" />
        </Button>
      )}

      {open && (
        <div className="pointer-events-auto absolute inset-0 z-50 md:pointer-events-none">
          <button
            type="button"
            className="absolute inset-0 bg-background/35 backdrop-blur-[1px] md:hidden"
            onClick={() => setOpen(false)}
            aria-label={t("closeAiAssistant")}
          />

          <section
            className="ai-chat-sheet safe-bottom pointer-events-auto absolute inset-x-2 bottom-2 flex h-[min(72dvh,640px)] flex-col overflow-hidden rounded-[28px] border border-primary/35 bg-card/95 shadow-2xl backdrop-blur-2xl md:bottom-[120px] md:left-4 md:right-auto md:top-20 md:h-auto md:w-[360px] md:rounded-2xl"
            role="dialog"
            aria-modal="true"
            aria-label={t("aiAssistant")}
          >
            <header className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-inset ring-primary/30">
                <Bot className="size-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold tracking-tight">{t("aiAssistant")}</h2>
                <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-primary">
                  <span className="size-1.5 rounded-full bg-primary" />
                  {t("aiOnline")}
                </div>
              </div>
              {aiMode && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="ml-auto size-9 rounded-xl"
                  onClick={() => void reset()}
                  aria-label={t("newAiChat")}
                >
                  <RotateCcw className="size-4" />
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn("size-9 rounded-xl", !aiMode && "ml-auto")}
                onClick={() => setOpen(false)}
                aria-label={t("closeAiAssistant")}
              >
                <X className="size-5" />
              </Button>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Sparkles className="size-3.5" />
                </div>
                <p className="max-w-[86%] rounded-2xl rounded-tl-md border border-primary/20 bg-primary/10 px-3.5 py-2.5 text-xs leading-relaxed">
                  {t("aiGreeting")}
                </p>
              </div>

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn("flex", message.role === "user" ? "justify-end" : "items-start gap-2.5")}
                >
                  {message.role === "assistant" && (
                    <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <Sparkles className="size-3.5" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[86%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed",
                      message.role === "user"
                        ? "rounded-tr-md bg-primary text-primary-foreground"
                        : "rounded-tl-md border border-border/70 bg-muted/45",
                    )}
                  >
                    <p>{message.text}</p>
                    {message.total != null && (
                      <Badge variant="muted" className="mt-2 tabular-nums">
                        {message.total.toLocaleString(numberLocale)} {t("results")}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}

              {busy && (
                <div className="flex items-center gap-2.5 text-muted-foreground">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <Sparkles className="size-3.5 animate-pulse" />
                  </div>
                  <span className="text-xs">{t("querying")}</span>
                </div>
              )}
            </div>

            <div className="border-t border-border/60 bg-background/35 p-3">
              {messages.length === 0 && (
                <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
                  {prompts.map((prompt) => (
                    <Button
                      key={prompt}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0 rounded-full border-primary/25 bg-primary/5 px-3 text-[10px] text-primary"
                      onClick={() => void ask(prompt)}
                    >
                      {prompt}
                    </Button>
                  ))}
                </div>
              )}

              <form
                className="flex items-center gap-2 rounded-2xl border border-border/80 bg-muted/30 p-1.5 pl-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void ask();
                }}
              >
                <input
                  ref={inputRef}
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder={t("aiChatPlaceholder")}
                  maxLength={300}
                  disabled={busy}
                  aria-label={t("naturalLanguageQuestion")}
                  className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                <Button
                  type="submit"
                  size="icon"
                  className="size-9 shrink-0 rounded-xl"
                  disabled={busy || question.trim().length < 3}
                  aria-label={t("sendQuestion")}
                >
                  <ArrowUp className="size-4" />
                </Button>
              </form>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
