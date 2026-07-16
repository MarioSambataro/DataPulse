// Shader GLSL dei layer evento sul globo (epicentri, colonne di luce, pulsazioni
// vulcaniche). Tenuti in un modulo non-componente come shaders.ts.
//
// Epicentri: singolo InstancedMesh (un quad per evento, tangente alla superficie).
// Per-istanza: aColor (gradiente severità), aPhase (sfasamento pulsazione),
// aMag (magnitudo normalizzata 0..1 → velocità onda e "calore" del nucleo).
// three dichiara automaticamente `instanceMatrix` per gli InstancedMesh anche con
// ShaderMaterial; gli attributi extra sono InstancedBufferAttribute dei layer.

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

  // Onda d'urto: fronte netto verso l'esterno + scia che sfuma dietro,
  // con energia decrescente man mano che si espande.
  float shockwave(float r, float t) {
    float d = r - t;
    float lead = smoothstep(0.025, 0.0, d);
    float tail = smoothstep(-0.28, -0.03, d);
    return lead * tail * pow(1.0 - t, 1.6);
  }

  void main() {
    // Coordinate radiali nel quad: 0 al centro, 1 al bordo del disco.
    float r = length(vUv - 0.5) * 2.0;
    if (r > 1.0) discard;

    // Nucleo: disco con centro bianco-caldo. Il rosso "alto" è meno luminoso
    // dell'ambra, quindi la salienza dei forti la garantisce il nucleo: più
    // magnitudo → più bianco (leggibile anche per CVD, insieme alla dimensione).
    float core = smoothstep(0.30, 0.0, r);
    float hot = smoothstep(0.16, 0.0, r);

    // Doppia onda sfalsata di mezzo periodo; i forti pulsano più veloci.
    float speed = mix(0.45, 0.85, vMag);
    float waves = shockwave(r, fract(uTime * speed + vPhase))
                + shockwave(r, fract(uTime * speed + vPhase + 0.5)) * 0.55;

    // Anello statico di "bersaglio", appena percettibile (più marcato sui forti).
    float target = (1.0 - min(abs(r - 0.62) / 0.014, 1.0)) * (0.10 + 0.22 * vMag);

    // Alone morbido che incolla il ping alla superficie.
    float glow = smoothstep(0.85, 0.0, r) * (0.05 + 0.10 * vMag);

    float alpha = clamp(core * 0.95 + waves * 0.85 + target + glow, 0.0, 1.0);
    if (alpha < 0.012) discard;

    vec3 col = mix(vColor, vec3(1.0), hot * (0.55 + 0.35 * vMag));
    col += waves * 0.4;
    gl_FragColor = vec4(col, alpha);
  }
`;

// Onde d'urto di superficie per i sismi forti: quad istanziati molto più larghi
// dei ping, con anelli concentrici lenti che si espandono dall'epicentro. Il
// vertex shader riavvolge il quad sulla sfera (proietta ogni vertice a raggio
// costante) così gli anelli abbracciano la curvatura invece di fluttuare
// tangenti; uSurface è il raggio di appoggio (globo + epsilon).
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
    wp.xyz = normalize(wp.xyz) * uSurface; // avvolge il quad sulla superficie
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
    float w = 0.02 + 0.10 * t; // il fronte si sfrangia man mano che viaggia
    float d = abs(r - t);
    return smoothstep(w, 0.0, d) * pow(max(1.0 - t, 0.0), 1.8);
  }

  void main() {
    float r = length(vUv - 0.5) * 2.0;
    if (r > 1.0) discard;

    // Tre fronti sfalsati di un terzo di periodo; i forti si propagano più in fretta.
    float speed = mix(0.10, 0.16, vMag);
    float waves = ring(r, fract(uTime * speed + vPhase))
                + ring(r, fract(uTime * speed + vPhase + 0.333)) * 0.7
                + ring(r, fract(uTime * speed + vPhase + 0.666)) * 0.45;

    float alpha = waves * (0.26 + 0.34 * vMag);
    if (alpha < 0.01) discard;

    vec3 col = mix(vColor, vec3(1.0), 0.25);
    gl_FragColor = vec4(col * alpha, alpha); // additive: il nero non sporca
  }
`;

// Colonne di luce (InstancedMesh di cilindri rastremati, base sulla superficie).
// Additive, luminose alla base e trasparenti in cima; il bordo si ammorbidisce
// con un fresnel così il cilindro non mostra la silhouette dura.
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
    // uv.y: 0 alla base, 1 in cima (CylinderGeometry) → base piena, cima svanita.
    float fade = pow(1.0 - vUv.y, 1.7);
    // Fresnel inverso: spegne i bordi della silhouette del cilindro.
    float soft = smoothstep(0.0, 0.6, abs(dot(vView, vNormal)));
    // Respiro lento sfalsato per istanza.
    float breathe = 0.75 + 0.25 * sin(uTime * 2.4 + vPhase * 6.2832);
    float alpha = fade * soft * breathe * 0.55;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(vColor + fade * 0.3, alpha);
  }
`;

// Cratere vulcanico: cono tronco con roccia scura alla base che sfuma in un
// orlo di lava incandescente, striato da canali verticali luminosi. Il flicker
// arriva via uniform uGlow (aggiornato dal useFrame del marker).
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
    // uv.y: 0 alla base, 1 all'orlo (CylinderGeometry) → gradiente di calore.
    float heat = pow(vUv.y, 2.4);
    // Canali di lava verticali lungo i fianchi.
    float streak = pow(0.5 + 0.5 * sin(vUv.x * 47.0), 6.0);
    vec3 rock = vec3(0.05, 0.045, 0.05);
    vec3 col = rock + uColor * heat * (0.9 + streak * 0.9) * uGlow;
    gl_FragColor = vec4(col, 1.0);
  }
`;

// Gola di lava: disco che chiude la bocca del cratere, bianco-caldo al centro
// che sfuma nel colore dell'evento verso l'orlo, con lento respiro.
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

// Pennacchio di braci: THREE.Points sopra il cratere. Tutta l'animazione vive
// nel vertex shader (loop deterministico da uTime + aSeed): le particelle
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
    // Brace: bianco-caldo appena emessa, si raffredda verso il colore evento.
    float hot = 1.0 - vLife;
    vec3 col = mix(uColor * 0.55, vec3(1.0, 0.92, 0.72), hot * hot);
    gl_FragColor = vec4(col, alpha);
  }
`;

// Pulsazione vulcanica: quad tangente alla superficie sotto il cono, con onde
// che si irradiano dalla bocca (stesso linguaggio visivo dei ping sismici ma
// più lento e caldo). Una istanza per vulcano → uniforms per-materiale.
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
