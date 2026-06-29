// Shader GLSL degli epicentri sismici, renderizzati con un singolo InstancedMesh
// (un quad per evento, tangente alla superficie del globo → effetto "radar ping").
// Per-istanza: aColor (gradiente severità, calcolato in JS) e aPhase (sfasamento
// dell'anello, così i ping non pulsano in sincrono). uTime è uniforme condiviso.
//
// three dichiara automaticamente `instanceMatrix` per gli InstancedMesh anche con
// ShaderMaterial; aColor/aPhase sono InstancedBufferAttribute aggiunti dal layer.

export const epicenterVertex = /* glsl */ `
  attribute vec3 aColor;
  attribute float aPhase;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vPhase;
  void main() {
    vUv = uv;
    vColor = aColor;
    vPhase = aPhase;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

export const epicenterFragment = /* glsl */ `
  precision highp float;
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vPhase;

  void main() {
    // Coordinate radiali nel quad: 0 al centro, 1 al bordo del disco.
    float r = length(vUv - 0.5) * 2.0;
    if (r > 1.0) discard;

    // Nucleo: disco pieno con bordo morbido.
    float core = smoothstep(0.34, 0.0, r);

    // Anello che si espande verso l'esterno e svanisce (radar ping).
    float t = fract(uTime * 0.6 + vPhase);
    float ring = smoothstep(0.05, 0.0, abs(r - t)) * (1.0 - t);

    float alpha = clamp(core * 0.95 + ring * 0.9, 0.0, 1.0);
    if (alpha < 0.01) discard;

    // L'anello schiarisce leggermente il colore base per dare "energia".
    vec3 col = vColor + ring * 0.35;
    gl_FragColor = vec4(col, alpha);
  }
`;
