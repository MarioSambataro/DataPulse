// Evidenzia l'evento selezionato sul globo: un reticolo ad anello che pulsa,
// tangente alla superficie nel punto dell'evento. Legge selectedId/events dallo
// store → reagisce sia al click sul globo sia al click nel ticker/DetailPanel.

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import { latLonToVec3 } from "../lib/geo";
import { useStore } from "../store/useStore";
import { palette } from "../theme";

const PLANE_NORMAL = new THREE.Vector3(0, 0, 1);

export function SelectionMarker({ radius }: { radius: number }) {
  const selectedId = useStore((s) => s.selectedId);
  const events = useStore((s) => s.events);
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const ticksRef = useRef<THREE.Group>(null);
  const arcsRef = useRef<THREE.Group>(null);

  const event = useMemo(
    () => events.find((e) => e.id === selectedId) ?? null,
    [events, selectedId],
  );

  const transform = useMemo(() => {
    if (!event) return null;
    const [x, y, z] = latLonToVec3(event.lat, event.lon, radius * 1.012);
    const position = new THREE.Vector3(x, y, z);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      PLANE_NORMAL,
      position.clone().normalize(),
    );
    return { position, quaternion };
  }, [event, radius]);

  useFrame((state) => {
    if (!groupRef.current || !matRef.current) return;
    const t = state.clock.elapsedTime;
    const pulse = 1 + 0.18 * Math.sin(t * 3.2);
    groupRef.current.scale.setScalar(pulse);
    matRef.current.opacity = 0.55 + 0.35 * (0.5 + 0.5 * Math.sin(t * 3.2));
    // Rotazioni contrapposte (nel piano tangente) → reticolo "vivo" stile HUD.
    if (ticksRef.current) ticksRef.current.rotation.z = t * 0.5;
    if (arcsRef.current) arcsRef.current.rotation.z = -t * 0.3;
  });

  if (!transform) return null;

  const r = radius * 0.07;

  return (
    <group ref={groupRef} position={transform.position} quaternion={transform.quaternion}>
      {/* Anello principale */}
      <mesh ref={ringRef}>
        <ringGeometry args={[r, r * 1.16, 56]} />
        <meshBasicMaterial
          ref={matRef}
          color={palette.acid}
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {/* Quattro tacche del mirino, in lenta rotazione */}
      <group ref={ticksRef}>
        {[0, 90, 180, 270].map((deg) => {
          const a = (deg * Math.PI) / 180;
          return (
            <mesh key={deg} position={[Math.cos(a) * r * 1.35, Math.sin(a) * r * 1.35, 0]} rotation={[0, 0, a]}>
              <planeGeometry args={[r * 0.5, r * 0.06]} />
              <meshBasicMaterial
                color={palette.acid}
                transparent
                opacity={0.7}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
          );
        })}
      </group>
      {/* Tre archi ambra esterni, controrotanti (HUD a due toni) */}
      <group ref={arcsRef}>
        {[0, 120, 240].map((deg) => (
          <mesh key={deg} rotation={[0, 0, (deg * Math.PI) / 180]}>
            <ringGeometry args={[r * 1.55, r * 1.61, 40, 1, 0, Math.PI * 0.42]} />
            <meshBasicMaterial
              color={palette.signal}
              transparent
              opacity={0.55}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}
