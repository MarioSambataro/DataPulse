import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import { latLonToVec3 } from "../lib/geo";
import { useStore } from "../store/useStore";

/** Posizione operativa della camera (fine intro, ritorno di default). */
export const HOME_POSITION: [number, number, number] = [0, 1.1, 4.6];
/** Punto di partenza dell'intro: lontano e leggermente dall'alto (entro il
 *  maxDistance degli OrbitControls, che altrimenti clamperebbe il primo frame). */
export const INTRO_POSITION: [number, number, number] = [0, 2.6, 8.4];

// Distanza a fine fly-to: abbastanza vicina da leggere il contesto dell'evento,
// senza superare i limiti di zoom degli OrbitControls (2.4 .. 9).
const FLY_MIN_DIST = 2.9;
const FLY_MAX_DIST = 4.2;

const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

interface Flight {
  fromDir: THREE.Vector3; // direzione camera→origine normalizzata di partenza
  toDir: THREE.Vector3;
  fromDist: number;
  toDist: number;
  t: number; // progresso 0..1
  duration: number; // secondi
}

/**
 * Regista di camera: due movimenti cinematici, entrambi in coordinate sferiche
 * (slerp della direzione + lerp della distanza, così l'orbita non attraversa
 * mai il globo).
 *  - Intro al mount: dolly-in dal punto lontano alla posizione operativa.
 *  - Fly-to: alla selezione di un evento (click sul globo, ticker, pannello)
 *    la camera vola sopra l'epicentro mantenendo la distanza corrente (clampata).
 * Durante il volo gli OrbitControls sono disabilitati e l'auto-rotazione in
 * pausa; alla fine riprendono da soli.
 */
export function CameraRig() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const selectedId = useStore((s) => s.selectedId);
  const events = useStore((s) => s.events);
  const pauseRotation = useStore((s) => s.pauseRotation);
  const resumeRotationAfter = useStore((s) => s.resumeRotationAfter);

  const flightRef = useRef<Flight | null>(null);
  const prevSelectedRef = useRef<string | null>(null);

  const startFlight = (to: THREE.Vector3, duration: number) => {
    const from = camera.position.clone();
    flightRef.current = {
      fromDir: from.clone().normalize(),
      toDir: to.clone().normalize(),
      fromDist: from.length(),
      toDist: to.length(),
      t: 0,
      duration,
    };
    pauseRotation();
  };

  // Intro: parte dalla INTRO_POSITION (impostata sulla camera dal Canvas).
  useEffect(() => {
    startFlight(new THREE.Vector3(...HOME_POSITION), 2.4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fly-to sull'evento selezionato (solo su cambi reali di selezione).
  useEffect(() => {
    if (!selectedId || selectedId === prevSelectedRef.current) {
      prevSelectedRef.current = selectedId;
      return;
    }
    prevSelectedRef.current = selectedId;
    const ev = events.find((e) => e.id === selectedId);
    if (!ev) return;

    const dir = new THREE.Vector3(...latLonToVec3(ev.lat, ev.lon, 1));
    const dist = THREE.MathUtils.clamp(camera.position.length(), FLY_MIN_DIST, FLY_MAX_DIST);
    startFlight(dir.multiplyScalar(dist), 1.5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, events]);

  useFrame((_, delta) => {
    const flight = flightRef.current;
    if (!flight) return;
    if (controls) controls.enabled = false;

    flight.t = Math.min(1, flight.t + delta / flight.duration);
    const e = easeInOutCubic(flight.t);

    const arc = new THREE.Quaternion().setFromUnitVectors(flight.fromDir, flight.toDir);
    const step = new THREE.Quaternion().slerp(arc, e); // identità → arco completo
    const dir = flight.fromDir.clone().applyQuaternion(step);
    const dist = THREE.MathUtils.lerp(flight.fromDist, flight.toDist, e);

    camera.position.copy(dir.multiplyScalar(dist));
    camera.lookAt(0, 0, 0);

    if (flight.t >= 1) {
      flightRef.current = null;
      if (controls) controls.enabled = true;
      resumeRotationAfter(3000);
    }
  });

  return null;
}
