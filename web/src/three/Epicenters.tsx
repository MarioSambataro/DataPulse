import { Html } from "@react-three/drei";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { EventHoverCard } from "@/components/EventHoverCard";

import { latLonToVec3 } from "../lib/geo";
import { magnitudeSize, severityColor } from "../lib/severity";
import { useStore } from "../store/useStore";
import type { Event } from "../types";
import { Beams, type BeamSpec } from "./Beams";
import { epicenterFragment, epicenterVertex } from "./eventShaders";

// Fattore di scala visivo dei ping rispetto alla dimensione "fisica" da magnitudo,
// per renderli ben leggibili sul globo senza coprire i vicini.
const PING_SCALE = 2.4;

// Sopra questa magnitudo l'evento ha anche una colonna di luce verticale:
// i sismi forti si leggono a colpo d'occhio anche da lontano/di profilo.
const BEAM_MIN_MAG = 5;
const MAG_MAX = 8;

const PLANE_NORMAL = new THREE.Vector3(0, 0, 1); // normale del PlaneGeometry locale

/**
 * Epicentri sismici come singolo InstancedMesh (un quad "shockwave" per evento,
 * tangente alla superficie). Colore = gradiente severità, dimensione = magnitudo,
 * doppia onda pulsante via shader (più veloce e più "bianca" sui forti); i sismi
 * M≥5 hanno anche una colonna di luce. Click → selezione dell'evento.
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
  const pauseRotation = useStore((s) => s.pauseRotation);
  const resumeRotationAfter = useStore((s) => s.resumeRotationAfter);
  // Indice dell'istanza sotto il puntatore (tooltip hover, come per i vulcani).
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

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
    const mags = new Float32Array(count);

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
      mags[i] = Math.min(MAG_MAX, Math.max(0, ev.magnitude ?? 0)) / MAG_MAX;
    }

    mesh.instanceMatrix.needsUpdate = true;
    geometry.setAttribute("aColor", new THREE.InstancedBufferAttribute(colors, 3));
    geometry.setAttribute("aPhase", new THREE.InstancedBufferAttribute(phases, 1));
    geometry.setAttribute("aMag", new THREE.InstancedBufferAttribute(mags, 1));
  }, [events, count, radius, geometry]);

  // Colonne di luce solo per i sismi forti: altezza e larghezza crescono con
  // la magnitudo, colore identico al ping (il colore segue l'entità).
  const beams = useMemo<BeamSpec[]>(
    () =>
      events
        .filter((ev) => (ev.magnitude ?? 0) >= BEAM_MIN_MAG)
        .map((ev) => {
          const m = Math.min(MAG_MAX, ev.magnitude ?? 0);
          const t = (m - BEAM_MIN_MAG) / (MAG_MAX - BEAM_MIN_MAG);
          return {
            lat: ev.lat,
            lon: ev.lon,
            color: severityColor(ev.severity),
            height: radius * (0.09 + t * 0.26),
            width: magnitudeSize(m) * radius * 0.5,
          };
        }),
    [events, radius],
  );

  useFrame((_, delta) => {
    material.uniforms.uTime.value += delta;
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.instanceId == null) return;
    e.stopPropagation();
    const ev = events[e.instanceId];
    if (ev) onSelect(ev.id);
    // Click su un epicentro: tieni fermo il globo un attimo più a lungo.
    pauseRotation();
    resumeRotationAfter(4000);
  };

  if (count === 0) return null;

  const hoveredEvent = hoveredIdx != null ? events[hoveredIdx] : null;
  const hoveredPos = hoveredEvent
    ? latLonToVec3(hoveredEvent.lat, hoveredEvent.lon, radius * 1.015)
    : null;

  return (
    <group>
      <instancedMesh
        // Rimonta quando cambia il numero di eventi (args[count] è immutabile a runtime).
        key={count}
        ref={meshRef}
        args={[geometry, material, count]}
        frustumCulled={false}
        onClick={handleClick}
        onPointerMove={(e) => {
          if (e.instanceId != null) setHoveredIdx(e.instanceId);
        }}
        onPointerOver={() => {
          document.body.style.cursor = "pointer";
          pauseRotation();
        }}
        onPointerOut={() => {
          setHoveredIdx(null);
          document.body.style.cursor = "auto";
          resumeRotationAfter(1500);
        }}
      />
      {hoveredEvent && hoveredPos && (
        // Dimensione schermo fissa (niente distanceFactor), vedi EventHoverCard.
        <Html
          position={hoveredPos}
          zIndexRange={[20, 0]}
          className="pointer-events-none"
        >
          <EventHoverCard event={hoveredEvent} />
        </Html>
      )}
      <Beams beams={beams} radius={radius} />
    </group>
  );
}
