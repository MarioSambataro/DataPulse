// Selezione in stile GIS: un halo statico e un piccolo caret identificano la
// feature senza aggiungere un secondo livello di visualizzazione sopra il dato.

import { useMemo } from "react";
import * as THREE from "three";

import { latLonToVec3 } from "../lib/geo";
import { useStore } from "../store/useStore";
import { palette } from "../theme";

const PLANE_NORMAL = new THREE.Vector3(0, 0, 1);

export function SelectionMarker({ radius, daytime }: { radius: number; daytime: boolean }) {
  const selectedId = useStore((state) => state.selectedId);
  const events = useStore((state) => state.events);

  const event = useMemo(
    () => events.find((candidate) => candidate.id === selectedId) ?? null,
    [events, selectedId],
  );

  const transform = useMemo(() => {
    if (!event) return null;
    const [x, y, z] = latLonToVec3(event.lat, event.lon, radius * 1.014);
    const position = new THREE.Vector3(x, y, z);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      PLANE_NORMAL,
      position.clone().normalize(),
    );
    return { position, quaternion };
  }, [event, radius]);

  const accent = useMemo(
    () => new THREE.Color(daytime ? "#0d9488" : palette.acid),
    [daytime],
  );
  const keyline = useMemo(
    () => new THREE.Color(daytime ? "#ecfeff" : "#061015"),
    [daytime],
  );

  if (!transform) return null;

  const r = radius * 0.032;

  return (
    <group position={transform.position} quaternion={transform.quaternion}>
      {/* Keyline neutra: garantisce contrasto su oceani, ghiaccio e luci notturne. */}
      <mesh renderOrder={20}>
        <ringGeometry args={[r * 0.77, r * 0.96, 56]} />
        <meshBasicMaterial
          color={keyline}
          transparent
          opacity={daytime ? 0.72 : 0.8}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Un solo halo brand, sottile e completamente statico. */}
      <mesh position={[0, 0, 0.001]} renderOrder={21}>
        <ringGeometry args={[r * 0.81, r * 0.89, 56]} />
        <meshBasicMaterial
          color={accent}
          transparent
          opacity={0.98}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Breve leader + caret: segnala lo stato selezionato senza sembrare un mirino. */}
      <mesh position={[0, r * 1.03, 0.002]} renderOrder={22}>
        <planeGeometry args={[r * 0.045, r * 0.28]} />
        <meshBasicMaterial color={accent} transparent opacity={0.88} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, r * 1.3, 0.002]} rotation={[0, 0, Math.PI]} renderOrder={23}>
        <circleGeometry args={[r * 0.15, 3]} />
        <meshBasicMaterial color={accent} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}
