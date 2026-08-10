import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateRamp, pinChromaCurveToGamut, validateRampGamut } from '../src/lib/colorMath';
import { usePaletteStore } from '../src/store/paletteStore';

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

const TARGET_GAMUT_KEY = 'pigmint:target-gamut:v1';

/** Adds a highly saturated scale, which needs P3 for its mid steps. */
function addVividScale(): string {
  const before = new Set(usePaletteStore.getState().scales.map((s) => s.id));
  usePaletteStore.getState().addScale('#ff0088', 'vivid');
  const scale = usePaletteStore.getState().scales.find((s) => !before.has(s.id));
  if (!scale) throw new Error('scale was not added');
  usePaletteStore.getState().updateChromaPeak(scale.id, 0.4);
  return scale.id;
}

function scaleById(id: string) {
  const scale = usePaletteStore.getState().scales.find((s) => s.id === id);
  if (!scale) throw new Error(`scale ${id} is gone`);
  return scale;
}

beforeEach(() => {
  (globalThis as unknown as { localStorage?: Storage }).localStorage =
    new MemoryStorage() as unknown as Storage;
  usePaletteStore.setState({ targetGamut: 'p3' });
});

afterEach(() => {
  delete (globalThis as unknown as { localStorage?: Storage }).localStorage;
});

describe('target gamut', () => {
  it('defaults to Display P3 and remembers a switch to sRGB', () => {
    expect(usePaletteStore.getState().targetGamut).toBe('p3');

    usePaletteStore.getState().setTargetGamut('srgb');

    expect(usePaletteStore.getState().targetGamut).toBe('srgb');
    expect(localStorage.getItem(TARGET_GAMUT_KEY)).toBe('srgb');
  });

  it('removes P3 from generated ramps when set to sRGB', () => {
    const id = addVividScale();
    const scale = scaleById(id);

    const p3Ramp = generateRamp(scale, { gamut: 'p3' });
    expect(p3Ramp.steps.some((step) => step.displayP3)).toBe(true);

    const srgbRamp = generateRamp(scale, { gamut: 'srgb' });
    expect(srgbRamp.steps.every((step) => step.gamut === 'srgb')).toBe(true);
    expect(srgbRamp.steps.every((step) => step.displayP3 === undefined)).toBe(true);
  });

  it('leaves an sRGB hex on every step so the fallback palette is always complete', () => {
    const ramp = generateRamp(scaleById(addVividScale()), { gamut: 'p3' });
    expect(ramp.steps.every((step) => /^#[0-9a-f]{6}$/.test(step.hex))).toBe(true);
  });
});

describe('pinning through the store', () => {
  it('pins every step onto the boundary, clearing chroma smoothing', () => {
    const id = addVividScale();
    usePaletteStore.getState().updateCurveSmoothing(id, 'chroma', 0.8);

    const pin = pinChromaCurveToGamut(scaleById(id), 'p3');
    usePaletteStore.getState().setChromaCurveValues(id, pin.values, pin.smoothing);

    const scale = scaleById(id);
    expect(scale.curves.chroma.smoothing).toBe(0);

    const validation = validateRampGamut(generateRamp(scale, { gamut: 'p3' }), 'p3');
    expect(validation.ok).toBe(true);
    expect(validation.pinnedCount).toBe(validation.stepCount);
  });

  it('keeps an sRGB pin sRGB-safe even while the palette targets P3', () => {
    const id = addVividScale();
    usePaletteStore.getState().updateCurveSmoothing(id, 'chroma', 1);

    const pin = pinChromaCurveToGamut(scaleById(id), 'srgb');
    usePaletteStore.getState().setChromaCurveValues(id, pin.values, pin.smoothing);

    const ramp = generateRamp(scaleById(id), { gamut: 'p3' });
    expect(validateRampGamut(ramp, 'srgb').ok).toBe(true);
    expect(ramp.steps.every((step) => step.displayP3 === undefined)).toBe(true);
  });
});
