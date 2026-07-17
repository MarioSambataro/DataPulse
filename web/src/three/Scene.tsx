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

// The day/night terminator follows the current real-world solar direction.
// Recalculate the UTC subsolar point every five minutes, below visible drift.
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

/** 3D globe, atmosphere, stars, and interactive camera scene. */
export function Scene({ daytime }: { daytime: boolean }) {
  const autoRotate = useStore((s) => s.autoRotate);
  const interacting = useStore((s) => s.interacting);
  const selectedId = useStore((s) => s.selectedId);
  const pauseRotation = useStore((s) => s.pauseRotation);
  const resumeRotationAfter = useStore((s) => s.resumeRotationAfter);

  // Share one sun direction between directional light and atmosphere shader.
  // Sharing direction keeps the atmospheric and surface terminators aligned.
  const sunDirection = useSunDirection();

  return (
    <Canvas
      className="scene-canvas"
      // CameraRig dollies the camera inward from its distant initial position.
      // to the operational HOME_POSITION.
      camera={{ position: INTRO_POSITION, fov: 45, near: 0.1, far: 100 }}
      dpr={[1, 1.25]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <SceneBackground daytime={daytime} />
      {/* Illuminazione a tre punti: sole caldo, fill neutro basso, controluce
          cool fill on the shadow side adds volume without flattening the terminator. */}
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
      {/* Toggleable tectonic plate boundaries provide geological context. */}
      <PlateBoundaries radius={GLOBE_RADIUS} daytime={daytime} />
      {/* Data layer with instanced seismic pings and volcano markers. */}
      <EventsLayer radius={GLOBE_RADIUS} />
      {/* Selection indicator for globe and ticker interactions. */}
      <SelectionMarker radius={GLOBE_RADIUS} daytime={daytime} />
      <Atmosphere radius={GLOBE_RADIUS} daytime={daytime} sunDirection={sunDirection} />

      {/* Intro dolly and cinematic selected-event fly-to. */}
      <CameraRig />
      <OrbitControls
        makeDefault
        enablePan={false}
        enableZoom
        // Auto-rotation follows user preference but pauses during interaction.
        // Interaction pauses rotation temporarily; a selection remains stable until closed.
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
