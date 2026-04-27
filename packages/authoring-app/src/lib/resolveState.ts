import {
  emitDtcg,
  generateRamp,
  resolveAll,
  ResolveError,
  coerceTokenRampToPaletteScales,
  type GeneratedRamp,
  type ModeBinding,
  type ProjectConfig,
  type ResolvedToken,
  type ResolverConfig,
  type VocabularyEntry,
  type SurfaceStepDecl,
} from '@pigmint/core';
import type { ComplianceTarget } from '@pigmint/core';
import type { EngineMode, EngineCompliance } from '../store/intentStore';
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


export interface ResolutionSuccess {
  ok: true;
  tokens: ResolvedToken[];
  /** Stepped ramps for curve/overlay UI (excludes `c****` materialized DTCG steps). */
  ramps: GeneratedRamp[];
  /** Merged ramp list for DTCG emit (includes F1 `c****` when continuous is on). */
  dtcgRamps: GeneratedRamp[];
  vocabulary: VocabularyEntry[];
}

export interface ResolutionFailure {
  ok: false;
  error: string;
}

export type ResolutionState = ResolutionSuccess | ResolutionFailure;

export interface ResolveVocabContext {
  vocabulary: VocabularyEntry[];
  tokenRamp: Record<string, string>;
  surfacePaths?: Set<string>;
  surfaceSteps?: Map<string, SurfaceStepDecl>;
}

export function runResolve(
  scales: ColorScale[],
  engineModes: EngineMode[],
  engineTarget: 'AA' | 'AAA',
  engineCompliance: EngineCompliance,
  vocabCtx: ResolveVocabContext | null,
  resolver?: ResolverConfig,
): ResolutionState {
  if (!vocabCtx) {
    return { ok: false, error: 'Load a tokens.yaml in the Tokens tab to get started.' };
  }
  if (scales.length === 0) {
    return { ok: false, error: 'Add at least one ramp in the Primitives tab to see resolved tokens.' };
  }
  let ramps: GeneratedRamp[];
  try {
    ramps = scales.map((s) => generateRamp(s));
  } catch (err) {
    return { ok: false, error: `Ramp generation failed: ${(err as Error).message}` };
  }
  const { vocabulary, tokenRamp, surfacePaths, surfaceSteps } = vocabCtx;
  if (Object.keys(tokenRamp).length === 0) {
    return { ok: false, error: 'Vocabulary has no tokens; add surfaces and foreground/nonText tokens.' };
  }
  const scaleNames = scales.map((s) => s.name);
  const tokenRampForResolve = coerceTokenRampToPaletteScales(tokenRamp, scaleNames);
  const modes: ModeBinding[] = engineModes.map((mode) => ({
    mode,
    scheme: MODE_SCHEMES[mode],
    baselineHex: MODE_BASELINES[mode],
    ...(mode.endsWith('-high-contrast') ? { thresholdElevation: 'hc' as const } : {}),
  }));
  const config: ProjectConfig = {
    engine: {
      compliance: engineCompliance,
      target: engineTarget,
      modes: engineModes,
      ...(resolver ? { resolver } : {}),
    },
    ramps: scales.map((s) => ({ name: s.name, source: s.sourceHex })),
    output: { dtcg: './tokens.json' },
  };

  try {
    const { tokens, ramps: dtcgRamps } = resolveAll({
      config,
      vocabulary,
      ramps,
      modes,
      tokenRamp: tokenRampForResolve,
      scales,
      ...(surfacePaths ? { surfacePaths, surfaceSteps } : {}),
    });
    return { ok: true, tokens, ramps, dtcgRamps, vocabulary };
  } catch (err) {
    if (err instanceof ResolveError) {
      return { ok: false, error: `Resolve failed on "${err.tokenPath}": ${err.message}` };
    }
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
  engineCompliance: EngineCompliance,
  vocabCtx: ResolveVocabContext | null,
  resolver: ResolverConfig = { mode: 'continuous' },
): PigmintTokensBuild | PigmintTokensBuildFailure {
  const state = runResolve(
    scales,
    engineModes,
    engineTarget,
    engineCompliance,
    vocabCtx,
    resolver,
  );
  if (!state.ok) return { ok: false, error: state.error };
  try {
    const container = emitDtcg({
      engineVersion: '0.0.0',
      defaultMode: engineModes[0] ?? 'light',
      ramps: state.dtcgRamps,
      resolvedTokens: state.tokens,
      vocabulary: state.vocabulary,
    });
    return { ok: true, json: JSON.stringify(container, null, 2) + '\n' };
  } catch (err) {
    return { ok: false, error: `DTCG emit failed: ${(err as Error).message}` };
  }
}
