import type { DtcgContainer, ModeEntry } from '@pigmint/core';

export type SemanticUsage = 'text' | 'nonText' | 'decorative';

export interface AuditToken {
  path: string;
  usage: SemanticUsage;
  primarySurface?: string;
  modes: Record<string, ModeEntry>;
}

interface PigExtensions {
  usage?: SemanticUsage;
  primarySurface?: string;
  modes?: Record<string, ModeEntry>;
}

function readPigExtensions(node: Record<string, unknown>): PigExtensions | null {
  const ext = node.$extensions as Record<string, unknown> | undefined;
  if (!ext) return null;
  const pig = ext['com.pigmint'];
  if (!pig || typeof pig !== 'object') return null;
  return pig as PigExtensions;
}

function walk(
  node: Record<string, unknown>,
  prefix: string,
  out: AuditToken[],
): void {
  const pig = readPigExtensions(node);
  if (pig?.modes && typeof node.$value === 'string') {
    out.push({
      path: prefix,
      usage: pig.usage ?? 'nonText',
      primarySurface: pig.primarySurface,
      modes: pig.modes,
    });
    return;
  }
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith('$')) continue;
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      walk(child as Record<string, unknown>, prefix ? `${prefix}.${key}` : key, out);
    }
  }
}

export function collectSemanticTokens(container: DtcgContainer): AuditToken[] {
  const out: AuditToken[] = [];
  for (const [key, child] of Object.entries(container)) {
    if (key.startsWith('$') || key === 'primitive') continue;
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      walk(child as Record<string, unknown>, key, out);
    }
  }
  return out;
}
