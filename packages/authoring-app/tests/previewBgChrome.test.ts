import { describe, expect, it } from 'vitest';
import {
  applyPreviewBgChrome,
  clearPreviewBgChrome,
  PREVIEW_BG_CHROME_VARS,
} from '../src/lib/previewBgChrome';

function fakeStyle(): CSSStyleDeclaration & { _map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    _map: map,
    setProperty(name: string, value: string) {
      map.set(name, value);
    },
    removeProperty(name: string) {
      map.delete(name);
      return '';
    },
    getPropertyValue(name: string) {
      return map.get(name) ?? '';
    },
  } as unknown as CSSStyleDeclaration & { _map: Map<string, string> };
}

describe('previewBgChrome', () => {
  it('applies light chrome overlays for a light background', () => {
    const style = fakeStyle();
    applyPreviewBgChrome('#f5f5f4', style);
    expect(style.getPropertyValue('--p-bg')).toBe('#f5f5f4');
    expect(style.getPropertyValue('--p-text')).toBe('#000000');
    expect(style.getPropertyValue('--p-bg-glass')).toMatch(/^rgba\(/);
  });

  it('applies dark chrome overlays for a dark background', () => {
    const style = fakeStyle();
    applyPreviewBgChrome('#1c1917', style);
    expect(style.getPropertyValue('--p-bg')).toBe('#1c1917');
    expect(style.getPropertyValue('--p-text')).toBe('#ffffff');
  });

  it('clearPreviewBgChrome removes every overridden variable', () => {
    const style = fakeStyle();
    applyPreviewBgChrome('#ffffff', style);
    clearPreviewBgChrome(style);
    for (const v of PREVIEW_BG_CHROME_VARS) {
      expect(style.getPropertyValue(v)).toBe('');
    }
  });
});
