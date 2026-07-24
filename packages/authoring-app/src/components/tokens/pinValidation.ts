import type { GeneratedRamp, PortableSurfaceToken } from '@pigmint/core';
import { getWcagContrast, getApcaContrast } from '../../lib/colorMath';
import { stepRefToIndex } from './tokenShared';

/** Per-scheme validation messages for a `pin-to-step` token. */
export type PinStepErrors = { light?: string; dark?: string };

/** Hex of a surface token's resolved step for a given scheme (light/dark). */
export function surfaceSchemeHex(
  surfaceToken: PortableSurfaceToken | undefined,
  rampMap: Map<string, GeneratedRamp>,
  scheme: 'light' | 'dark',
): string | undefined {
  if (!surfaceToken) return undefined;
  const ramp = rampMap.get(surfaceToken.ramp);
  if (!ramp) return undefined;
  const last = ramp.steps.length - 1;
  const ref = scheme === 'light'
    ? (surfaceToken.lightStep ?? surfaceToken.step)
    : (surfaceToken.darkStep ?? surfaceToken.step);
  const idx = stepRefToIndex(ramp, ref, scheme === 'light' ? 0 : last);
  return ramp.steps[Math.max(0, Math.min(idx, last))]?.hex;
}

/** Minimum passing contrast for the usage + level under the active metric. */
function thresholdFor(
  compliance: 'wcag21' | 'apca',
  target: 'AA' | 'AAA',
  section: 'foreground' | 'nonText',
): number {
  if (compliance === 'apca') {
    return section === 'foreground' ? (target === 'AAA' ? 90 : 60) : (target === 'AAA' ? 60 : 45);
  }
  return section === 'foreground' ? (target === 'AAA' ? 7 : 4.5) : (target === 'AAA' ? 4.5 : 3);
}

/**
 * Validate a `pin-to-step` token: each chosen step must meet the contrast floor
 * against its primary surface in that scheme. Decorative tokens are exempt and
 * never error. Returns a message per failing scheme (empty object when valid).
 */
export function pinStepErrors(args: {
  section: 'foreground' | 'nonText';
  compliance: 'wcag21' | 'apca';
  target: 'AA' | 'AAA';
  decorative: boolean;
  ramp: GeneratedRamp | undefined;
  lightStep: number;
  darkStep: number;
  primarySurfaceName: string | undefined;
  primarySurface: PortableSurfaceToken | undefined;
  rampMap: Map<string, GeneratedRamp>;
}): PinStepErrors {
  const { section, compliance, target, decorative, ramp, lightStep, darkStep, primarySurfaceName, primarySurface, rampMap } = args;
  if (decorative || !ramp || !primarySurface || !primarySurfaceName) return {};

  const isApca = compliance === 'apca';
  const need = thresholdFor(compliance, target, section);
  const metricLabel = isApca ? 'APCA' : 'WCAG';
  const last = ramp.steps.length - 1;
  const metric = (fg: string, bg: string) =>
    isApca ? Math.abs(getApcaContrast(fg, bg)) : getWcagContrast(fg, bg).ratio;

  const check = (idx: number, scheme: 'light' | 'dark'): string | undefined => {
    const fg = ramp.steps[Math.max(0, Math.min(idx, last))]?.hex;
    const bg = surfaceSchemeHex(primarySurface, rampMap, scheme);
    if (!fg || !bg) return undefined;
    const m = metric(fg, bg);
    if (m + 1e-9 >= need) return undefined;
    const got = isApca ? Math.round(m) : m.toFixed(2);
    return `Fails ${target} ${metricLabel} on “${primarySurfaceName}” (${got} < ${need}).`;
  };

  const out: PinStepErrors = {};
  const l = check(lightStep, 'light');
  if (l) out.light = l;
  const d = check(darkStep, 'dark');
  if (d) out.dark = d;
  return out;
}

export function hasPinStepErrors(errors: PinStepErrors): boolean {
  return Boolean(errors.light || errors.dark);
}

/** One-line summary for a top-of-form banner. */
export function pinStepErrorSummary(errors: PinStepErrors): string | null {
  const parts: string[] = [];
  if (errors.light) parts.push(`Light step — ${errors.light}`);
  if (errors.dark) parts.push(`Dark step — ${errors.dark}`);
  if (parts.length === 0) return null;
  return `${parts.join(' ')} Pick a higher-contrast step or mark the token Decorative.`;
}
