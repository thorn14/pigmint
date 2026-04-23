export const VERSION = '0.0.0';

export * from './types/palette.js';
export * from './types/spec.js';
export {
  hexToOklch,
  tryParseHex,
  oklchToHex,
  sourceWithChromaToHex,
} from './math/oklch.js';
export { checkGamut, maxP3Chroma, maxSrgbChroma } from './math/gamut.js';
export {
  getRelativeLuminance,
  getWcagContrast,
  getApcaContrast,
} from './math/contrast.js';
export {
  buildChromaCurve,
  buildDefaultCurves,
  smoothCurveValues,
  computeHueShift,
  autoHueShiftBase,
  nearestPrimary,
  generateRamp,
} from './math/ramp.js';
export {
  TAILWIND_LIGHTNESS,
  buildLightnessValues,
  type LightnessPreset,
} from './presets/lightness.js';
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
  buildSurfaceResolvedValue,
  type SurfaceRole,
  type ResolveSurfaceInput,
  type ResolveSurfaceResult,
} from './resolver/surfaces.js';
export {
  resolveAll,
  DriverError,
  type ResolveAllInput,
  type ResolveAllOutput,
  type ModeBinding,
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
  type DtcgContainer,
  type DtcgColorValue,
  type EmitInput,
  type PrimitiveRamp,
  type PrimitiveToken,
  type SemanticToken,
} from './emitter/dtcg.js';
