export type {
  OklchColor,
  CurvePoints,
  CurveConfig,
  HueShiftConfig,
  StepNamingPreset,
  StepNamingConfig,
  ColorScale,
  GamutLevel,
  RgbChannels,
  GeneratedStep,
  GeneratedRamp,
  WCAGLevel,
  ContrastResult,
} from '@pigmint/core';

import type { ColorScale, PortableVocabulary } from '@pigmint/core';

export type { PortableVocabulary };

export interface ContrastMapColorRef {
  ramp: string;
  step: string;
  hex: string;
}
export interface WcagMapEntry {
  fg: ContrastMapColorRef;
  bg: ContrastMapColorRef;
  ratio: number;
}
export interface ApcaMapEntry {
  fg: ContrastMapColorRef;
  bg: ContrastMapColorRef;
  lc: number;
}

export interface SavedPalette {
  id: string;
  name: string;
  activeScaleId: string | null;
  scales: ColorScale[];
  vocab?: PortableVocabulary | null;
}

export interface PaletteState {
  scales: ColorScale[];
  activeScaleId: string | null;
  focusedStepRef: { scaleId: string; stepName: string } | null;
  srgbPreview: boolean;
  savedPalettes: SavedPalette[];
  activePaletteId: string | null;
  currentPaletteName: string;
}

export interface W3CColorValue {
  colorSpace: string;
  components: (number | 'none')[];
  alpha?: number;
  hex?: string;
}
export interface W3CTokenValue {
  $value: W3CColorValue;
  $type?: 'color';
  $description?: string;
  $extensions?: {
    oklch?: { l: number; c: number; h: number; alpha?: number };
    [k: string]: unknown;
  };
}
export type W3CTokenGroup = { [k: string]: W3CTokenValue | W3CTokenGroup };
