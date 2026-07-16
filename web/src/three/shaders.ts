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
    float NdotS = dot(n, uSunDir);
    // Terminatore morbido: piena luce sul lato sole, residuo minimo in ombra.
    float day = smoothstep(-0.35, 0.45, NdotS);
    // Fascia crepuscolare: vicino al terminatore l'alone vira al caldo
    // (scattering di Rayleigh "fake": alba/tramonto visti dallo spazio).
    float twilight = 1.0 - smoothstep(0.0, 0.45, abs(NdotS));
    vec3 col = mix(uColor, vec3(1.0, 0.55, 0.34), twilight * 0.55);
    float a = rim * uIntensity * mix(0.05, 1.0, day);
    gl_FragColor = vec4(col * a, a);
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

/** Surface shader: real maps fused with a sun-aligned terminator and city light emission. */
export const earthVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

export const earthFragment = /* glsl */ `
  uniform sampler2D uDayMap;
  uniform sampler2D uNightMap;
  uniform vec3 uSunDir;
  uniform float uNightMode;
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  void main() {
    vec3 normal = normalize(vWorldNormal);
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float NdotL = dot(normal, normalize(uSunDir));
    float daylight = smoothstep(-0.16, 0.28, NdotL);
    float nightness = 1.0 - smoothstep(-0.34, 0.08, NdotL);
    float twilight = 1.0 - smoothstep(0.0, 0.32, abs(NdotL));

    vec3 dayMap = texture2D(uDayMap, vUv).rgb;
    vec3 nightMap = texture2D(uNightMap, vUv).rgb;
    vec3 daylightColor = pow(dayMap, vec3(0.92));
    daylightColor = mix(daylightColor * vec3(0.62, 0.79, 1.12), daylightColor, 0.68);
    vec3 shadowColor = dayMap * vec3(0.055, 0.10, 0.18);
    float cityMask = smoothstep(0.035, 0.30, max(max(nightMap.r, nightMap.g), nightMap.b));
    vec3 cityGlow = mix(vec3(0.35, 0.72, 1.35), vec3(1.8, 0.48, 0.10), nightMap.r);
    cityGlow *= cityMask * (0.45 + nightMap * 1.7);

    vec3 surface = mix(shadowColor, daylightColor, daylight);
    surface += cityGlow * nightness * mix(1.0, 1.55, uNightMode);
    surface += vec3(0.34, 0.075, 0.018) * twilight * (0.10 + 0.25 * nightness);
    float rim = pow(1.0 - max(dot(viewDir, normal), 0.0), 4.5);
    surface += vec3(0.025, 0.10, 0.20) * rim * 0.48;
    gl_FragColor = vec4(surface, 1.0);
  }
`;
