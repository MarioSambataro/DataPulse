// Barra time-travel: slider sull'intervallo degli eventi caricati + play/pause +
// velocità. Con playhead attivo il globo mostra solo gli eventi già accaduti a
// quell'istante (EventsLayer) e le onde d'urto si riaccendono al passaggio.
// Il ticking vive qui (setInterval ~10fps): smontata la barra, il playback si ferma.

import { FastForward, Pause, Play, X } from "lucide-react";
import { useEffect, useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/components/locale-provider";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import {
  PLAYBACK_SPEEDS,
  advancePlayhead,
  eventsTimeRange,
  formatPlayhead,
} from "@/lib/timeline";
import { useStore } from "@/store/useStore";

const TICK_MS = 100;

export function TimeBar() {
  const { t, numberLocale } = useLocale();
  const events = useStore((s) => s.events);
  const playback = useStore((s) => s.playback);
  const setPlayback = useStore((s) => s.setPlayback);
  const stopPlayback = useStore((s) => s.stopPlayback);

  const range = useMemo(() => eventsTimeRange(events), [events]);
  const active = playback.playhead != null;

  // Ticking del playback: avanza il playhead a velocità `speed` finché playing.
  useEffect(() => {
    if (!playback.playing || playback.playhead == null || !range) return;
    const id = window.setInterval(() => {
      const state = useStore.getState().playback;
      if (state.playhead == null) return;
      const { playhead, ended } = advancePlayhead(state.playhead, state.speed, TICK_MS, range.max);
      setPlayback(ended ? { playhead, playing: false } : { playhead });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [playback.playing, playback.playhead == null, range, setPlayback]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!active || !range) return null;

  const speedIdx = Math.max(
    0,
    PLAYBACK_SPEEDS.findIndex((s) => s.value === playback.speed),
  );
  const cycleSpeed = () =>
    setPlayback({ speed: PLAYBACK_SPEEDS[(speedIdx + 1) % PLAYBACK_SPEEDS.length].value });

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[124px] z-20 flex justify-center px-3 sm:bottom-32">
      <div className="glass pointer-events-auto flex w-full max-w-xl items-center gap-2.5 rounded-xl px-3 py-2">
        <Badge variant="warning" className="shrink-0 uppercase tracking-[0.14em]">
          {t("replay")}
        </Badge>

        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 shrink-0 px-0"
          onClick={() => setPlayback({ playing: !playback.playing })}
          aria-label={playback.playing ? t("pause") : t("play")}
        >
          {playback.playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 gap-1 px-2 font-mono text-[11px]"
          onClick={cycleSpeed}
          aria-label={t("playbackSpeed")}
        >
          <FastForward className="size-3" />
          {PLAYBACK_SPEEDS[speedIdx].label}
        </Button>

        <Slider
          min={range.min}
          max={range.max}
          step={60_000}
          value={[playback.playhead ?? range.max]}
          onValueChange={([v]) => setPlayback({ playhead: v, playing: false })}
          aria-label={t("eventTimeline")}
          className="flex-1"
        />

        <span className="shrink-0 font-mono text-[11px] tabular-nums text-primary">
          {formatPlayhead(playback.playhead ?? range.max, numberLocale)}
        </span>

        <Separator orientation="vertical" className="h-4" />
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 shrink-0 px-0"
          onClick={stopPlayback}
          aria-label={t("backLive")}
        >
          <X className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
