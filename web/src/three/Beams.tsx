import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { latLonToVec3 } from "../lib/geo";
import type { RGB } from "../lib/severity";
import { beamFragment, beamVertex } from "./eventShaders";

/** Specifica di una colonna di luce (dimensioni in unità scena). */
export interface BeamSpec {
  lat: number;
  lon: number;
  color: RGB;
  height: number;
  width: number;
}

const BEAM_UP = new THREE.Vector3(0, 1, 0); // asse del cilindro nel suo spazio locale

/**
 * Colonne di luce verticali sul globo, come singolo InstancedMesh di cilindri
 * rastremati (base sulla superficie, cima che svanisce). Additive, con respiro
 * sfalsato per istanza. Layer puramente decorativo: non intercetta il raycast,
 * i click passano ai marker sottostanti.
 */
export function Beams({ beams, radius }: { beams: BeamSpec[]; radius: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = beams.length;

  const geometry = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.32, 1, 1, 16, 1, true);
    g.translate(0, 0.5, 0); // base a y=0 → la scala in altezza non affonda nel globo
    return g;
  }, []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: beamVertex,
        fragmentShader: beamFragment,
        uniforms: { uTime: { value: 0 } },
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || count === 0) return;

    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const matrix = new THREE.Matrix4();
    const colors = new Float32Array(count * 3);
    const phases = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const beam = beams[i];
      const [x, y, z] = latLonToVec3(beam.lat, beam.lon, radius * 1.001);
      position.set(x, y, z);
      quaternion.setFromUnitVectors(BEAM_UP, position.clone().normalize());
      scale.set(beam.width, beam.height, beam.width);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(i, matrix);

      colors[i * 3] = beam.color[0];
      colors[i * 3 + 1] = beam.color[1];
      colors[i * 3 + 2] = beam.color[2];
      // Fase deterministica ben distribuita (sequenza aurea) → respiri sfalsati.
      phases[i] = (i * 0.6180339887) % 1;
    }

    mesh.instanceMatrix.needsUpdate = true;
    geometry.setAttribute("aColor", new THREE.InstancedBufferAttribute(colors, 3));
    geometry.setAttribute("aPhase", new THREE.InstancedBufferAttribute(phases, 1));
  }, [beams, count, radius, geometry]);

  useFrame((_, delta) => {
    material.uniforms.uTime.value += delta;
  });

  if (count === 0) return null;

  return (
    <instancedMesh
      // Rimonta quando cambia il numero di beam (args[count] è immutabile a runtime).
      key={count}
      ref={meshRef}
      args={[geometry, material, count]}
      frustumCulled={false}
      raycast={() => null}
    />
  );
}
