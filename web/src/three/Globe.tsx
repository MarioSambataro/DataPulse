import { useTexture } from "@react-three/drei";
import { Component, type ReactNode, Suspense, useMemo } from "react";
import * as THREE from "three";

import { useStore } from "../store/useStore";
import { palette } from "../theme";
import { gridFragment, gridVertex } from "./shaders";

const MAP_URL = "/textures/earth-map.jpg";
const NIGHT_URL = "/textures/earth-night.jpg";

/** Griglia tattica lat/lon procedurale sovrapposta alla superficie. */
function GridOverlay({ radius }: { radius: number }) {
  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(palette.grid) },
      uLat: { value: 18 }, // paralleli ogni 10°
      uLon: { value: 36 }, // meridiani ogni 10°
      uOpacity: { value: 0.1 },
    }),
    [],
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

/**
 * Globo con texture reali, due modalità:
 *  - night: mappa diurna scurita (#243447) + luci notturne emissive (ambra) → look tattico.
 *  - day:   Terra reale a piena luce; leggero earthshine emissivo sul lato in ombra
 *           così i continenti restano leggibili anche oltre il terminatore.
 */
function TexturedGlobe({ radius }: { radius: number }) {
  const globeView = useStore((s) => s.globeView);
  const [mapTex, nightTex] = useTexture([MAP_URL, NIGHT_URL]);
  useMemo(() => {
    for (const t of [mapTex, nightTex]) {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
    }
  }, [mapTex, nightTex]);

  const isDay = globeView === "day";
  return (
    <mesh scale={radius}>
      <sphereGeometry args={[1, 96, 96]} />
      <meshStandardMaterial
        map={mapTex}
        emissiveMap={isDay ? mapTex : nightTex}
        // Day: earthshine neutro appena percettibile (continenti leggibili oltre il
        // terminatore senza velare i colori veri). Night: luci città meno sparate.
        emissive={new THREE.Color(isDay ? "#5f7d9e" : palette.amber)}
        emissiveIntensity={isDay ? 0.08 : 1.35}
        color={new THREE.Color(isDay ? "#f4f7fa" : "#26374e")}
        roughness={isDay ? 0.62 : 0.9}
        metalness={0.04}
      />
    </mesh>
  );
}

/** Fallback procedurale (nessuna texture): sfera scura, la griglia dà il contesto. */
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

/** Error boundary: se le texture falliscono, mostra il globo procedurale. */
class GlobeBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Globo completo: superficie (texture o fallback) + griglia tattica. */
export function Globe({ radius }: { radius: number }) {
  const fallback = <ProceduralGlobe radius={radius} />;
  return (
    <group>
      <GlobeBoundary fallback={fallback}>
        <Suspense fallback={fallback}>
          <TexturedGlobe radius={radius} />
        </Suspense>
      </GlobeBoundary>
      <GridOverlay radius={radius} />
    </group>
  );
}
