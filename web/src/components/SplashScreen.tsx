import { useProgress } from "@react-three/drei";
import { LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { useLocale } from "@/components/locale-provider";
import { useStore } from "@/store/useStore";

const MIN_VISIBLE_MS = 2400;
const FADE_MS = 520;

/**
 * A meaningful loading state: the scene itself becomes the map preview while
 * each geoscience layer comes online. The dashboard HUD appears only after it.
 */
export function SplashScreen() {
  const { progress } = useProgress();
  const { t } = useLocale();
  const setBooting = useStore((state) => state.setBooting);
  const [elapsed, setElapsed] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Date.now() - started), 40);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (elapsed < MIN_VISIBLE_MS || leaving) return;
    setLeaving(true);
  }, [elapsed, leaving]);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => {
      setBooting(false);
      setGone(true);
    }, FADE_MS);
    return () => window.clearTimeout(timer);
  }, [leaving, setBooting]);

  const displayedProgress = useMemo(() => {
    const staged = Math.min(94, 16 + Math.round((elapsed / MIN_VISIBLE_MS) * 78));
    return Math.max(Math.min(99, Math.round(progress)), staged);
  }, [elapsed, progress]);

  if (gone) return null;

  return (
    <div
      aria-hidden
      className={cn(
        "loading-splash pointer-events-none absolute inset-0 z-50 bg-[#f7f9fd]/10 text-slate-900 transition-opacity duration-500 ease-out",
        leaving && "opacity-0",
      )}
    >
      <div className="absolute left-5 top-4 flex flex-col gap-2 sm:left-6 sm:top-5">
        <span className="text-base font-semibold tracking-tight">DataPulse</span>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>{t("buildingLayers")}</span>
          <LoaderCircle className="size-3.5 animate-spin text-teal-500" strokeWidth={2.2} />
          <span className="tabular-nums">{leaving ? 100 : displayedProgress}%</span>
        </div>
      </div>
    </div>
  );
}
