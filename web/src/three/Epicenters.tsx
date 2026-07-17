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

// Visual ping scale balances readability with nearby-event separation.
const PING_SCALE = 2.4;

// Events above this magnitude also receive a vertical light column.
// Strong events remain legible from a distance and at oblique angles.
const BEAM_MIN_MAG = 5;
const MAG_MAX = 8;

const PLANE_NORMAL = new THREE.Vector3(0, 0, 1); // Local PlaneGeometry normal.

/**
 * Seismic epicentres rendered as one surface-tangent InstancedMesh. Severity drives
 * color, magnitude drives size and pulse speed, and strong events receive beams.
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
  // Track the hovered instance for its tooltip.
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
        toneMapped: false, // Preserve vivid pings over night city lights.
        blending: THREE.NormalBlending,
      }),
    [],
  );

  // Populate per-instance transforms, severity colors, and ring phases.
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
      // Orient each quad tangent to the surface along the radial normal.
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

  // Strong-event beam dimensions grow with magnitude and reuse the ping color.
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
    // Keep the globe still briefly after selecting an epicentre.
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
        // Remount when the immutable instance count changes.
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
