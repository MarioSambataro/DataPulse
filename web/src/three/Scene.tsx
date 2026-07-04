import { OrbitControls, Stars } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";

import { useStore } from "../store/useStore";
import { palette } from "../theme";
import { Atmosphere } from "./Atmosphere";
import { EventsLayer } from "./EventsLayer";
import { Globe } from "./Globe";
import { SelectionMarker } from "./SelectionMarker";

const GLOBE_RADIUS = 1.6;

// Direzione del sole condivisa tra directionalLight e shader atmosfera:
// se divergono il terminatore dell'alone non combacia con quello del globo.
const SUN_DIRECTION = new THREE.Vector3(5, 3, 5).normalize();

/** Scena 3D: globo + atmosfera + campo stellato, camera con auto-rotazione + drag. */
export function Scene() {
  const autoRotate = useStore((s) => s.autoRotate);
  const interacting = useStore((s) => s.interacting);
  const pauseRotation = useStore((s) => s.pauseRotation);
  const resumeRotationAfter = useStore((s) => s.resumeRotationAfter);

  return (
    <Canvas
      camera={{ position: [0, 1.1, 4.6], fov: 45, near: 0.1, far: 100 }}
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        scene.background = new THREE.Color(palette.bg);
      }}
    >
      {/* Illuminazione a tre punti: sole caldo, fill neutro basso, controluce
          fredda sul lato in ombra (dà volume senza appiattire il terminatore). */}
      <ambientLight intensity={0.16} />
      <directionalLight
        position={[SUN_DIRECTION.x * 5, SUN_DIRECTION.y * 5, SUN_DIRECTION.z * 5]}
        intensity={1.6}
        color="#fff3df"
      />
      <directionalLight position={[-5, -1, -4]} intensity={0.22} color="#4a6a9a" />

      <Stars radius={80} depth={50} count={3500} factor={3.2} saturation={0} fade speed={0.4} />

      <Globe radius={GLOBE_RADIUS} />
      {/* Layer dati: epicentri sismici (instanced ping) + marker vulcani. */}
      <EventsLayer radius={GLOBE_RADIUS} />
      {/* Reticolo sull'evento selezionato (click globo o ticker). */}
      <SelectionMarker radius={GLOBE_RADIUS} />
      <Atmosphere radius={GLOBE_RADIUS} sunDirection={SUN_DIRECTION} />

      <OrbitControls
        enablePan={false}
        enableZoom
        // L'auto-rotazione parte dall'intento utente ma si sospende durante ogni
        // interazione (drag/hover/click) e riprende da sola dopo qualche secondo.
        autoRotate={autoRotate && !interacting}
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
