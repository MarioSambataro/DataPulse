// Shader GLSL del globo. Tenuti in un modulo non-componente (niente JSX) così
// il rendering React resta pulito e i sorgenti shader sono riusabili.

/**
 * Atmosfera in due passate, ispirata allo scattering reale (niente "alone neon"):
 *  - passata esterna (BackSide): banda sottile di cielo appena oltre il lembo,
 *    che decade rapidamente verso lo spazio;
 *  - passata interna (FrontSide, sul globo): velo di scattering che tinge di blu
 *    solo il bordo del disco, come nelle foto satellitari.
 * Entrambe sono modulate da uSunDir: l'atmosfera si accende sul lato illuminato
 * e quasi scompare in ombra → l'occhio la legge come fisica, non come glow.
 */
export const atmosphereVertex = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  void main() {
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

export const atmosphereFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uSunDir;
  uniform float uPower;
  uniform float uIntensity;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  void main() {
    vec3 n = normalize(vWorldNormal);
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float rim = pow(1.0 - abs(dot(viewDir, n)), uPower);
    // Terminatore morbido: piena luce sul lato sole, residuo minimo in ombra.
    float day = smoothstep(-0.35, 0.45, dot(n, uSunDir));
    float a = rim * uIntensity * mix(0.05, 1.0, day);
    gl_FragColor = vec4(uColor * a, a);
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
