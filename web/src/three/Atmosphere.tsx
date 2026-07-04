import { useMemo } from "react";
import * as THREE from "three";

import { palette } from "../theme";
import { atmosphereFragment, atmosphereVertex } from "./shaders";

interface AtmosphereProps {
  radius: number;
  /** Direzione del sole in coordinate mondo (deve combaciare con la directionalLight). */
  sunDirection: THREE.Vector3;
}

interface PassProps {
  scale: number;
  color: string;
  power: number;
  intensity: number;
  side: THREE.Side;
  sunDirection: THREE.Vector3;
}

function AtmospherePass({ scale, color, power, intensity, side, sunDirection }: PassProps) {
  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(color) },
      uSunDir: { value: sunDirection.clone().normalize() },
      uPower: { value: power },
      uIntensity: { value: intensity },
    }),
    [color, power, intensity, sunDirection],
  );

  return (
    <mesh scale={scale}>
      <sphereGeometry args={[1, 64, 64]} />
      <shaderMaterial
        vertexShader={atmosphereVertex}
        fragmentShader={atmosphereFragment}
        uniforms={uniforms}
        side={side}
        blending={THREE.AdditiveBlending}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

/**
 * Atmosfera del globo: banda esterna sottile oltre il lembo + scattering interno
 * sul bordo del disco. Blu freddo desaturato, sun-aware — vedi shaders.ts.
 */
export function Atmosphere({ radius, sunDirection }: AtmosphereProps) {
  return (
    <group>
      {/* Scattering interno: tinge di blu solo il lembo del globo. */}
      <AtmospherePass
        scale={radius * 1.001}
        color={palette.atmoInner}
        power={3.5}
        intensity={0.65}
        side={THREE.FrontSide}
        sunDirection={sunDirection}
      />
      {/* Banda esterna: sottile, decade in fretta — niente alone gonfio. */}
      <AtmospherePass
        scale={radius * 1.035}
        color={palette.atmoOuter}
        power={3.0}
        intensity={0.5}
        side={THREE.BackSide}
        sunDirection={sunDirection}
      />
    </group>
  );
}
