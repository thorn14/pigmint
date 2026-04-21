import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  hasFileSystemAccess,
  saveToExistingHandle,
  saveToNewFile,
} from '../src/lib/fileSystem';

interface FakeWritable {
  write: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

function fakeHandle(name: string): {
  handle: { name: string; createWritable: () => Promise<FakeWritable> };
  writable: FakeWritable;
} {
  const writable: FakeWritable = {
    write: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
  };
  return {
    handle: {
      name,
      createWritable: vi.fn(async () => writable),
    },
    writable,
  };
}

const win = globalThis as unknown as {
  window?: Record<string, unknown>;
  document?: unknown;
};

const options = {
  suggestedName: 'pigmint.yaml',
  mimeType: 'application/yaml',
  types: [{ description: 'pigmint config', accept: { 'application/yaml': ['.yaml'] } }],
};

beforeEach(() => {
  win.window = {};
});

afterEach(() => {
  delete win.window;
  delete win.document;
  vi.restoreAllMocks();
});

describe('hasFileSystemAccess', () => {
  it('returns false when showSaveFilePicker is missing', () => {
    expect(hasFileSystemAccess()).toBe(false);
  });

  it('returns true when showSaveFilePicker exists', () => {
    win.window!.showSaveFilePicker = vi.fn();
    expect(hasFileSystemAccess()).toBe(true);
  });
});

describe('saveToNewFile', () => {
  it('falls back to download when the picker is unavailable', async () => {
    const clickedAnchor: { href?: string; download?: string } = {};
    win.document = {
      createElement: () => ({
        set href(v: string) { clickedAnchor.href = v; },
        set download(v: string) { clickedAnchor.download = v; },
        click: () => undefined,
      }),
    };
    const originalBlob = globalThis.Blob;
    const originalURL = globalThis.URL;
    (globalThis as unknown as { Blob: typeof Blob }).Blob = class {
      constructor(public parts: unknown[], public opts: unknown) {}
    } as unknown as typeof Blob;
    (globalThis as unknown as { URL: typeof URL }).URL = {
      createObjectURL: () => 'blob:stub',
      revokeObjectURL: () => undefined,
    } as unknown as typeof URL;

    try {
      const { result, handle } = await saveToNewFile('hello', options);
      expect(result).toEqual({ kind: 'downloaded', fileName: 'pigmint.yaml' });
      expect(handle).toBeNull();
      expect(clickedAnchor.download).toBe('pigmint.yaml');
    } finally {
      globalThis.Blob = originalBlob;
      globalThis.URL = originalURL;
    }
  });

  it('writes through the picker-returned handle and returns it', async () => {
    const { handle, writable } = fakeHandle('my.yaml');
    win.window!.showSaveFilePicker = vi.fn(async () => handle);

    const { result, handle: returnedHandle } = await saveToNewFile('hello', options);

    expect(result).toEqual({ kind: 'saved', fileName: 'my.yaml' });
    expect(returnedHandle).toBe(handle);
    expect(writable.write).toHaveBeenCalledWith('hello');
    expect(writable.close).toHaveBeenCalled();
  });

  it('returns cancelled when the user dismisses the picker', async () => {
    const abort = new Error('aborted');
    abort.name = 'AbortError';
    win.window!.showSaveFilePicker = vi.fn(async () => {
      throw abort;
    });

    const { result, handle } = await saveToNewFile('hello', options);

    expect(result).toEqual({ kind: 'cancelled' });
    expect(handle).toBeNull();
  });

  it('rethrows non-abort errors from the picker', async () => {
    win.window!.showSaveFilePicker = vi.fn(async () => {
      throw new Error('boom');
    });

    await expect(saveToNewFile('hello', options)).rejects.toThrow('boom');
  });
});

describe('saveToExistingHandle', () => {
  it('writes to the supplied handle without invoking a picker', async () => {
    const { handle, writable } = fakeHandle('existing.yaml');

    const result = await saveToExistingHandle(handle, 'payload');

    expect(result).toEqual({ kind: 'saved', fileName: 'existing.yaml' });
    expect(writable.write).toHaveBeenCalledWith('payload');
    expect(writable.close).toHaveBeenCalled();
  });
});
