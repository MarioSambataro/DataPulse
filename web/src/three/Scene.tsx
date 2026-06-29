import { OrbitControls, Stars } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";

import { useStore } from "../store/useStore";
import { palette } from "../theme";
import { Atmosphere } from "./Atmosphere";
import { Globe } from "./Globe";

const GLOBE_RADIUS = 1.6;

/** Scena 3D: globo + atmosfera + campo stellato, camera con auto-rotazione + drag. */
export function Scene() {
  const autoRotate = useStore((s) => s.autoRotate);

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
      {/* Illuminazione: terminatore giorno/notte + fill freddo per leggere i continenti. */}
      <ambientLight intensity={0.18} />
      <hemisphereLight args={[palette.cyan, palette.bg, 0.25]} />
      <directionalLight position={[5, 3, 5]} intensity={1.5} color="#fff3df" />

      <Stars radius={80} depth={50} count={6000} factor={4} saturation={0} fade speed={0.6} />

      <Globe radius={GLOBE_RADIUS} />
      <Atmosphere radius={GLOBE_RADIUS * 1.06} color={palette.cyan} power={3.2} intensity={1.1} />
      {/* Secondo strato di alone più caldo e stretto vicino alla superficie. */}
      <Atmosphere radius={GLOBE_RADIUS * 1.02} color={palette.amber} power={5.0} intensity={0.5} />

      <OrbitControls
        enablePan={false}
        enableZoom
        autoRotate={autoRotate}
        autoRotateSpeed={0.35}
        rotateSpeed={0.5}
        zoomSpeed={0.6}
        minDistance={2.4}
        maxDistance={9}
        enableDamping
        dampingFactor={0.06}
      />
    </Canvas>
  );
}
