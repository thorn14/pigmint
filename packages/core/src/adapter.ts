import type { DtcgContainer } from './emitter/dtcg.js';
import type { AdapterConfig, ProjectConfig } from './types/spec.js';

export interface AdapterManifest {
  name: string;
  version: string;
  enforcementMode: 'compile-time' | 'runtime';
  supportedModes: string[];
  requiredRamps?: { minCount?: number; neutralRequired?: boolean };
  requiredPrimitives?: { positions?: (string | number)[]; minCount?: number };
  outputFormats?: string[];
  alpha?: { supported: boolean; modes?: string[]; default?: string };
  presets?: string[];
  supportedCategories?: string[];
  runtimeValidator?: unknown;
}

export interface AdapterInvocation {
  container: DtcgContainer;
  adapterConfig: AdapterConfig;
  projectConfig: ProjectConfig;
}

export interface AdapterFile {
  path: string;
  content: string;
}

export interface AdapterResult {
  files: AdapterFile[];
  warnings?: string[];
}

export interface Adapter {
  manifest: AdapterManifest;
  emit(invocation: AdapterInvocation): AdapterResult | Promise<AdapterResult>;
}

export class AdapterValidationError extends Error {
  constructor(
    message: string,
    readonly adapter: string,
  ) {
    super(message);
    this.name = 'AdapterValidationError';
  }
}

export function validateAdapterAgainstConfig(
  manifest: AdapterManifest,
  adapterConfig: AdapterConfig,
  projectConfig: ProjectConfig,
): string[] {
  const warnings: string[] = [];

  for (const mode of projectConfig.engine.modes) {
    if (!manifest.supportedModes.includes(mode)) {
      throw new AdapterValidationError(
        `adapter "${manifest.name}" does not support mode "${mode}" (supportedModes: ${manifest.supportedModes.join(', ')})`,
        manifest.name,
      );
    }
  }

  if (adapterConfig.preset && manifest.presets && !manifest.presets.includes(adapterConfig.preset)) {
    throw new AdapterValidationError(
      `adapter "${manifest.name}" does not support preset "${adapterConfig.preset}" (available: ${manifest.presets.join(', ')})`,
      manifest.name,
    );
  }

  if (adapterConfig.alpha?.enabled && !manifest.alpha?.supported) {
    throw new AdapterValidationError(
      `adapter "${manifest.name}" does not support alpha but pigmint.yaml requests it`,
      manifest.name,
    );
  }

  return warnings;
}
