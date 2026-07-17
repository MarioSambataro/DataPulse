import { Bloom, EffectComposer, Noise, ToneMapping, Vignette } from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode } from "postprocessing";

/**
 * Cinematic post-processing chain:
 *  - HDR bloom before tone mapping affects only high-intensity scene elements;
 *  - ACES tone mapping replaces renderer mapping after HDR composition.
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
