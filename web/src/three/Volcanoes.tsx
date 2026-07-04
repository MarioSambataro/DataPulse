import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useState } from "react";
import * as THREE from "three";

import { EventHoverCard } from "@/components/EventHoverCard";

import { latLonToVec3 } from "../lib/geo";
import { severityColor } from "../lib/severity";
import { useStore } from "../store/useStore";
import type { Event } from "../types";
import {
  craterFragment,
  craterVertex,
  lavaPulseFragment,
  lavaThroatFragment,
  plumeFragment,
  plumeVertex,
  surfacePulseVertex,
} from "./eventShaders";

const CONE_UP = new THREE.Vector3(0, 1, 0); // asse del cratere nel suo spazio locale
const PLUME_PARTICLES = 26;

// Il colore severità viene scaldato verso l'arancio lava: i vulcani devono
// leggersi come "fuoco", non come spie di stato.
const LAVA_TINT = new THREE.Color("#ff7a2a");

/**
 * Marker singolo di un vulcano, ispirato alle reference "smoking volcano":
 * cratere tronco con orlo di lava incandescente, gola bianco-calda che respira,
 * pennacchio di braci che sale e si raffredda, onda di calore sulla superficie.
 * Tooltip al hover, click → selezione.
 */
function Volcano({
  event,
  radius,
  onSelect,
}: {
  event: Event;
  radius: number;
  onSelect: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const pauseRotation = useStore((s) => s.pauseRotation);
  const resumeRotationAfter = useStore((s) => s.resumeRotationAfter);

  const { position, quaternion, color, phase } = useMemo(() => {
    const [x, y, z] = latLonToVec3(event.lat, event.lon, radius);
    const pos = new THREE.Vector3(x, y, z);
    const quat = new THREE.Quaternion().setFromUnitVectors(CONE_UP, pos.clone().normalize());
    const [r, g, b] = severityColor(event.severity);
    const lava = new THREE.Color(r, g, b).lerp(LAVA_TINT, 0.45);
    // Fase deterministica da lat/lon → flicker e onde sfalsati tra vulcani.
    const ph = Math.abs(Math.sin(event.lat * 12.9898 + event.lon * 78.233)) % 1;
    return { position: pos, quaternion: quat, color: lava, phase: ph };
  }, [event.lat, event.lon, event.severity, radius]);

  // Proporzioni: cratere basso e largo (non uno spuntone), pennacchio ~4× il cono.
  const craterR = radius * 0.017;
  const craterH = radius * 0.028;
  const plumeH = radius * 0.11;

  const craterUniforms = useMemo(
    () => ({ uColor: { value: color.clone() }, uGlow: { value: 1 } }),
    [color],
  );
  const throatUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: color.clone() },
      uPhase: { value: phase },
      uBoost: { value: 1 },
    }),
    [color, phase],
  );
  const pulseUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: color.clone() },
      uPhase: { value: phase },
      uBoost: { value: 1 },
    }),
    [color, phase],
  );
  const plumeUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: color.clone() },
      uHeight: { value: plumeH },
      uSpread: { value: craterR * 0.9 },
      uSize: { value: 7.5 },
    }),
    [color, plumeH, craterR],
  );

  // Geometria del pennacchio: posizioni fittizie (l'animazione è nel vertex
  // shader), un seed casuale-deterministico per particella.
  const plumeGeometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const positions = new Float32Array(PLUME_PARTICLES * 3); // tutte a (0,0,0)
    const seeds = new Float32Array(PLUME_PARTICLES);
    for (let i = 0; i < PLUME_PARTICLES; i++) seeds[i] = (i * 0.6180339887) % 1;
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    // Bounding sphere manuale: le posizioni reali vivono nello shader.
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, plumeH / 2, 0), plumeH);
    return g;
  }, [plumeH]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    // Flicker "lava": due sinusoidi non armoniche → tremolio organico, mai statico.
    const flicker = 0.8 + 0.14 * Math.sin(t * 6.1 + phase * 9.4) + 0.09 * Math.sin(t * 13.7 + phase * 5.1);
    craterUniforms.uGlow.value = (hovered ? 1.5 : 1.0) * flicker;
    throatUniforms.uTime.value = t;
    throatUniforms.uBoost.value = hovered ? 1.35 : 1.0;
    pulseUniforms.uTime.value = t;
    pulseUniforms.uBoost.value = hovered ? 1.6 : 1.0;
    plumeUniforms.uTime.value = t;
  });

  return (
    <group
      position={position}
      quaternion={quaternion}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
        pauseRotation();
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "auto";
        resumeRotationAfter(1500);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(event.id);
        pauseRotation();
        resumeRotationAfter(4000);
      }}
    >
      {/* Cratere tronco: roccia scura → orlo incandescente, striato di lava. */}
      <mesh position={[0, craterH / 2, 0]}>
        <cylinderGeometry args={[craterR * 0.55, craterR, craterH, 24, 1, true]} />
        <shaderMaterial
          vertexShader={craterVertex}
          fragmentShader={craterFragment}
          uniforms={craterUniforms}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Gola di lava che chiude la bocca del cratere. */}
      <mesh position={[0, craterH, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[craterR * 0.55, 24]} />
        <shaderMaterial
          vertexShader={surfacePulseVertex}
          fragmentShader={lavaThroatFragment}
          uniforms={throatUniforms}
        />
      </mesh>
      {/* Pennacchio di braci sopra la bocca. */}
      <points position={[0, craterH, 0]} geometry={plumeGeometry} raycast={() => undefined}>
        <shaderMaterial
          vertexShader={plumeVertex}
          fragmentShader={plumeFragment}
          uniforms={plumeUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      {/* Onda di calore che si irradia dalla bocca sulla superficie. */}
      <mesh position={[0, radius * 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={craterR * 8}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          vertexShader={surfacePulseVertex}
          fragmentShader={lavaPulseFragment}
          uniforms={pulseUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* Alone caldo, morbido, alla base. */}
      <mesh position={[0, craterH * 0.5, 0]}>
        <sphereGeometry args={[craterR * 2.1, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={hovered ? 0.28 : 0.14}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {hovered && (
        // Niente distanceFactor: il callout resta a dimensione schermo fissa
        // a ogni livello di zoom (con il factor scalava fino a coprire il globo).
        <Html position={[0, craterH * 3, 0]} zIndexRange={[20, 0]} className="pointer-events-none">
          <EventHoverCard event={event} />
        </Html>
      )}
    </group>
  );
}

/** Layer dei vulcani (pochi marker → mesh individuali con hover/tooltip). */
export function Volcanoes({
  events,
  radius,
  onSelect,
}: {
  events: Event[];
  radius: number;
  onSelect: (id: string) => void;
}) {
  return (
    <group>
      {events.map((ev) => (
        <Volcano key={ev.id} event={ev} radius={radius} onSelect={onSelect} />
      ))}
    </group>
  );
}
