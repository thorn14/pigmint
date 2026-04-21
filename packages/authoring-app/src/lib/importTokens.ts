import { parse, formatHex, converter } from 'culori';
import type { OklchColor } from '../types/palette';

const toOklch = converter('oklch');

export interface ImportedStep {
  name: string;
  hex: string;
  oklch: OklchColor;
}

export interface ImportedScale {
  name: string;
  steps: ImportedStep[];
  sourceHex: string;
  sourceOklch: OklchColor;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function resolveHexFromValue(val: unknown): string | null {
  if (typeof val === 'string') {
    const parsed = parse(val);
    return parsed ? (formatHex(parsed) ?? null) : null;
  }

  if (isObj(val)) {
    if (typeof val.hex === 'string') {
      const parsed = parse(val.hex);
      if (parsed) return formatHex(parsed) ?? null;
    }

    // Figma native RGBA object with 0–255 integers (lukasoppermann original format)
    // or 0–1 floats (Figma REST API / variables)
    if (typeof val.r === 'number' && typeof val.g === 'number' && typeof val.b === 'number') {
      // Detect 0–255 range vs 0–1 range
      const isBytes = val.r > 1 || val.g > 1 || val.b > 1;
      const r = isBytes ? (val.r as number) / 255 : (val.r as number);
      const g = isBytes ? (val.g as number) / 255 : (val.g as number);
      const b = isBytes ? (val.b as number) / 255 : (val.b as number);
      const hex = formatHex({ mode: 'rgb', r, g, b });
      return hex ?? null;
    }

    if (typeof val.colorSpace === 'string' && Array.isArray(val.components)) {
      const cs = val.colorSpace;
      const comps = val.components.map((c: unknown) =>
        c === 'none' ? 0 : typeof c === 'number' ? c : 0
      );
      const alpha = typeof val.alpha === 'number' ? val.alpha : 1;

      try {
        const culoriColor = { mode: cs, ...spreadComponents(cs, comps), alpha } as Parameters<typeof formatHex>[0];
        const hex = formatHex(culoriColor);
        return hex ?? null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

function spreadComponents(colorSpace: string, comps: number[]): Record<string, number> {
  switch (colorSpace) {
    case 'oklch':
      return { l: comps[0] ?? 0, c: comps[1] ?? 0, h: comps[2] ?? 0 };
    case 'oklab':
      return { l: comps[0] ?? 0, a: comps[1] ?? 0, b: comps[2] ?? 0 };
    case 'lch':
      return { l: comps[0] ?? 0, c: comps[1] ?? 0, h: comps[2] ?? 0 };
    case 'lab':
      return { l: comps[0] ?? 0, a: comps[1] ?? 0, b: comps[2] ?? 0 };
    case 'hsl':
      return { h: comps[0] ?? 0, s: comps[1] ?? 0, l: comps[2] ?? 0 };
    case 'hwb':
      return { h: comps[0] ?? 0, w: comps[1] ?? 0, b: comps[2] ?? 0 };
    case 'srgb':
    case 'srgb-linear':
    case 'display-p3':
    case 'a98-rgb':
    case 'prophoto-rgb':
    case 'rec2020':
      return { r: comps[0] ?? 0, g: comps[1] ?? 0, b: comps[2] ?? 0 };
    default:
      return { r: comps[0] ?? 0, g: comps[1] ?? 0, b: comps[2] ?? 0 };
  }
}

function hexToOklchSafe(hex: string): OklchColor {
  const parsed = parse(hex);
  if (!parsed) return { l: 0, c: 0, h: 0 };
  const o = toOklch(parsed);
  if (!o) return { l: 0, c: 0, h: 0 };
  return { l: o.l ?? 0, c: o.c ?? 0, h: o.h ?? 0, alpha: o.alpha };
}

function isToken(obj: Record<string, unknown>): boolean {
  return '$value' in obj || 'value' in obj;
}

function inheritsColorType(obj: Record<string, unknown>, parentType?: string): string | undefined {
  if (typeof obj.$type === 'string') return obj.$type;
  if (typeof obj.type === 'string') return obj.type;
  return parentType;
}

function getTokenValue(obj: Record<string, unknown>): unknown {
  if ('$value' in obj) return obj.$value;
  return obj.value;
}

/** Match alias reference values like {.scale.blues.blue[700]} */
const ALIAS_RE = /^\{[^{}]+\}$/;

function isAliasValue(val: unknown): val is string {
  return typeof val === 'string' && ALIAS_RE.test(val);
}

/** Extract the top-level collection name from an alias like {.scale.blues.blue[700]} → ".scale" */
function aliasCollection(alias: string): string {
  return alias.replace(/^\{/, '').split('.')[0] ?? '';
}

/**
 * Recursively walk the JSON tree and collect groups of color tokens.
 * A "group" is any object that contains child tokens with type "color".
 */
function collectColorGroups(
  node: Record<string, unknown>,
  path: string[],
  parentType: string | undefined,
  results: Map<string, ImportedStep[]>,
  aliasCollections: Set<string>,
) {
  const groupType = inheritsColorType(node, parentType);

  const localTokens: ImportedStep[] = [];
  const childGroups: Array<[string, Record<string, unknown>]> = [];

  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('$')) continue;
    if (!isObj(value)) continue;

    if (isToken(value)) {
      const tokenType = inheritsColorType(value, groupType);
      if (tokenType?.toLowerCase() !== 'color') continue;

      const raw = getTokenValue(value);
      if (isAliasValue(raw)) {
        aliasCollections.add(aliasCollection(raw));
        continue;
      }

      const hex = resolveHexFromValue(raw);
      if (!hex) continue;

      localTokens.push({
        name: key,
        hex,
        oklch: hexToOklchSafe(hex),
      });
    } else {
      childGroups.push([key, value]);
    }
  }

  if (localTokens.length > 0) {
    results.set(path.join('.') || 'root', localTokens);
  }

  for (const [key, child] of childGroups) {
    collectColorGroups(child, [...path, key], groupType, results, aliasCollections);
  }
}

function pickSourceStep(steps: ImportedStep[]): ImportedStep {
  const midIdx = Math.floor(steps.length / 2);

  const named500 = steps.find((s) => s.name === '500');
  if (named500) return named500;

  return steps[midIdx] ?? steps[0];
}

function groupsToScales(groups: Map<string, ImportedStep[]>): ImportedScale[] {
  const scales: ImportedScale[] = [];
  for (const [path, steps] of groups) {
    const parts = path.split('.');
    const name = parts[parts.length - 1] || 'Imported';
    const source = pickSourceStep(steps);
    scales.push({ name, steps, sourceHex: source.hex, sourceOklch: source.oklch });
  }
  return scales;
}

/**
 * Parse Figma Variables REST API / Export format:
 * { variables: [...], variableCollections: [...] }
 * Colors are { r, g, b, a } with 0–1 component range.
 */
function parseFigmaVariables(data: Record<string, unknown>): ImportedScale[] {
  const variables = data.variables;
  const collections = data.variableCollections;
  if (!Array.isArray(variables) || !Array.isArray(collections)) return [];

  const defaultModes = new Map<string, string>();
  for (const col of collections) {
    if (isObj(col) && typeof col.id === 'string' && typeof col.defaultModeId === 'string') {
      defaultModes.set(col.id, col.defaultModeId);
    }
  }

  const groups = new Map<string, ImportedStep[]>();

  for (const variable of variables) {
    if (!isObj(variable)) continue;
    if (variable.resolvedType !== 'COLOR') continue;

    const name = typeof variable.name === 'string' ? variable.name : '';
    const parts = name.split('/');
    const stepName = parts[parts.length - 1] ?? name;
    const groupPath = parts.slice(0, -1).join('.');

    const collectionId = typeof variable.variableCollectionId === 'string' ? variable.variableCollectionId : '';
    const defaultMode = defaultModes.get(collectionId) ?? '';

    const valuesByMode = variable.valuesByMode;
    if (!isObj(valuesByMode)) continue;

    const modeValue = isObj(valuesByMode[defaultMode])
      ? valuesByMode[defaultMode]
      : Object.values(valuesByMode).find(isObj);
    if (!isObj(modeValue)) continue;

    // Skip variable aliases
    if (modeValue.type === 'VARIABLE_ALIAS') continue;

    if (typeof modeValue.r !== 'number' || typeof modeValue.g !== 'number' || typeof modeValue.b !== 'number') continue;

    const hex = formatHex({
      mode: 'rgb',
      r: modeValue.r as number,
      g: modeValue.g as number,
      b: modeValue.b as number,
      alpha: typeof modeValue.a === 'number' ? (modeValue.a as number) : 1,
    });
    if (!hex) continue;

    const step: ImportedStep = { name: stepName, hex, oklch: hexToOklchSafe(hex) };
    const existing = groups.get(groupPath);
    if (existing) existing.push(step);
    else groups.set(groupPath, [step]);
  }

  return groupsToScales(groups);
}

export function parseW3CTokens(json: string): ImportedScale[] {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('Invalid JSON');
  }
  if (!isObj(data)) throw new Error('Expected a JSON object at the root');

  // Auto-detect Figma Variables export format
  if (Array.isArray(data.variables) && Array.isArray(data.variableCollections)) {
    const scales = parseFigmaVariables(data);
    if (scales.length === 0) throw new Error('No color tokens found in the file');
    return scales;
  }

  const groups = new Map<string, ImportedStep[]>();
  const aliasRefs = new Set<string>();
  collectColorGroups(data, [], undefined, groups, aliasRefs);

  if (groups.size === 0) {
    if (aliasRefs.size > 0) {
      const names = [...aliasRefs]
        .filter(Boolean)
        .map((c) => `"${c}"`)
        .join(', ');
      throw new Error(
        `All color tokens are variable aliases referencing ${names}. ` +
        `Export that collection too — in the plugin, remove the leading "." or "_" from the collection name so it is included in the export.`
      );
    }
    throw new Error('No color tokens found in the file');
  }

  return groupsToScales(groups);
}
