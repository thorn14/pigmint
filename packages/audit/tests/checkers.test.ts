import { describe, it, expect } from 'vitest';
import type { DtcgContainer, ModeEntry } from '@pigmint/core';
import { runCheckers } from '../src/checkers.js';

function makeEntry(overrides: Partial<ModeEntry> = {}): ModeEntry {
  return {
    value: { oklch: 'oklch(0.5 0.1 250)', hex: '#3366cc' },
    compliance: { level: 'AA-text', target: 'AA' },
    contrast: { wcag21: 5.2 },
    ...overrides,
  };
}

function buildContainer(semantic: Record<string, unknown>): DtcgContainer {
  return {
    $schema: 'https://design-tokens.github.io/community-group/format/',
    $extensions: {
      'com.pigmint': {
        specVersion: '0.1.0',
        vocabularyVersion: 'vocabulary@0.1',
        generatedAt: '2026-04-19T00:00:00Z',
        defaultMode: 'light',
        engine: { version: '0.0.0' },
      },
    },
    primitive: {},
    ...semantic,
  };
}

describe('runCheckers', () => {
  it('flags missing-mode when a declared mode has no entry', () => {
    const container = buildContainer({
      foreground: {
        main: {
          $type: 'color',
          $value: '{color.primitive.neutral.900}',
          $extensions: {
            'com.pigmint': {
              usage: 'text',
              modes: { light: makeEntry() },
            },
          },
        },
      },
    });

    const { violations } = runCheckers({
      container,
      target: 'AA',
      expectedModes: ['light', 'dark'],
    });

    expect(violations).toHaveLength(1);
    expect(violations[0]!.type).toBe('missing-mode');
    expect(violations[0]!.mode).toBe('dark');
  });

  it('flags contrast-failure when compliance level is fail', () => {
    const container = buildContainer({
      action: {
        primary: {
          background: {
            $type: 'color',
            $value: '{color.primitive.blue.500}',
            $extensions: {
              'com.pigmint': {
                usage: 'nonText',
                modes: {
                  light: makeEntry({
                    compliance: { level: 'fail', target: 'AA' },
                    contrast: { wcag21: 1.8 },
                  }),
                },
              },
            },
          },
        },
      },
    });

    const { violations } = runCheckers({
      container,
      target: 'AA',
      expectedModes: ['light'],
    });

    expect(violations).toHaveLength(1);
    expect(violations[0]!.type).toBe('contrast-failure');
    expect(violations[0]!.severity).toBe('error');
  });

  it('flags contrast-under-target when actual level is below required', () => {
    const container = buildContainer({
      foreground: {
        main: {
          $type: 'color',
          $value: '{color.primitive.neutral.900}',
          $extensions: {
            'com.pigmint': {
              usage: 'text',
              modes: {
                light: makeEntry({
                  compliance: { level: 'AA-nonText', target: 'AA' },
                  contrast: { wcag21: 3.4 },
                }),
              },
            },
          },
        },
      },
    });

    const { violations } = runCheckers({
      container,
      target: 'AA',
      expectedModes: ['light'],
    });

    expect(violations).toHaveLength(1);
    expect(violations[0]!.type).toBe('contrast-under-target');
    expect(violations[0]!.severity).toBe('warning');
  });

  it('does not flag exempt tokens (surfaces)', () => {
    const container = buildContainer({
      surface: {
        main: {
          $type: 'color',
          $value: '{color.primitive.neutral.50}',
          $extensions: {
            'com.pigmint': {
              usage: 'nonText',
              modes: {
                light: makeEntry({
                  compliance: { level: 'exempt', target: 'AA' },
                  contrast: null,
                }),
              },
            },
          },
        },
      },
    });

    const { violations } = runCheckers({
      container,
      target: 'AA',
      expectedModes: ['light'],
    });

    expect(violations).toHaveLength(0);
  });

  it('flags mixed-usage when declared usage conflicts with path context (ADR-011)', () => {
    const container = buildContainer({
      decorative: {
        backdrop: {
          $type: 'color',
          $value: '{color.primitive.blue.300}',
          $extensions: {
            'com.pigmint': {
              usage: 'text',
              modes: { light: makeEntry() },
            },
          },
        },
      },
    });

    const { violations } = runCheckers({
      container,
      target: 'AA',
      expectedModes: ['light'],
    });

    const mixed = violations.find((v) => v.type === 'mixed-usage');
    expect(mixed).toBeDefined();
    expect(mixed?.severity).toBe('warning');
    expect(mixed?.expected?.usage).toBe('decorative');
    expect(mixed?.actual?.usage).toBe('text');
  });

  it('does not flag mixed-usage when declared usage matches path context', () => {
    const container = buildContainer({
      foreground: {
        main: {
          $type: 'color',
          $value: '{color.primitive.neutral.900}',
          $extensions: {
            'com.pigmint': {
              usage: 'text',
              modes: { light: makeEntry() },
            },
          },
        },
      },
    });

    const { violations } = runCheckers({
      container,
      target: 'AA',
      expectedModes: ['light'],
    });

    expect(violations.find((v) => v.type === 'mixed-usage')).toBeUndefined();
  });

  it('does not flag passing tokens at or above the target', () => {
    const container = buildContainer({
      foreground: {
        main: {
          $type: 'color',
          $value: '{color.primitive.neutral.900}',
          $extensions: {
            'com.pigmint': {
              usage: 'text',
              modes: {
                light: makeEntry({
                  compliance: { level: 'AAA-text', target: 'AAA' },
                  contrast: { wcag21: 12.1 },
                }),
              },
            },
          },
        },
      },
    });

    const { violations } = runCheckers({
      container,
      target: 'AA',
      expectedModes: ['light'],
    });

    expect(violations).toHaveLength(0);
  });
});
