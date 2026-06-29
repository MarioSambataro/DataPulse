import { useMemo } from "react";
import * as THREE from "three";

import { palette } from "../theme";
import { atmosphereFragment, atmosphereVertex } from "./shaders";

interface AtmosphereProps {
  radius: number;
  color?: string;
  power?: number;
  intensity?: number;
}

/** Alone atmosferico fresnel attorno al globo (BackSide + blending additivo). */
export function Atmosphere({
  radius,
  color = palette.cyan,
  power = 3.0,
  intensity = 1.1,
}: AtmosphereProps) {
  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(color) },
      uPower: { value: power },
      uIntensity: { value: intensity },
    }),
    [color, power, intensity],
  );

  return (
    <mesh scale={radius}>
      <sphereGeometry args={[1, 64, 64]} />
      <shaderMaterial
        vertexShader={atmosphereVertex}
        fragmentShader={atmosphereFragment}
        uniforms={uniforms}
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}
