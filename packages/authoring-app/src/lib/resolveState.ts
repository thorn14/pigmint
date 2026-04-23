import {
  buildDefaultTokenRamp,
  emitDtcg,
  generateRamp,
  resolveAll,
  VOCABULARY_V1_SLICE,
  type GeneratedRamp,
  type IntentOverride as CoreIntentOverride,
  type ModeBinding,
  type ProjectConfig,
  type ResolvedToken,
  type ResolverConfig,
  type VocabularyEntry,
} from '@pigmint/core';
import type { ComplianceTarget } from '@pigmint/core';
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
  resolver?: ResolverConfig,
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
    ...(mode.endsWith('-high-contrast') ? { thresholdElevation: 'hc' as const } : {}),
  }));
  const config: ProjectConfig = {
    engine: {
      compliance: 'wcag21',
      target: engineTarget,
      modes: engineModes,
      ...(resolver ? { resolver } : {}),
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
      scales,
    });
    return { ok: true, tokens, ramps, vocabulary };
  } catch (err) {
    return { ok: false, error: `Resolve failed: ${(err as Error).message}` };
  }
}

export function continuousStepLabel(position: number, ramp: GeneratedRamp): string {
  if (ramp.steps.length < 2) {
    return `${ramp.scaleName}.${ramp.steps[0]?.name ?? '0'}`;
  }
  const fIdx = Math.max(0, Math.min(ramp.steps.length - 1, position * (ramp.steps.length - 1)));
  const lo = Math.floor(fIdx);
  const hi = Math.min(lo + 1, ramp.steps.length - 1);
  const frac = fIdx - lo;
  const loName = ramp.steps[lo]?.name ?? '';
  const hiName = ramp.steps[hi]?.name ?? '';
  const loNum = Number(loName);
  const hiNum = Number(hiName);
  if (Number.isFinite(loNum) && Number.isFinite(hiNum)) {
    return `${ramp.scaleName} ${Math.round(loNum + (hiNum - loNum) * frac)}`;
  }
  return `${ramp.scaleName}.${loName}`;
}

export interface PigmintTokensBuild {
  ok: true;
  json: string;
}

export interface PigmintTokensBuildFailure {
  ok: false;
  error: string;
}

export function buildPigmintTokensJson(
  scales: ColorScale[],
  engineModes: EngineMode[],
  engineTarget: ComplianceTarget,
  overrides: Record<string, CoreIntentOverride>,
  resolver: ResolverConfig = { mode: 'continuous' },
): PigmintTokensBuild | PigmintTokensBuildFailure {
  const state = runResolve(scales, engineModes, engineTarget, overrides, resolver);
  if (!state.ok) return { ok: false, error: state.error };
  try {
    const container = emitDtcg({
      engineVersion: '0.0.0',
      defaultMode: engineModes[0] ?? 'light',
      ramps: state.ramps,
      resolvedTokens: state.tokens,
      vocabulary: state.vocabulary,
    });
    return { ok: true, json: JSON.stringify(container, null, 2) + '\n' };
  } catch (err) {
    return { ok: false, error: `DTCG emit failed: ${(err as Error).message}` };
  }
}
