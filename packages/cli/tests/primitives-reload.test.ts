import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { maxSrgbChroma } from '@pigmint/core';
import { loadRampFromPrimitives } from '../src/ramps.js';

const cleanups: string[] = [];
afterAll(async () => {
  for (const p of cleanups) await rm(p, { recursive: true, force: true });
});

/** A chroma that needs Display P3 at this lightness/hue, and one that doesn't. */
const L = 0.65;
const H = 0;
const WIDE_C = 0.28;
const NARROW_C = 0.1;

async function writePrimitives(doc: unknown): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'pigmint-prims-'));
  cleanups.push(dir);
  const path = join(dir, 'primitives.json');
  await writeFile(path, JSON.stringify(doc), 'utf8');
  return path;
}

function step(colorSpace: string, c: number) {
  return {
    $value: {
      colorSpace,
      components: [1, 0.11, 0.73],
      hex: '#ff1dba',
    },
    $extensions: { oklch: { l: L, c, h: H } },
  };
}

describe('reloading a ramp from a primitives file', () => {
  it('is a sanity check that WIDE_C really is outside sRGB', () => {
    expect(maxSrgbChroma(L, H)).toBeLessThan(WIDE_C);
  });

  it('keeps the stored chroma of a Display P3 step', async () => {
    const path = await writePrimitives({
      primitive: { pink: { $type: 'color', '500': step('display-p3', WIDE_C) } },
    });

    const ramp = await loadRampFromPrimitives('pink', path);

    expect(ramp.steps).toHaveLength(1);
    expect(ramp.steps[0].oklch.c).toBeCloseTo(WIDE_C, 6);
    expect(ramp.steps[0].gamut).toBe('p3');
    expect(ramp.steps[0].displayP3).toMatch(/^color\(display-p3 /);
  });

  it('keeps a wide chroma even when the file does not declare display-p3', async () => {
    // The gamut ceiling defaults to P3, so a file whose `colorSpace` disagrees
    // with its own OKLCH extension — hand-written, or from another emitter —
    // is not silently narrowed. The step's level is derived from the color.
    const declaredSrgb = await writePrimitives({
      primitive: { pink: { $type: 'color', '500': step('srgb', WIDE_C) } },
    });
    const noColorSpace = await writePrimitives({
      primitive: {
        pink: {
          $type: 'color',
          '500': {
            $value: { components: [1, 0.11, 0.73], hex: '#ff1dba' },
            $extensions: { oklch: { l: L, c: WIDE_C, h: H } },
          },
        },
      },
    });

    for (const path of [declaredSrgb, noColorSpace]) {
      const ramp = await loadRampFromPrimitives('pink', path);
      expect(ramp.steps[0].oklch.c).toBeCloseTo(WIDE_C, 6);
      expect(ramp.steps[0].gamut).toBe('p3');
    }
  });

  it('still reports a step that fits in sRGB as sRGB, with no P3 value', async () => {
    const path = await writePrimitives({
      primitive: { pink: { $type: 'color', '500': step('srgb', NARROW_C) } },
    });

    const ramp = await loadRampFromPrimitives('pink', path);

    expect(ramp.steps[0].oklch.c).toBeCloseTo(NARROW_C, 6);
    expect(ramp.steps[0].gamut).toBe('srgb');
    expect(ramp.steps[0].displayP3).toBeUndefined();
  });

  it('falls back to the hex when a step carries no oklch extension', async () => {
    const path = await writePrimitives({
      primitive: {
        pink: {
          $type: 'color',
          '500': { $value: { colorSpace: 'srgb', components: [1, 0, 0], hex: '#ff0000' } },
        },
      },
    });

    const ramp = await loadRampFromPrimitives('pink', path);

    expect(ramp.steps[0].hex).toBe('#ff0000');
    expect(ramp.steps[0].gamut).toBe('srgb');
  });
});
