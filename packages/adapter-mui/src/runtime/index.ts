export interface MuiReceipts {
  artifactVersion: 'mui-receipts@0.1';
  defaultMode: string;
  tokens: Array<{
    tokenPath: string;
    palettePaths: string[];
    modes: Record<string, string>;
  }>;
}

export interface MuiThemeLike {
  colorSchemes?: Record<string, { palette?: Record<string, unknown> } | undefined>;
  palette?: Record<string, unknown>;
}

export type DriftKind = 'override' | 'missing-palette-entry' | 'missing-mode';

export interface Drift {
  kind: DriftKind;
  tokenPath: string;
  palettePath: string;
  mode: string;
  expected?: string;
  actual?: string;
}

export interface ValidationResult {
  ok: boolean;
  drifts: Drift[];
  checked: number;
}

function readPalettePath(
  palette: Record<string, unknown> | undefined,
  path: string,
): string | undefined {
  if (!palette) return undefined;
  const parts = path.split('.');
  let cursor: unknown = palette;
  for (const part of parts) {
    if (cursor && typeof cursor === 'object' && !Array.isArray(cursor)) {
      cursor = (cursor as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof cursor === 'string' ? cursor : undefined;
}

function paletteForMode(
  theme: MuiThemeLike,
  mode: string,
): Record<string, unknown> | undefined {
  const viaColorSchemes = theme.colorSchemes?.[mode]?.palette;
  if (viaColorSchemes) return viaColorSchemes;
  return theme.palette;
}

function normalizeColor(value: string | undefined): string | undefined {
  if (!value) return value;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed.startsWith('#')) return trimmed;
  if (trimmed.length === 4) {
    const r = trimmed[1]!;
    const g = trimmed[2]!;
    const b = trimmed[3]!;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return trimmed;
}

export function validatePigmintTheme(
  theme: MuiThemeLike,
  receipts: MuiReceipts,
): ValidationResult {
  const drifts: Drift[] = [];
  let checked = 0;

  for (const token of receipts.tokens) {
    for (const [mode, expected] of Object.entries(token.modes)) {
      const palette = paletteForMode(theme, mode);
      if (!palette) {
        drifts.push({
          kind: 'missing-mode',
          tokenPath: token.tokenPath,
          palettePath: token.palettePaths[0] ?? '',
          mode,
          expected,
        });
        continue;
      }
      for (const palettePath of token.palettePaths) {
        checked += 1;
        const actual = readPalettePath(palette, palettePath);
        if (actual === undefined) {
          drifts.push({
            kind: 'missing-palette-entry',
            tokenPath: token.tokenPath,
            palettePath,
            mode,
            expected,
          });
          continue;
        }
        if (normalizeColor(actual) !== normalizeColor(expected)) {
          drifts.push({
            kind: 'override',
            tokenPath: token.tokenPath,
            palettePath,
            mode,
            expected,
            actual,
          });
        }
      }
    }
  }

  return { ok: drifts.length === 0, drifts, checked };
}
