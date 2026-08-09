import { type GamutTarget } from '../math/gamut.js';
import { buildGeneratedStep } from '../math/step.js';
import type { GeneratedRamp, GeneratedStep } from '../types/palette.js';
import type { ProjectConfig, ResolvedToken } from '../types/spec.js';

const NAME_PREFIX = 'c';
const QUANTA_MAX = 1000;

/**
 * F1: When continuous resolver picks a dense index between named steps, the DTCG alias
 * used to point at the nearest *named* step while the actual oklch differed. This pass
 * synthesizes a real primitive per quantized position (named `c0` … `c1000`) and rewrites `nearestPrimitive`.
 */
export function shouldMaterializeContinuous(config: ProjectConfig): boolean {
  const r = config.engine.resolver;
  if (!r || r.mode !== 'continuous') return false;
  return r.materializeInterpolatedPrimitives !== false;
}

export function positionQuantaKey(position: number): number {
  if (!Number.isFinite(position)) return 0;
  return Math.max(0, Math.min(QUANTA_MAX, Math.round(position * QUANTA_MAX)));
}

export function materializedStepNameForQuanta(q: number): string {
  return `${NAME_PREFIX}${q}`;
}

/**
 * `nearestPrimitive` is `scaleName.stepName` (resolve path) or `color.primitive.scaleName.stepName` (surfaces).
 */
function parseRefScaleStep(nearestPrimitive: string | undefined): { scale: string; step: string } | null {
  if (!nearestPrimitive) return null;
  const parts = nearestPrimitive.split('.');
  if (parts.length < 2) return null;
  if (parts[0] === 'color' && parts[1] === 'primitive' && parts.length >= 4) {
    const step = parts[parts.length - 1];
    const scale = parts[2];
    if (!step || !scale) return null;
    return { scale, step };
  }
  const step = parts[parts.length - 1]!;
  const scale = parts.slice(0, -1).join('.');
  return { scale, step };
}

export function buildGeneratedStepForMaterializedName(
  token: ResolvedToken,
  name: string,
  gamut: GamutTarget = 'p3',
): GeneratedStep {
  const { l, c, h, alpha } = token.oklch;
  return buildGeneratedStep({ name, l, c, h, alpha, gamut, fallbackHex: token.hex });
}

/**
 * Merges synthesized steps into the stepped `ramps` and rewrites `tokens[].source.nearestPrimitive` + positions.
 * Idempotent: already-on-grid or already materialized names are left unchanged.
 */
export function materializeContinuousRamps(
  config: ProjectConfig,
  ramps: GeneratedRamp[],
  tokens: ResolvedToken[],
): { ramps: GeneratedRamp[]; tokens: ResolvedToken[] } {
  if (!shouldMaterializeContinuous(config)) {
    return { ramps, tokens };
  }

  const gamut: GamutTarget = config.engine.gamut ?? 'p3';
  const rampByName = new Map(ramps.map((r) => [r.scaleName, r]));
  const toAdd: Map<string, Map<string, GeneratedStep>> = new Map();
  const byScaleQuanta: Map<string, { name: string; step: GeneratedStep }> = new Map();

  const getOrCreateSynthetic = (scale: string, quanta: number, token: ResolvedToken): string => {
    const stepName = materializedStepNameForQuanta(quanta);
    const mapKey = `${scale}::${quanta}`;
    const existing = byScaleQuanta.get(mapKey);
    if (existing) return existing.name;
    if (!toAdd.has(scale)) toAdd.set(scale, new Map());
    const step = buildGeneratedStepForMaterializedName(token, stepName, gamut);
    toAdd.get(scale)!.set(stepName, step);
    byScaleQuanta.set(mapKey, { name: stepName, step });
    return stepName;
  };

  const outTokens: ResolvedToken[] = tokens.map((t) => {
    const ref = parseRefScaleStep(t.source.nearestPrimitive);
    if (!ref || ref.scale !== t.source.ramp) return t;

    const baseRamp = rampByName.get(t.source.ramp);
    if (!baseRamp) return t;

    if (ref.step.startsWith(NAME_PREFIX) && /^\d+$/.test(ref.step.slice(1))) {
      const st = baseRamp.steps.find((s) => s.name === ref.step);
      if (st && st.hex.toLowerCase() === t.hex.toLowerCase()) return t;
    }

    const refStep = baseRamp.steps.find((s) => s.name === ref.step);
    if (!refStep) return t;
    if (refStep.hex.toLowerCase() === t.hex.toLowerCase()) {
      return t;
    }

    const q = positionQuantaKey(t.source.position);
    const stepName = getOrCreateSynthetic(t.source.ramp, q, t);
    const newNearest = `${t.source.ramp}.${stepName}`;

    return {
      ...t,
      source: {
        ...t.source,
        nearestPrimitive: newNearest,
        position: t.source.position,
      },
    };
  });

  if (toAdd.size === 0) {
    return { ramps, tokens: outTokens };
  }

  const newRamps = ramps.map((r) => {
    const more = toAdd.get(r.scaleName);
    if (!more || more.size === 0) return r;
    const byName = new Set(r.steps.map((s) => s.name));
    const merged = [...r.steps];
    for (const s of more.values()) {
      if (byName.has(s.name)) continue;
      byName.add(s.name);
      merged.push(s);
    }
    return { ...r, steps: merged };
  });

  return { ramps: newRamps, tokens: outTokens };
}
