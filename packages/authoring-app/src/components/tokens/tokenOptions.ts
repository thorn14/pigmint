import type { GeneratedRamp, PortableSurfaceToken } from '@pigmint/core';
import type { AppSelectOption } from './AppSelect';
import { PREFS, ALPHA_PREFS, derivedConsistency, type Pref } from './tokenShared';

/** Hex of a surface's light step — used for surface previews. */
export function surfaceHex(
  surfaceToken: PortableSurfaceToken | undefined,
  rampMap: Map<string, GeneratedRamp>,
): string | undefined {
  if (!surfaceToken) return undefined;
  const ramp = rampMap.get(surfaceToken.ramp);
  if (!ramp) return undefined;
  const idx = surfaceToken.lightStep ?? surfaceToken.step ?? 0;
  return ramp.steps[Math.max(0, Math.min(idx, ramp.steps.length - 1))]?.hex;
}

/** Representative hex of a ramp — mid-step is a fair character preview. */
export function rampHex(rampName: string, rampMap: Map<string, GeneratedRamp>): string | undefined {
  const ramp = rampMap.get(rampName);
  if (!ramp) return undefined;
  const mid = Math.floor(ramp.steps.length / 2);
  return ramp.steps[mid]?.hex;
}

export function rampOptions(rampNames: string[], rampMap: Map<string, GeneratedRamp>): AppSelectOption[] {
  return rampNames.map((r) => ({ value: r, label: r, hex: rampHex(r, rampMap) }));
}

export function surfaceOptions(
  surfaceNames: string[],
  surfaces: Record<string, PortableSurfaceToken>,
  rampMap: Map<string, GeneratedRamp>,
): AppSelectOption[] {
  return surfaceNames.map((name) => {
    const hex = surfaceHex(surfaces[name], rampMap);
    return { value: name, label: name, hex, trailing: hex };
  });
}

export function stepOptions(ramp: GeneratedRamp | undefined): AppSelectOption[] {
  if (!ramp) return [];
  return ramp.steps.map((s, i) => ({
    value: String(i),
    label: s.name,
    hex: s.hex,
    trailing: s.hex,
  }));
}

export function prefOptions(): AppSelectOption[] {
  return PREFS.map((p) => ({ value: p, label: p }));
}

export function alphaPrefOptions(): AppSelectOption[] {
  return ALPHA_PREFS.map((p) => ({ value: p, label: p }));
}

/** Consistency is derived; we expose a single read-only-style option. */
export function consistencyOptions(pref: Pref): AppSelectOption[] {
  return [{ value: derivedConsistency(pref), label: derivedConsistency(pref) }];
}
