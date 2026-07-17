import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import { latLonToVec3 } from "../lib/geo";
import { useStore } from "../store/useStore";

/** Operational camera position after the intro and for default return. */
export const HOME_POSITION: [number, number, number] = [0, 1.1, 4.6];
/** Intro start position within OrbitControls maximum distance to avoid frame-one clamping. */
export const INTRO_POSITION: [number, number, number] = [0, 2.6, 8.4];

// Fly-to distance preserves context while respecting OrbitControls zoom limits.
const FLY_MIN_DIST = 2.9;
const FLY_MAX_DIST = 4.2;

const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

interface Flight {
  fromDir: THREE.Vector3; // Initial normalized camera-to-origin direction.
  toDir: THREE.Vector3;
  fromDist: number;
  toDist: number;
  t: number; // progresso 0..1
  duration: number; // secondi
}

/**
 * Camera director for two spherical cinematic movements.
 * using direction slerp and distance lerp so the path never crosses the globe.
 *  - Mount intro: dolly from the distant start to the operational position.
 *  - Fly to a selected event from the globe, ticker, or panel.
 *    The camera flies above the epicentre while preserving a clamped distance.
 * OrbitControls and auto-rotation remain disabled during flight.
 * and resume automatically when the movement ends.
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

  // Start the intro from the Canvas-provided INTRO_POSITION.
  useEffect(() => {
    startFlight(new THREE.Vector3(...HOME_POSITION), 2.4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fly only when the selected event actually changes.
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
    const step = new THREE.Quaternion().slerp(arc, e); // Identity to full arc.
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
