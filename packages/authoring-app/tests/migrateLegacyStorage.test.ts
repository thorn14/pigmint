import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrateLegacyStorage } from '../src/store/paletteStore';

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

const LEGACY = 'palette-pal:color-tokens';
const CURRENT = 'pigmint:color-tokens';

beforeEach(() => {
  (globalThis as unknown as { localStorage?: Storage }).localStorage =
    new MemoryStorage() as unknown as Storage;
});

afterEach(() => {
  delete (globalThis as unknown as { localStorage?: Storage }).localStorage;
});

describe('migrateLegacyStorage', () => {
  it('copies legacy key value to the current key and deletes the legacy key', () => {
    const payload = JSON.stringify({ version: 2, palettes: [] });
    localStorage.setItem(LEGACY, payload);

    const moved = migrateLegacyStorage();

    expect(moved).toBe(payload);
    expect(localStorage.getItem(CURRENT)).toBe(payload);
    expect(localStorage.getItem(LEGACY)).toBeNull();
  });

  it('does nothing when the current key is already populated', () => {
    localStorage.setItem(CURRENT, '{"version":2,"palettes":[]}');
    localStorage.setItem(LEGACY, '{"should":"not-move"}');

    const moved = migrateLegacyStorage();

    expect(moved).toBeNull();
    expect(localStorage.getItem(CURRENT)).toBe('{"version":2,"palettes":[]}');
    expect(localStorage.getItem(LEGACY)).toBe('{"should":"not-move"}');
  });

  it('returns null when the legacy key is absent', () => {
    expect(migrateLegacyStorage()).toBeNull();
    expect(localStorage.getItem(CURRENT)).toBeNull();
  });

  it('is a no-op when localStorage is unavailable', () => {
    delete (globalThis as unknown as { localStorage?: Storage }).localStorage;
    expect(migrateLegacyStorage()).toBeNull();
  });
});
