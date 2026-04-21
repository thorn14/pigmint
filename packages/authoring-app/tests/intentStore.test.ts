import { beforeEach, describe, expect, it } from 'vitest';
import { mergeIntent, useIntentStore } from '../src/store/intentStore';
import type { FormalIntent } from '@pigmint/core';

const BASE: FormalIntent = {
  threshold: { kind: 'wcag', level: 'AA', usage: 'text' },
  preference: 'lowest-passing',
  consistency: 'independent',
  surfaceContext: 'primary',
};

beforeEach(() => {
  useIntentStore.getState().clearAll();
  useIntentStore.getState().setEngineTarget('AA');
  useIntentStore.getState().loadState({ engineModes: ['light'] });
});

describe('intentStore', () => {
  it('engine target is global, not per-token', () => {
    useIntentStore.getState().setEngineTarget('AAA');
    expect(useIntentStore.getState().engineTarget).toBe('AAA');
    const store = useIntentStore.getState();
    // overrides map is untouched when engine target changes
    expect(Object.keys(store.overrides)).toHaveLength(0);
  });

  it('applies preference override without touching threshold', () => {
    useIntentStore.getState().setPreference('color.foreground.main', 'highest-contrast');
    const override = useIntentStore.getState().overrides['color.foreground.main'];
    expect(override?.preference).toBe('highest-contrast');
    expect('threshold' in (override ?? {})).toBe(false);
  });

  it('resetOverride removes the entry entirely', () => {
    useIntentStore.getState().setPreference('x', 'highest-contrast');
    expect(useIntentStore.getState().overrides['x']).toBeDefined();
    useIntentStore.getState().resetOverride('x');
    expect(useIntentStore.getState().overrides['x']).toBeUndefined();
  });

  it('clearAll removes every override but leaves engine intact', () => {
    useIntentStore.getState().setEngineTarget('AAA');
    useIntentStore.getState().setPreference('a', 'anchored');
    useIntentStore.getState().setConsistency('b', 'matched-across-ramps');
    useIntentStore.getState().clearAll();
    expect(Object.keys(useIntentStore.getState().overrides)).toHaveLength(0);
    expect(useIntentStore.getState().engineTarget).toBe('AAA');
  });

  it('loadState replaces overrides + target and coerces apca compliance to wcag21', () => {
    useIntentStore.getState().setPreference('x', 'anchored');
    useIntentStore.getState().loadState({
      overrides: { 'color.foreground.main': { preference: 'highest-contrast' } },
      engineTarget: 'AAA',
      engineCompliance: 'apca',
    });
    const s = useIntentStore.getState();
    expect(s.overrides['x']).toBeUndefined();
    expect(s.overrides['color.foreground.main']?.preference).toBe('highest-contrast');
    expect(s.engineTarget).toBe('AAA');
    expect(s.engineCompliance).toBe('wcag21');
  });

  it('mergeIntent applies engine target to threshold regardless of base', () => {
    const merged = mergeIntent(BASE, undefined, 'AAA', 'apca');
    expect(merged.threshold.level).toBe('AAA');
    expect(merged.threshold.kind).toBe('apca');
  });

  it('mergeIntent picks override preference/consistency/surface and maps wcag21 → wcag threshold kind', () => {
    const merged = mergeIntent(
      BASE,
      { preference: 'anchored' },
      'AAA',
      'wcag21',
    );
    expect(merged.preference).toBe('anchored');
    expect(merged.consistency).toBe(BASE.consistency);
    expect(merged.threshold.level).toBe('AAA');
    expect(merged.threshold.kind).toBe('wcag');
  });

  it('toggleEngineMode adds and removes modes while preserving canonical order', () => {
    useIntentStore.getState().toggleEngineMode('dark');
    useIntentStore.getState().toggleEngineMode('dark-high-contrast');
    expect(useIntentStore.getState().engineModes).toEqual([
      'light',
      'dark',
      'dark-high-contrast',
    ]);
    useIntentStore.getState().toggleEngineMode('dark');
    expect(useIntentStore.getState().engineModes).toEqual([
      'light',
      'dark-high-contrast',
    ]);
  });

  it('toggleEngineMode refuses to drop the last remaining mode', () => {
    useIntentStore.getState().toggleEngineMode('light');
    expect(useIntentStore.getState().engineModes).toEqual(['light']);
  });

  it('loadState sanitizes unknown modes and dedupes duplicates', () => {
    useIntentStore.getState().loadState({
      engineModes: [
        'light',
        'dark',
        'light',
        'bogus',
      ] as unknown as Parameters<
        ReturnType<typeof useIntentStore.getState>['loadState']
      >[0]['engineModes'],
    });
    expect(useIntentStore.getState().engineModes).toEqual(['light', 'dark']);
  });

  it('loadState falls back to light when no valid modes remain', () => {
    useIntentStore.getState().loadState({
      engineModes: ['bogus'] as unknown as Parameters<
        ReturnType<typeof useIntentStore.getState>['loadState']
      >[0]['engineModes'],
    });
    expect(useIntentStore.getState().engineModes).toEqual(['light']);
  });
});
