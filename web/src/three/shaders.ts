// Shader GLSL del globo. Tenuti in un modulo non-componente (niente JSX) così
// il rendering React resta pulito e i sorgenti shader sono riusabili.

/**
 * Atmosfera fresnel: sfera leggermente più grande, renderizzata sul BackSide con
 * blending additivo. Il bordo (dove la normale è perpendicolare alla vista) si
 * illumina → alone luminoso attorno al pianeta.
 */
export const atmosphereVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

export const atmosphereFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uPower;
  uniform float uIntensity;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float fresnel = pow(1.0 - abs(dot(vView, vNormal)), uPower);
    gl_FragColor = vec4(uColor, fresnel * uIntensity);
  }
`;

/**
 * Griglia tattica lat/lon procedurale, disegnata su una sfera appena sopra la
 * superficie con blending additivo. Linee sottili anti-aliasate via fwidth +
 * leggero fresnel per spegnere la griglia sul lembo (look HUD).
 */
export const gridVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

export const gridFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uLat;     // numero di paralleli
  uniform float uLon;     // numero di meridiani
  uniform float uOpacity;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;

  float line(float coord, float repeat) {
    float g = abs(fract(coord * repeat - 0.5) - 0.5) / fwidth(coord * repeat);
    return 1.0 - min(g, 1.0);
  }

  void main() {
    float grid = max(line(vUv.y, uLat), line(vUv.x, uLon));
    float rim = 0.35 + 0.65 * abs(dot(vView, vNormal)); // attenua sul lembo
    float a = grid * uOpacity * rim;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;
