import { muiAdapter } from '@pigmint/adapter-mui';
import { tailwindAdapter } from '@pigmint/adapter-tailwind';
import type { Adapter } from '@pigmint/core';

export const ADAPTER_REGISTRY: Record<string, Adapter> = {
  mui: muiAdapter,
  tailwind: tailwindAdapter,
};

export function resolveAdapter(name: string): Adapter {
  const adapter = ADAPTER_REGISTRY[name];
  if (!adapter) {
    throw new Error(
      `unknown adapter "${name}" (known: ${Object.keys(ADAPTER_REGISTRY).join(', ')})`,
    );
  }
  return adapter;
}
