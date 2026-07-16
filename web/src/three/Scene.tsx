import { OrbitControls, Stars } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";

import { latLonToVec3 } from "../lib/geo";
import { subsolarPoint } from "../lib/sun";
import { useStore } from "../store/useStore";
import { Atmosphere } from "./Atmosphere";
import { CameraRig, INTRO_POSITION } from "./CameraRig";
import { EventsLayer } from "./EventsLayer";
import { Globe } from "./Globe";
import { PlateBoundaries } from "./PlateBoundaries";
import { SelectionMarker } from "./SelectionMarker";

const GLOBE_RADIUS = 1.6;

// Il terminatore giorno/notte segue l'ora reale: la direzione del sole è il
// punto subsolare calcolato dall'UTC corrente, riallineato ogni 5 minuti
// (≈1.25° di rotazione, sotto la soglia percettiva tra un refresh e l'altro).
const SUN_REFRESH_MS = 5 * 60 * 1000;

function useSunDirection(): THREE.Vector3 {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), SUN_REFRESH_MS);
    return () => clearInterval(id);
  }, []);
  return useMemo(() => {
    const { lat, lon } = subsolarPoint();
    return new THREE.Vector3(...latLonToVec3(lat, lon, 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);
}

function SceneBackground({ daytime }: { daytime: boolean }) {
  const scene = useThree((state) => state.scene);
  useEffect(() => {
    scene.background = new THREE.Color(daytime ? "#edf4f5" : "#03070d");
  }, [daytime, scene]);
  return null;
}

/** Scena 3D: globo + atmosfera + campo stellato, camera con auto-rotazione + drag. */
export function Scene({ daytime }: { daytime: boolean }) {
  const autoRotate = useStore((s) => s.autoRotate);
  const interacting = useStore((s) => s.interacting);
  const selectedId = useStore((s) => s.selectedId);
  const pauseRotation = useStore((s) => s.pauseRotation);
  const resumeRotationAfter = useStore((s) => s.resumeRotationAfter);

  // Direzione del sole condivisa tra directionalLight e shader atmosfera:
  // se divergono il terminatore dell'alone non combacia con quello del globo.
  const sunDirection = useSunDirection();

  return (
    <Canvas
      className="scene-canvas"
      // La camera parte lontana: il dolly-in dell'intro (CameraRig) la porta
      // alla posizione operativa HOME_POSITION.
      camera={{ position: INTRO_POSITION, fov: 45, near: 0.1, far: 100 }}
      dpr={[1, 1.25]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <SceneBackground daytime={daytime} />
      {/* Illuminazione a tre punti: sole caldo, fill neutro basso, controluce
          fredda sul lato in ombra (dà volume senza appiattire il terminatore). */}
      <ambientLight intensity={daytime ? 0.6 : 0.32} />
      <directionalLight
        position={[sunDirection.x * 5, sunDirection.y * 5, sunDirection.z * 5]}
        intensity={daytime ? 2.1 : 1.45}
        color={daytime ? "#fff8ee" : "#ffe6bd"}
      />
      <hemisphereLight color={daytime ? "#c8edf0" : "#3e7894"} groundColor="#02060a" intensity={daytime ? 0.22 : 0.48} />
      <directionalLight position={[-5, -1, -4]} intensity={daytime ? 0.3 : 0.18} color="#4e7da4" />

      {!daytime && <Stars radius={80} depth={50} count={3500} factor={3.2} saturation={0} fade speed={0.4} />}

      <Globe radius={GLOBE_RADIUS} daytime={daytime} />
      {/* Contesto geologico: confini di placca tettonica (toggle nell'HUD). */}
      <PlateBoundaries radius={GLOBE_RADIUS} daytime={daytime} />
      {/* Layer dati: epicentri sismici (instanced ping) + marker vulcani. */}
      <EventsLayer radius={GLOBE_RADIUS} />
      {/* Indicatore di acquisizione sull'evento selezionato (click globo o ticker). */}
      <SelectionMarker radius={GLOBE_RADIUS} daytime={daytime} />
      <Atmosphere radius={GLOBE_RADIUS} daytime={daytime} sunDirection={sunDirection} />

      {/* Intro dolly-in + fly-to cinematico sull'evento selezionato. */}
      <CameraRig />
      <OrbitControls
        makeDefault
        enablePan={false}
        enableZoom
        // L'auto-rotazione parte dall'intento utente ma si sospende durante ogni
        // interazione (drag/hover/click) e riprende da sola dopo qualche secondo.
        // Una selezione è uno stato operativo stabile: il punto resta in vista
        // finché il pannello dettaglio non viene chiuso.
        autoRotate={autoRotate && !interacting && !selectedId}
        autoRotateSpeed={0.35}
        rotateSpeed={0.5}
        zoomSpeed={0.6}
        minDistance={2.4}
        maxDistance={9}
        enableDamping
        dampingFactor={0.06}
        onStart={pauseRotation}
        onEnd={() => resumeRotationAfter(2500)}
      />
    </Canvas>
  );
}
