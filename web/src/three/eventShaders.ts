// GLSL shaders for globe events, light columns, pulses, and volcanic effects.
// Kept in a non-component module like shaders.ts.
//
// Epicentres use one surface-tangent quad per event with per-instance color,
// pulse phase, and normalized magnitude attributes.
// Three.js automatically declares instanceMatrix for InstancedMesh materials.
// Layer-specific extras are supplied as InstancedBufferAttributes.

export const epicenterVertex = /* glsl */ `
  attribute vec3 aColor;
  attribute float aPhase;
  attribute float aMag;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vPhase;
  varying float vMag;
  void main() {
    vUv = uv;
    vColor = aColor;
    vPhase = aPhase;
    vMag = aMag;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

export const epicenterFragment = /* glsl */ `
  precision highp float;
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vPhase;
  varying float vMag;

  // Shockwave with a sharp outward front and a fading, energy-decaying trail.
  float shockwave(float r, float t) {
    float d = r - t;
    float lead = smoothstep(0.025, 0.0, d);
    float tail = smoothstep(-0.28, -0.03, d);
    return lead * tail * pow(1.0 - t, 1.6);
  }

  void main() {
    // Radial quad coordinates run from zero at center to one at the edge.
    float r = length(vUv - 0.5) * 2.0;
    if (r > 1.0) discard;

    // A hotter white core makes strong red events salient and color-vision accessible.
    float core = smoothstep(0.30, 0.0, r);
    float hot = smoothstep(0.16, 0.0, r);

    // Two half-period-offset waves; stronger events pulse faster.
    float speed = mix(0.45, 0.85, vMag);
    float waves = shockwave(r, fract(uTime * speed + vPhase))
                + shockwave(r, fract(uTime * speed + vPhase + 0.5)) * 0.55;

    // A subtle static target ring becomes clearer for strong events.
    float target = (1.0 - min(abs(r - 0.62) / 0.014, 1.0)) * (0.10 + 0.22 * vMag);

    // A soft halo visually anchors the ping to the surface.
    float glow = smoothstep(0.85, 0.0, r) * (0.05 + 0.10 * vMag);

    float alpha = clamp(core * 0.95 + waves * 0.85 + target + glow, 0.0, 1.0);
    if (alpha < 0.012) discard;

    vec3 col = mix(vColor, vec3(1.0), hot * (0.55 + 0.35 * vMag));
    col += waves * 0.4;
    gl_FragColor = vec4(col, alpha);
  }
`;

// Strong-earthquake surface shockwaves use much larger instanced quads.
// Slow concentric rings expand from each epicentre. The vertex shader projects
// every quad vertex back onto the sphere.
// Vertex projection keeps rings on the curved surface instead of a tangent plane.
export const shockwaveVertex = /* glsl */ `
  attribute vec3 aColor;
  attribute float aPhase;
  attribute float aMag;
  uniform float uSurface;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vPhase;
  varying float vMag;
  void main() {
    vUv = uv;
    vColor = aColor;
    vPhase = aPhase;
    vMag = aMag;
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    wp.xyz = normalize(wp.xyz) * uSurface; // Wrap the quad onto the surface.
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

export const shockwaveFragment = /* glsl */ `
  precision highp float;
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vPhase;
  varying float vMag;

  // Fronte d'onda: anello che si allarga e si dissipa espandendosi.
  float ring(float r, float t) {
    float w = 0.02 + 0.10 * t; // The front diffuses as it travels.
    float d = abs(r - t);
    return smoothstep(w, 0.0, d) * pow(max(1.0 - t, 0.0), 1.8);
  }

  void main() {
    float r = length(vUv - 0.5) * 2.0;
    if (r > 1.0) discard;

    // Three staggered fronts; stronger events propagate faster.
    float speed = mix(0.10, 0.16, vMag);
    float waves = ring(r, fract(uTime * speed + vPhase))
                + ring(r, fract(uTime * speed + vPhase + 0.333)) * 0.7
                + ring(r, fract(uTime * speed + vPhase + 0.666)) * 0.45;

    float alpha = waves * (0.26 + 0.34 * vMag);
    if (alpha < 0.01) discard;

    vec3 col = mix(vColor, vec3(1.0), 0.25);
    gl_FragColor = vec4(col * alpha, alpha); // Additive black stays transparent.
  }
`;

// Light columns use instanced tapered cylinders rooted on the surface.
// Additive columns glow at the base, fade at the top, and soften at the edge.
// Fresnel softens the cylinder silhouette.
export const beamVertex = /* glsl */ `
  attribute vec3 aColor;
  attribute float aPhase;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vPhase;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vUv = uv;
    vColor = aColor;
    vPhase = aPhase;
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * mat3(instanceMatrix) * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

export const beamFragment = /* glsl */ `
  precision highp float;
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vPhase;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    // CylinderGeometry uv.y runs from solid base to faded top.
    float fade = pow(1.0 - vUv.y, 1.7);
    // Inverse Fresnel suppresses hard cylinder silhouette edges.
    float soft = smoothstep(0.0, 0.6, abs(dot(vView, vNormal)));
    // Slow breathing offset per instance.
    float breathe = 0.75 + 0.25 * sin(uTime * 2.4 + vPhase * 6.2832);
    float alpha = fade * soft * breathe * 0.55;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(vColor + fade * 0.3, alpha);
  }
