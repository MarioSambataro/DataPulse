// Deep-linking dell'evento selezionato: `?event=<id>` nell'URL.
//
// - All'avvio: se l'URL contiene `?event=`, appena gli eventi sono in store si
//   seleziona quell'id → il CameraRig vola sull'epicentro da solo. Il "pending"
//   resta armato finché l'id non compare (gli eventi arrivano async).
// - A ogni selezione: l'URL viene riscritto con replaceState (niente history
//   spam), preservando gli altri parametri (es. ?mock=1). Ogni evento sul globo
//   diventa così un link condivisibile.

import { useEffect, useRef } from "react";

import { useStore } from "../store/useStore";

const PARAM = "event";

export function useDeepLink(): void {
  const events = useStore((s) => s.events);
  const selectedId = useStore((s) => s.selectedId);
  const select = useStore((s) => s.select);

  // Id richiesto dall'URL al primo mount, consumato appena esiste in store.
  const pendingRef = useRef<string | null>(
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get(PARAM),
  );

  // Selezione iniziale da URL (quando gli eventi arrivano).
  useEffect(() => {
    const pending = pendingRef.current;
    if (!pending || events.length === 0) return;
    if (events.some((e) => e.id === pending)) {
      pendingRef.current = null;
      select(pending);
    }
  }, [events, select]);

  // Selezione → URL (replaceState per non inquinare la history).
  useEffect(() => {
    if (pendingRef.current) return; // non riscrivere l'URL prima di consumare il pending
    const params = new URLSearchParams(window.location.search);
    if (selectedId) params.set(PARAM, selectedId);
    else params.delete(PARAM);
    const qs = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  }, [selectedId]);
}
