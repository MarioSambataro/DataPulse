// Synchronize selected events with `?event=<id>` while preserving other query
// parameters. Pending IDs resolve when asynchronous event data arrives.

import { useEffect, useRef } from "react";

import { useStore } from "../store/useStore";

const PARAM = "event";

export function useDeepLink(): void {
  const events = useStore((s) => s.events);
  const selectedId = useStore((s) => s.selectedId);
  const select = useStore((s) => s.select);

  // Initial URL selection, consumed when the event appears in the store.
  const pendingRef = useRef<string | null>(
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get(PARAM),
  );

  // Resolve the initial URL selection when events arrive.
  useEffect(() => {
    const pending = pendingRef.current;
    if (!pending || events.length === 0) return;
    if (events.some((e) => e.id === pending)) {
      pendingRef.current = null;
      select(pending);
    }
  }, [events, select]);

  // Mirror selection to the URL without adding history entries.
  useEffect(() => {
    if (pendingRef.current) return; // Wait until pending URL state is consumed.
    const params = new URLSearchParams(window.location.search);
    if (selectedId) params.set(PARAM, selectedId);
    else params.delete(PARAM);
    const qs = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  }, [selectedId]);
}
