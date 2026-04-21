import { describe, it, expect } from 'vitest';
import {
  validatePigmintTheme,
  type MuiReceipts,
  type MuiThemeLike,
} from '../src/runtime/index.js';

const receipts: MuiReceipts = {
  artifactVersion: 'mui-receipts@0.1',
  defaultMode: 'light',
  tokens: [
    {
      tokenPath: 'color.surface.main',
      palettePaths: ['background.default'],
      modes: { light: '#ffffff', dark: '#0a0a0a' },
    },
    {
      tokenPath: 'color.action.primary.background',
      palettePaths: ['primary.main'],
      modes: { light: '#3366cc', dark: '#87b2ff' },
    },
  ],
};

describe('validatePigmintTheme', () => {
  it('returns ok when the theme matches receipts exactly', () => {
    const theme: MuiThemeLike = {
      colorSchemes: {
        light: { palette: { background: { default: '#ffffff' }, primary: { main: '#3366cc' } } },
        dark: { palette: { background: { default: '#0a0a0a' }, primary: { main: '#87b2ff' } } },
      },
    };
    const result = validatePigmintTheme(theme, receipts);
    expect(result.ok).toBe(true);
    expect(result.drifts).toHaveLength(0);
    expect(result.checked).toBe(4);
  });

  it('detects overrides', () => {
    const theme: MuiThemeLike = {
      colorSchemes: {
        light: { palette: { background: { default: '#ffffff' }, primary: { main: '#ff0000' } } },
        dark: { palette: { background: { default: '#0a0a0a' }, primary: { main: '#87b2ff' } } },
      },
    };
    const result = validatePigmintTheme(theme, receipts);
    expect(result.ok).toBe(false);
    const override = result.drifts.find((d) => d.kind === 'override');
    expect(override).toBeDefined();
    expect(override!.palettePath).toBe('primary.main');
    expect(override!.mode).toBe('light');
    expect(override!.actual).toBe('#ff0000');
    expect(override!.expected).toBe('#3366cc');
  });

  it('detects missing palette entries', () => {
    const theme: MuiThemeLike = {
      colorSchemes: {
        light: { palette: { background: { default: '#ffffff' } } },
        dark: { palette: { background: { default: '#0a0a0a' }, primary: { main: '#87b2ff' } } },
      },
    };
    const result = validatePigmintTheme(theme, receipts);
    const missing = result.drifts.find((d) => d.kind === 'missing-palette-entry');
    expect(missing).toBeDefined();
    expect(missing!.palettePath).toBe('primary.main');
    expect(missing!.mode).toBe('light');
  });

  it('detects missing mode (no palette for the mode)', () => {
    const theme: MuiThemeLike = {
      colorSchemes: {
        light: { palette: { background: { default: '#ffffff' }, primary: { main: '#3366cc' } } },
      },
    };
    const result = validatePigmintTheme(theme, receipts);
    const missingMode = result.drifts.filter((d) => d.kind === 'missing-mode');
    expect(missingMode.length).toBeGreaterThan(0);
    expect(missingMode.every((d) => d.mode === 'dark')).toBe(true);
  });

  it('normalizes 3-digit hex to 6-digit before comparing', () => {
    const theme: MuiThemeLike = {
      colorSchemes: {
        light: { palette: { background: { default: '#fff' }, primary: { main: '#3366cc' } } },
        dark: { palette: { background: { default: '#0a0a0a' }, primary: { main: '#87b2ff' } } },
      },
    };
    const result = validatePigmintTheme(theme, receipts);
    expect(result.ok).toBe(true);
  });
});