`;

// Volcanic crater: dark truncated cone fading into a glowing lava rim with
// vertical incandescent channels and flicker.
// Marker animation supplies uGlow every frame.
export const craterVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const craterFragment = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  uniform float uGlow;
  varying vec2 vUv;
  void main() {
    // CylinderGeometry uv.y runs from base to rim for the heat gradient.
    float heat = pow(vUv.y, 2.4);
    // Vertical lava channels run down the slopes.
    float streak = pow(0.5 + 0.5 * sin(vUv.x * 47.0), 6.0);
    vec3 rock = vec3(0.05, 0.045, 0.05);
    vec3 col = rock + uColor * heat * (0.9 + streak * 0.9) * uGlow;
    gl_FragColor = vec4(col, 1.0);
  }
`;

// Lava throat disk with a white-hot center closing the crater opening.
// The core fades into event color toward the edge with a slow breathing motion.
export const lavaThroatFragment = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uPhase;
  uniform float uBoost;
  varying vec2 vUv;
  void main() {
    float r = length(vUv - 0.5) * 2.0;
    float breathe = 0.82 + 0.18 * sin(uTime * 2.1 + uPhase * 6.2832);
    vec3 col = mix(vec3(1.0, 0.95, 0.8), uColor, smoothstep(0.0, 1.0, r));
    gl_FragColor = vec4(col * breathe * uBoost, 1.0);
  }
`;

// Ember plume above the crater. Deterministic particle animation lives entirely
// in the vertex shader using uTime and aSeed.
// salgono, si allargano a spirale, si raffreddano e svaniscono.
export const plumeVertex = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uHeight;
  uniform float uSpread;
  uniform float uSize;
  varying float vLife;
  void main() {
    float speed = 0.10 + 0.08 * fract(aSeed * 7.31);
    float life = fract(uTime * speed + aSeed);
    float ang = aSeed * 6.2832 + uTime * 0.25;
    float spread = uSpread * mix(0.2, 1.0, life);
    vec3 p = vec3(cos(ang) * spread, life * uHeight, sin(ang) * spread);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = uSize * mix(1.0, 0.4, life) * (4.6 / -mv.z);
    vLife = life;
    gl_Position = projectionMatrix * mv;
  }
`;

export const plumeFragment = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  varying float vLife;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float alpha = smoothstep(1.0, 0.2, d) * smoothstep(0.0, 0.12, vLife) * (1.0 - vLife) * 0.85;
    if (alpha < 0.02) discard;
    // Embers start white-hot and cool toward the event color.
    float hot = 1.0 - vLife;
    vec3 col = mix(uColor * 0.55, vec3(1.0, 0.92, 0.72), hot * hot);
    gl_FragColor = vec4(col, alpha);
  }
`;

// Volcanic pulse: surface-tangent quad with waves beneath the cone.
// Crater waves reuse the seismic visual language at a slower, warmer cadence.
export const surfacePulseVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const lavaPulseFragment = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uPhase;
  uniform float uBoost;
  varying vec2 vUv;

  float shockwave(float r, float t) {
    float d = r - t;
    float lead = smoothstep(0.03, 0.0, d);
    float tail = smoothstep(-0.30, -0.04, d);
    return lead * tail * pow(1.0 - t, 1.5);
  }

  void main() {
    float r = length(vUv - 0.5) * 2.0;
    if (r > 1.0) discard;

    float waves = shockwave(r, fract(uTime * 0.30 + uPhase))
                + shockwave(r, fract(uTime * 0.30 + uPhase + 0.5)) * 0.6;
    float glow = smoothstep(0.30, 0.0, r) * 0.30;

    float alpha = clamp(waves * 0.55 + glow, 0.0, 1.0) * uBoost;
    if (alpha < 0.012) discard;

    vec3 col = mix(uColor, vec3(1.0, 0.85, 0.62), waves * 0.35);
    gl_FragColor = vec4(col, alpha);
  }
`;
