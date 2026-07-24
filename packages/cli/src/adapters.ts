import { readdir } from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import { muiAdapter } from '@pigmint/adapter-mui';
import { tailwindAdapter } from '@pigmint/adapter-tailwind';
import type { Adapter } from '@pigmint/core';

export const ADAPTER_REGISTRY: Record<string, Adapter> = {
  mui: muiAdapter,
  tailwind: tailwindAdapter,
};

// Directory holding private, gitignored adapters. Each subdirectory ships a built
// `dist/index.js` that exports an `Adapter` (any export shape — we detect it by duck-typing).
// Resolved relative to this compiled module (…/packages/cli/dist/adapters.js) so discovery is
// independent of the current working directory. Absent for anyone who has not added a local
// adapter, in which case discovery is a no-op.
const LOCAL_ADAPTERS_DIR = new URL('../local-adapters/', import.meta.url);

function isAdapter(value: unknown): value is Adapter {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Adapter>;
  return (
    typeof candidate.emit === 'function' &&
    typeof candidate.manifest?.name === 'string'
  );
}

let localAdaptersLoaded = false;

/**
 * Discover and register private adapters from `packages/cli/local-adapters/*`. Idempotent, and
 * silent when the directory is missing or an adapter has not been built yet. Call once during
 * CLI startup before any {@link resolveAdapter} lookup.
 */
export async function loadLocalAdapters(): Promise<void> {
  if (localAdaptersLoaded) return;
  localAdaptersLoaded = true;

  let entries: Dirent[];
  try {
    entries = await readdir(LOCAL_ADAPTERS_DIR, { withFileTypes: true });
  } catch {
    return; // no local-adapters/ directory — nothing to discover
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const moduleUrl = new URL(`${entry.name}/dist/index.js`, LOCAL_ADAPTERS_DIR).href;
    let mod: Record<string, unknown>;
    try {
      mod = (await import(moduleUrl)) as Record<string, unknown>;
    } catch {
      continue; // not built yet or not an ES module — skip
    }
    const adapter = Object.values(mod).find(isAdapter);
    if (adapter) {
      ADAPTER_REGISTRY[adapter.manifest.name] = adapter;
    }
  }
}

export function resolveAdapter(name: string): Adapter {
  const adapter = ADAPTER_REGISTRY[name];
  if (!adapter) {
    throw new Error(
      `unknown adapter "${name}" (known: ${Object.keys(ADAPTER_REGISTRY).join(', ')})`,
    );
  }
  return adapter;
}
