import { useEffect, useRef, useState } from "react";

const DURATION_MS = 900;

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

/**
 * Count up from zero on mount and animate subsequent changes from the previous value.
 * Use inside a tabular-nums container to prevent digit-width shifts.
 */
export function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) {
      setDisplay(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      const v = from + (value - from) * easeOutCubic(t);
      setDisplay(v);
      if (t < 1) raf = requestAnimationFrame(step);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      fromRef.current = value; // An interrupted animation resumes from its target.
    };
  }, [value]);

  return <>{display.toFixed(decimals)}</>;
}
