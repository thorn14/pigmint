export interface OklchColor {
  l: number;
  c: number;
  h: number;
  alpha?: number;
}

export interface CurvePoints {
  values: number[];
  nodeTypes?: ('smooth' | 'corner')[];
  smoothing?: number;
}

export interface CurveConfig {
  lightness: CurvePoints;
  chroma: CurvePoints;
  hue: CurvePoints;
}

export interface HueShiftConfig {
  lightEndAdjust: number;
  darkEndAdjust: number;
}

export type StepNamingPreset = 'tailwind' | 'numeric' | 'custom';

export interface StepNamingConfig {
  preset: StepNamingPreset;
  customNames?: string[];
}

export interface ColorScale {
  id: string;
  name: string;
  sourceHex: string;
  sourceOklch: OklchColor;
  sourceAlpha: number;
  stepCount: number;
  naming: StepNamingConfig;
  curves: CurveConfig;
  hueShift: HueShiftConfig;
  lightnessPreset: string;
  chromaPeak: number;
  chromaLow?: number;
  chromaHigh?: number;
  lockedFromOverrides?: boolean;
}

export type GamutLevel = 'srgb' | 'p3' | 'out';

export interface RgbChannels {
  r: number;
  g: number;
  b: number;
}

export interface GeneratedStep {
  name: string;
  oklch: OklchColor;
  hex: string;
  srgb: RgbChannels;
  p3?: RgbChannels;
  displayP3?: string;
  relativeLuminance: number;
  gamut: GamutLevel;
  maxSrgbC: number;
}

export interface GeneratedRamp {
  scaleId: string;
  scaleName: string;
  steps: GeneratedStep[];
}

export type WCAGLevel = 'AAA' | 'AA' | 'AA-large' | 'fail';

export interface ContrastResult {
  ratio: number;
  level: WCAGLevel;
}

export type ContrastMode = 'wcag' | 'apca';
