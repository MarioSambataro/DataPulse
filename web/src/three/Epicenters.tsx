import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { latLonToVec3 } from "../lib/geo";
import { magnitudeSize, severityColor } from "../lib/severity";
import type { Event } from "../types";
import { epicenterFragment, epicenterVertex } from "./eventShaders";

// Fattore di scala visivo dei ping rispetto alla dimensione "fisica" da magnitudo,
// per renderli ben leggibili sul globo senza coprire i vicini.
const PING_SCALE = 2.4;

const PLANE_NORMAL = new THREE.Vector3(0, 0, 1); // normale del PlaneGeometry locale

/**
 * Epicentri sismici come singolo InstancedMesh (un quad "radar ping" per evento,
 * tangente alla superficie). Colore = gradiente severità, dimensione = magnitudo,
 * anello pulsante via shader. Click → selezione dell'evento.
 */
export function Epicenters({
  events,
  radius,
  onSelect,
}: {
  events: Event[];
  radius: number;
  onSelect: (id: string) => void;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = events.length;

  const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: epicenterVertex,
        fragmentShader: epicenterFragment,
        uniforms: { uTime: { value: 0 } },
        transparent: true,
        depthWrite: false,
        toneMapped: false, // colori pieni: i ping spiccano sulle luci città in vista notte
        blending: THREE.NormalBlending,
      }),
    [],
  );

  // Popola matrici per-istanza + attributi (colore severità, fase anello).
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
      const ev = events[i];
      const [x, y, z] = latLonToVec3(ev.lat, ev.lon, radius * 1.004);
      position.set(x, y, z);
      // Orienta il quad tangente alla superficie (normale = direzione radiale).
      quaternion.setFromUnitVectors(PLANE_NORMAL, position.clone().normalize());
      const size = magnitudeSize(ev.magnitude) * radius * PING_SCALE;
      scale.set(size, size, size);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(i, matrix);

      const [r, g, b] = severityColor(ev.severity);
      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
      // Fase deterministica ben distribuita (sequenza aurea) → pulsazioni sfalsate.
      phases[i] = (i * 0.6180339887) % 1;
    }

    mesh.instanceMatrix.needsUpdate = true;
    geometry.setAttribute("aColor", new THREE.InstancedBufferAttribute(colors, 3));
    geometry.setAttribute("aPhase", new THREE.InstancedBufferAttribute(phases, 1));
  }, [events, count, radius, geometry]);

  useFrame((_, delta) => {
    material.uniforms.uTime.value += delta;
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.instanceId == null) return;
    e.stopPropagation();
    const ev = events[e.instanceId];
    if (ev) onSelect(ev.id);
  };

  if (count === 0) return null;

  return (
    <instancedMesh
      // Rimonta quando cambia il numero di eventi (args[count] è immutabile a runtime).
      key={count}
      ref={meshRef}
      args={[geometry, material, count]}
      frustumCulled={false}
      onClick={handleClick}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "auto")}
    />
  );
}
