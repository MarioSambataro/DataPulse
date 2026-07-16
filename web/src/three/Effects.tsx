import { Bloom, EffectComposer, Noise, ToneMapping, Vignette } from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode } from "postprocessing";

/**
 * Catena di post-processing "cinematografica":
 *  - Bloom in HDR (prima del tone mapping): fa irradiare solo ciò che supera la
 *    soglia — luci città, colonne di luce, nuclei dei ping, riflessi diurni —
 *    senza velare il resto della scena;
 *  - ToneMapping ACES: sostituisce quello del renderer (l'EffectComposer lo
 *    disabilita per lavorare in HDR);
 *  - Vignette + grana leggerissima: look da monitor da sala operativa.
 */
export function Effects({ daytime = false }: { daytime?: boolean }) {
  return (
    <EffectComposer multisampling={4}>
      <Bloom
        intensity={daytime ? 0.22 : 0.82}
        luminanceThreshold={daytime ? 1.3 : 0.88}
        luminanceSmoothing={daytime ? 0.5 : 0.24}
        mipmapBlur
        radius={daytime ? 0.38 : 0.52}
      />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette eskil={false} offset={daytime ? 0.48 : 0.3} darkness={daytime ? 0.035 : 0.48} />
      <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={daytime ? 0.008 : 0.022} />
    </EffectComposer>
  );
}
