import { useTexture } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { Component, type ReactNode, Suspense, useMemo } from "react";
import * as THREE from "three";

import { palette } from "../theme";
import { gridFragment, gridVertex } from "./shaders";

const MAP_URL = "/textures/earth-map-hd.jpg";
const NIGHT_URL = "/textures/earth-night-hd.jpg";

function GridOverlay({ radius, daytime }: { radius: number; daytime: boolean }) {
  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(daytime ? "#5d8998" : palette.grid) },
      uLat: { value: 12 },
      uLon: { value: 24 },
      uOpacity: { value: daytime ? 0.055 : 0.07 },
    }),
    [daytime],
  );
  return (
    <mesh scale={radius * 1.002}>
      <sphereGeometry args={[1, 64, 64]} />
      <shaderMaterial
        vertexShader={gridVertex}
        fragmentShader={gridFragment}
        uniforms={uniforms}
        blending={THREE.AdditiveBlending}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

/** Surface shader: the lit texture, city lights and terminator all follow the sun. */
function TexturedGlobe({ radius, daytime }: { radius: number; daytime: boolean }) {
  const [mapTex, nightTex] = useTexture([MAP_URL, NIGHT_URL]);
  const gl = useThree((state) => state.gl);
  useMemo(() => {
    for (const texture of [mapTex, nightTex]) {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(12, gl.capabilities.getMaxAnisotropy());
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
    }
  }, [gl, mapTex, nightTex]);

  return (
    <mesh scale={radius}>
      <sphereGeometry args={[1, 160, 160]} />
      <meshPhysicalMaterial
        map={daytime ? mapTex : nightTex}
        emissiveMap={nightTex}
        emissive={new THREE.Color(daytime ? "#1c4f58" : "#ffe2b0")}
        emissiveIntensity={daytime ? 0.035 : 0.72}
        color={new THREE.Color(daytime ? "#c9f0f0" : "#b8c6df")}
        bumpMap={mapTex}
        bumpScale={daytime ? 0.018 : 0.012}
        roughness={daytime ? 0.72 : 0.64}
        metalness={0.01}
        clearcoat={daytime ? 0.11 : 0.05}
        clearcoatRoughness={0.42}
      />
    </mesh>
  );
}

function ProceduralGlobe({ radius }: { radius: number }) {
  return (
    <mesh scale={radius}>
      <sphereGeometry args={[1, 64, 64]} />
      <meshStandardMaterial
        color={new THREE.Color("#0c1a26")}
        emissive={new THREE.Color(palette.acidDim)}
        emissiveIntensity={0.25}
        roughness={1}
        metalness={0}
      />
    </mesh>
  );
}

class GlobeBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function Globe({ radius, daytime }: { radius: number; daytime: boolean }) {
  const fallback = <ProceduralGlobe radius={radius} />;
  return (
    <group>
      <GlobeBoundary fallback={fallback}>
        <Suspense fallback={fallback}>
          <TexturedGlobe radius={radius} daytime={daytime} />
        </Suspense>
      </GlobeBoundary>
      <GridOverlay radius={radius} daytime={daytime} />
    </group>
  );
}
