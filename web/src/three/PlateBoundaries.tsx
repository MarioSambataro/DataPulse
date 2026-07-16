import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";

import { latLonToVec3 } from "../lib/geo";
import { useStore } from "../store/useStore";

// Dataset statico (public/geo): confini di placca PB2002 (Bird, 2003) semplificati
// a 2 decimali — ~6K punti, un solo LineSegments. Caricato pigramente al primo
// mount, così non pesa sul bundle né sul first paint.
const PLATES_URL = "geo/plate-boundaries.json";

// Poco sopra la superficie: sotto i ping evento (1.004R) ma sopra la texture.
const ALTITUDE = 1.002;

interface PlatesData {
  lines: [number, number][][];
}

let cached: PlatesData | null = null;

/**
 * Confini delle placche tettoniche come singolo `LineSegments` additivo e tenue:
 * contesto geologico che spiega la disposizione degli epicentri (gli sciami
 * seguono le faglie) senza competere visivamente con i dati.
 */
export function PlateBoundaries({ radius, daytime }: { radius: number; daytime: boolean }) {
  const showPlates = useStore((s) => s.showPlates);
  const [data, setData] = useState<PlatesData | null>(cached);

  useEffect(() => {
    if (cached || !showPlates) return;
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}${PLATES_URL}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((json: PlatesData) => {
        cached = json;
        if (!cancelled) setData(json);
      })
      .catch(() => {
        // Overlay decorativo: se il fetch fallisce semplicemente non si disegna.
      });
    return () => {
      cancelled = true;
    };
  }, [showPlates]);

  const geometry = useMemo(() => {
    if (!data) return null;
    const positions: number[] = [];
    for (const line of data.lines) {
      for (let i = 0; i < line.length - 1; i++) {
        const [lon1, lat1] = line[i];
        const [lon2, lat2] = line[i + 1];
        positions.push(...latLonToVec3(lat1, lon1, radius * ALTITUDE));
        positions.push(...latLonToVec3(lat2, lon2, radius * ALTITUDE));
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, [data, radius]);

  useEffect(() => () => geometry?.dispose(), [geometry]);

  if (!showPlates || !geometry) return null;

  return (
    <lineSegments geometry={geometry} frustumCulled={false} raycast={() => null}>
      <lineBasicMaterial
        color={daytime ? "#168b8b" : "#28c7c0"}
        transparent
        opacity={daytime ? 0.2 : 0.24}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </lineSegments>
  );
}
