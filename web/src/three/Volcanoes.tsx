import { Html } from "@react-three/drei";
import { useMemo, useState } from "react";
import * as THREE from "three";

import { latLonToVec3 } from "../lib/geo";
import { severityColor } from "../lib/severity";
import type { Event } from "../types";

const CONE_UP = new THREE.Vector3(0, 1, 0); // asse del cono nel suo spazio locale

/** Marker singolo di un vulcano: cono che spunta dalla superficie + alone, tooltip al hover. */
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

  const { position, quaternion, color } = useMemo(() => {
    const [x, y, z] = latLonToVec3(event.lat, event.lon, radius);
    const pos = new THREE.Vector3(x, y, z);
    const quat = new THREE.Quaternion().setFromUnitVectors(CONE_UP, pos.clone().normalize());
    const [r, g, b] = severityColor(event.severity);
    return { position: pos, quaternion: quat, color: new THREE.Color(r, g, b) };
  }, [event.lat, event.lon, event.severity, radius]);

  const coneR = radius * 0.013;
  const coneH = radius * 0.045;

  return (
    <group
      position={position}
      quaternion={quaternion}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(event.id);
      }}
    >
      {/* Cono che esce radialmente dalla superficie. Auto-illuminato (color nero +
          emissive) così resta del suo colore in qualsiasi vista, senza sbiancare
          sotto la luce direzionale. */}
      <mesh position={[0, coneH / 2, 0]}>
        <coneGeometry args={[coneR, coneH, 5]} />
        <meshStandardMaterial
          color="#000000"
          emissive={color}
          emissiveIntensity={hovered ? 2.6 : 1.7}
          roughness={0.5}
          metalness={0}
          toneMapped={false}
        />
      </mesh>
      {/* Alone caldo additivo alla base. */}
      <mesh>
        <sphereGeometry args={[coneR * 2.4, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={hovered ? 0.35 : 0.2}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {hovered && (
        <Html position={[0, coneH * 2.2, 0]} center distanceFactor={6} zIndexRange={[20, 0]}>
          <div className="volcano-tip">
            <span className="vt-name">{event.title}</span>
            {event.place && <span className="vt-place">{event.place}</span>}
          </div>
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
