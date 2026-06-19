import { formatHex, clampChroma } from 'culori';
import { getRelativeLuminance } from '../math/contrast.js';
import { toRgb, toP3, checkGamut, maxP3Chroma, maxSrgbChroma } from '../math/gamut.js';
import { clampAlpha } from '../math/oklch.js';
import type { GeneratedRamp, GeneratedStep, RgbChannels } from '../types/palette.js';
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

export function buildGeneratedStepForMaterializedName(token: ResolvedToken, name: string): GeneratedStep {
  const { l, c, h, alpha: aIn } = token.oklch;
  const cP3 = Math.min(c, maxP3Chroma(l, h));
  const gamut = checkGamut(l, cP3, h);
  const sourceAlpha = clampAlpha(aIn);

  let p3Channels: RgbChannels | undefined;
  let displayP3: string | undefined;
  if (gamut === 'p3') {
    const p3 = toP3({ mode: 'oklch' as const, l, c: cP3, h });
    if (p3) {
      const pr = p3.r ?? 0;
      const pg = p3.g ?? 0;
      const pb = p3.b ?? 0;
      p3Channels = { r: pr, g: pg, b: pb };
      displayP3 = `color(display-p3 ${pr.toFixed(4)} ${pg.toFixed(4)} ${pb.toFixed(4)})`;
    }
  }

  const srgbClamped = clampChroma(
    { mode: 'oklch' as const, l, c: cP3, h, alpha: sourceAlpha },
    'oklch',
  );
  const hex = (formatHex(srgbClamped) ?? token.hex) as string;
  const srgbRgb = toRgb(srgbClamped);
  const srgbChannels: RgbChannels = {
    r: srgbRgb?.r ?? 0,
    g: srgbRgb?.g ?? 0,
    b: srgbRgb?.b ?? 0,
  };

  return {
    name,
    oklch: { l, c: cP3, h, alpha: sourceAlpha },
    hex,
    srgb: srgbChannels,
    p3: p3Channels,
    displayP3,
    relativeLuminance: getRelativeLuminance(hex),
    gamut,
    maxSrgbC: maxSrgbChroma(l, h),
  };
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

  const rampByName = new Map(ramps.map((r) => [r.scaleName, r]));
  const toAdd: Map<string, Map<string, GeneratedStep>> = new Map();
  const byScaleQuanta: Map<string, { name: string; step: GeneratedStep }> = new Map();

  const getOrCreateSynthetic = (scale: string, quanta: number, token: ResolvedToken): string => {
    const stepName = materializedStepNameForQuanta(quanta);
    const mapKey = `${scale}::${quanta}`;
    const existing = byScaleQuanta.get(mapKey);
    if (existing) return existing.name;
    if (!toAdd.has(scale)) toAdd.set(scale, new Map());
    const step = buildGeneratedStepForMaterializedName(token, stepName);
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
