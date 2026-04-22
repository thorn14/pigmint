import {
  buildDefaultTokenRamp,
  generateRamp,
  resolveAll,
  VOCABULARY_V1_SLICE,
  type GeneratedRamp,
  type IntentOverride as CoreIntentOverride,
  type ModeBinding,
  type ProjectConfig,
  type ResolvedToken,
  type VocabularyEntry,
} from '@pigmint/core';
import type { EngineMode } from '../store/intentStore';
import type { ColorScale } from '../types/palette';

const MODE_SCHEMES: Record<EngineMode, 'light' | 'dark'> = {
  light: 'light',
  dark: 'dark',
  'light-high-contrast': 'light',
  'dark-high-contrast': 'dark',
};

const MODE_BASELINES: Record<EngineMode, string> = {
  light: '#ffffff',
  dark: '#0a0a0a',
  'light-high-contrast': '#ffffff',
  'dark-high-contrast': '#000000',
};

export function buildTokenRamp(
  vocabulary: VocabularyEntry[],
  rampNames: string[],
): Record<string, string> {
  return buildDefaultTokenRamp(vocabulary, rampNames);
}

export interface ResolutionSuccess {
  ok: true;
  tokens: ResolvedToken[];
  ramps: GeneratedRamp[];
  vocabulary: VocabularyEntry[];
}

export interface ResolutionFailure {
  ok: false;
  error: string;
}

export type ResolutionState = ResolutionSuccess | ResolutionFailure;

export function runResolve(
  scales: ColorScale[],
  engineModes: EngineMode[],
  engineTarget: 'AA' | 'AAA',
  intents: Record<string, CoreIntentOverride>,
): ResolutionState {
  if (scales.length === 0) {
    return { ok: false, error: 'Add at least one ramp in Edit mode to see resolved surface pairs.' };
  }
  let ramps: GeneratedRamp[];
  try {
    ramps = scales.map((s) => generateRamp(s));
  } catch (err) {
    return { ok: false, error: `Ramp generation failed: ${(err as Error).message}` };
  }
  const vocabulary = VOCABULARY_V1_SLICE;
  const tokenRamp = buildTokenRamp(vocabulary, ramps.map((r) => r.scaleName));
  if (Object.keys(tokenRamp).length === 0) {
    return { ok: false, error: 'Could not derive a token → ramp mapping; ramps are empty.' };
  }
  const modes: ModeBinding[] = engineModes.map((mode) => ({
    mode,
    scheme: MODE_SCHEMES[mode],
    baselineHex: MODE_BASELINES[mode],
  }));
  const config: ProjectConfig = {
    engine: {
      compliance: 'wcag21',
      target: engineTarget,
      modes: engineModes,
    },
    ramps: scales.map((s) => ({ name: s.name, source: s.sourceHex })),
    output: { dtcg: './tokens.json' },
    intents,
  };

  try {
    const { tokens } = resolveAll({
      config,
      vocabulary,
      ramps,
      modes,
      tokenRamp,
    });
    return { ok: true, tokens, ramps, vocabulary };
  } catch (err) {
    return { ok: false, error: `Resolve failed: ${(err as Error).message}` };
  }
}
