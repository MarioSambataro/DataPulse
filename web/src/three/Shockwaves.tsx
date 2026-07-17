import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { latLonToVec3 } from "../lib/geo";
import { severityColor } from "../lib/severity";
import type { Event } from "../types";
import { shockwaveFragment, shockwaveVertex } from "./eventShaders";

// Surface-wave extent grows with magnitude from about 0.45R at M5.5 to 1.0R at M8.
const MAG_MIN = 5.5;
const MAG_MAX = 8;

const PLANE_NORMAL = new THREE.Vector3(0, 0, 1);

/**
 * Surface shockwaves for strong earthquakes rendered in one InstancedMesh.
 * Tangent quads are wrapped onto the sphere by the vertex shader with slow rings.
 * radiating from epicentres. This is a purely decorative additive layer with no
 * raycasting, so underlying pings retain selection behavior.
 */
export function Shockwaves({ events, radius }: { events: Event[]; radius: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = events.length;

  const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: shockwaveVertex,
        fragmentShader: shockwaveFragment,
        uniforms: {
          uTime: { value: 0 },
          uSurface: { value: 1 },
        },
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  useLayoutEffect(() => {
    material.uniforms.uSurface.value = radius * 1.006;
  }, [material, radius]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || count === 0) return;

    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const matrix = new THREE.Matrix4();
    const colors = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const mags = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const ev = events[i];
      const [x, y, z] = latLonToVec3(ev.lat, ev.lon, radius * 1.005);
      position.set(x, y, z);
      quaternion.setFromUnitVectors(PLANE_NORMAL, position.clone().normalize());

      const m = Math.min(MAG_MAX, Math.max(MAG_MIN, ev.magnitude ?? MAG_MIN));
      const t = (m - MAG_MIN) / (MAG_MAX - MAG_MIN);
      const size = radius * (0.45 + t * 0.55);
      scale.set(size, size, size);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(i, matrix);

      const [r, g, b] = severityColor(ev.severity);
      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
      phases[i] = (i * 0.6180339887) % 1; // sequenza aurea → fronti ben sfalsati
      mags[i] = t;
    }

    mesh.instanceMatrix.needsUpdate = true;
    geometry.setAttribute("aColor", new THREE.InstancedBufferAttribute(colors, 3));
    geometry.setAttribute("aPhase", new THREE.InstancedBufferAttribute(phases, 1));
    geometry.setAttribute("aMag", new THREE.InstancedBufferAttribute(mags, 1));
  }, [events, count, radius, geometry]);

  useFrame((_, delta) => {
    material.uniforms.uTime.value += delta;
  });

  if (count === 0) return null;

  return (
    <instancedMesh
      key={count}
      ref={meshRef}
      args={[geometry, material, count]}
      frustumCulled={false}
      // Decorative geometry must not intercept marker clicks.
      raycast={() => null}
    />
  );
}
