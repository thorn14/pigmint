export const VERSION = '0.0.0';

export * from './types/palette.js';
export * from './types/spec.js';
export {
  hexToOklch,
  tryParseHex,
  oklchToHex,
  sourceWithChromaToHex,
} from './math/oklch.js';
export {
  checkGamut,
  isWithinGamut,
  maxChromaForGamut,
  maxP3Chroma,
  maxSrgbChroma,
  MAX_CHROMA,
  type GamutTarget,
} from './math/gamut.js';
export { buildGeneratedStep, type BuildGeneratedStepInput } from './math/step.js';
export {
  pinChromaCurveToGamut,
  validateRampGamut,
  type GamutOffender,
  type GamutValidation,
  type PinnedChromaCurve,
} from './math/pin-gamut.js';
export { deltaEOklch } from './math/deltaE.js';
export {
  getRelativeLuminance,
  getWcagContrast,
  getApcaContrast,
} from './math/contrast.js';
export { alphaCompositeHex, toRgbaString, toHex8 } from './math/composite.js';
export {
  resolveAlphaToken,
  defaultAlphaReferenceSurface,
  parseStepRef,
  findStepByName,
  type AlphaResolveInput,
  type AlphaResolveResult,
} from './resolver/alpha-resolve.js';
export {
  buildChromaCurve,
  buildDefaultCurves,
  smoothCurveValues,
  computeHueShift,
  autoHueShiftBase,
  nearestPrimary,
  generateRamp,
  rampStepGeometry,
  type GenerateRampOptions,
  type RampStepGeometry,
} from './math/ramp.js';
export {
  TAILWIND_LIGHTNESS,
  buildLightnessValues,
  buildLightnessFromEnds,
  type LightnessPreset,
} from './presets/lightness.js';
export {
  EASING_FAMILIES,
  EASING_VARIANTS,
  CUSTOM_CURVE_BIAS_MIN,
  CUSTOM_CURVE_BIAS_MAX,
  resolveEasingFunction,
  easingFamilyHasVariants,
  sBendEasing,
  blendEasing,
  type EasingFamily,
  type EasingVariant,
  type EasingFn,
  type ResolveEasingOptions,
} from './presets/easings.js';
export {
  TAILWIND_STEPS,
  NUMERIC_STEPS_11,
  resolveStepNames,
} from './presets/naming.js';
export {
  resolveToken,
  buildResolvedValue,
  ResolveError,
  type ResolveInput,
  type ResolveResult,
  type ThresholdElevation,
} from './resolver/resolve.js';
export {
  resolveSurface,
  resolveSurfaceByIndex,
  buildSurfaceResolvedValue,
  type SurfaceRole,
  type ResolveSurfaceInput,
  type ResolveSurfaceByIndexInput,
  type ResolveSurfaceResult,
} from './resolver/surfaces.js';
export {
  resolveAll,
  DriverError,
  type ResolveAllInput,
  type ResolveAllOutput,
  type ModeBinding,
  type SurfaceStepDecl,
} from './resolver/driver.js';
export {
  VOCABULARY_V1_VERSION,
  VOCABULARY_V1_SLICE,
  VOCABULARY_V1_DEFAULTS,
} from './defaults/vocabulary-v1.js';
export { buildDefaultTokenRamp } from './defaults/token-ramp.js';
export {
  validateAdapterAgainstConfig,
  AdapterValidationError,
  type Adapter,
  type AdapterFile,
  type AdapterInvocation,
  type AdapterManifest,
  type AdapterResult,
} from './adapter.js';
export {
  emitDtcg,
  emitPrimitives,
  type DtcgContainer,
  type DtcgColorValue,
  type EmitInput,
  type EmitPrimitivesInput,
  type PrimitiveRamp,
  type PrimitiveToken,
  type SemanticToken,
} from './emitter/dtcg.js';
export {
  validatePortableVocabulary,
  portableToVocabularyEntries,
  buildSurfacePaths,
  buildSurfaceStepMap,
  buildSemanticStepMap,
  buildTokenRampFromPortable,
  remapPortableVocabularyRamps,
  coerceTokenRampToPaletteScales,
  buildPortableArtifacts,
  PortableVocabularyError,
  type PortableVocabularyArtifacts,
} from './vocabulary/portable.js';
