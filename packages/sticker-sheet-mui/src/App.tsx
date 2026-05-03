import type { CSSProperties } from 'react';
import { CssVarsProvider } from '@mui/material/styles';
import { pigmintTheme } from './generated/theme';
import receipts from './generated/receipts.json';
import tokens from './generated/tokens.json';
import { validatePigmintTheme, type MuiThemeLike, type MuiReceipts } from '@pigmint/adapter-mui/runtime';
import { StickerPanel } from './components/StickerPanel';
import {
  CvdFilterDefs,
  CVD_PROFILE_LABELS,
  cvdFilterId,
  type CvdProfile,
} from './cvd';

interface ModeSpec {
  mode: string;
  label: string;
}

const MODES: ModeSpec[] = [
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Dark' },
];

interface ConfiguredCvd {
  profiles: CvdProfile[];
}

const KNOWN_CVD: Record<string, CvdProfile> = {
  deuteranopia: 'deuteranopia',
  protanopia: 'protanopia',
  tritanopia: 'tritanopia',
  achromatopsia: 'achromatopsia',
};

function readCvd(): ConfiguredCvd {
  const ext = (tokens as { $extensions?: { 'com.pigmint'?: { engine?: { cvd?: unknown } } } })
    .$extensions?.['com.pigmint']?.engine?.cvd;
  if (!Array.isArray(ext)) return { profiles: [] };
  const seen = new Set<CvdProfile>();
  const out: CvdProfile[] = [];
  for (const raw of ext) {
    if (typeof raw !== 'string') continue;
    const profile = KNOWN_CVD[raw];
    if (profile && !seen.has(profile)) {
      seen.add(profile);
      out.push(profile);
    }
  }
  return { profiles: out };
}

interface Row {
  key: string;
  label: string;
  filterProfile: CvdProfile | null;
}

function buildRows(cvd: ConfiguredCvd): Row[] {
  const rows: Row[] = [{ key: 'normal', label: 'Normal vision', filterProfile: null }];
  for (const profile of cvd.profiles) {
    rows.push({ key: profile, label: CVD_PROFILE_LABELS[profile], filterProfile: profile });
  }
  return rows;
}

function ValidationBadge() {
  const result = validatePigmintTheme(
    pigmintTheme as unknown as MuiThemeLike,
    receipts as MuiReceipts,
  );
  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px 10px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.04em',
    background: result.ok ? '#16a34a22' : '#dc262622',
    color: result.ok ? '#16a34a' : '#dc2626',
    border: `1px solid ${result.ok ? '#16a34a44' : '#dc262644'}`,
  };
  return (
    <span style={style}>
      {result.ok
        ? `✓ runtime ok — ${result.checked} palette entries validated`
        : `✗ ${result.drifts.length} drift(s) — ${result.checked} entries checked`}
    </span>
  );
}

export default function App() {
  const cvd = readCvd();
  const rows = buildRows(cvd);

  return (
    <CssVarsProvider theme={pigmintTheme} defaultColorScheme="light">
      <div
        style={{
          minHeight: '100%',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        <CvdFilterDefs profiles={cvd.profiles} />

        <header style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            Sticker sheet · MUI adapter
          </h1>
          <p style={{ margin: 0, fontSize: 13, opacity: 0.75, maxWidth: 760 }}>
            Verification surface for <code>@pigmint/adapter-mui</code>. Each panel renders MUI
            components under a forced <code>data-color-scheme</code> scope using the pigmint-generated
            theme object in <code>src/generated/theme.ts</code>. The runtime validator checks for
            drift between the emitted receipts and the live theme. Regenerate via{' '}
            <code>pnpm --filter @pigmint/sticker-sheet-mui generate:tokens</code>.
          </p>
          <ValidationBadge />
        </header>

        {rows.map((row) => (
          <CvdRow key={row.key} row={row} />
        ))}
      </div>
    </CssVarsProvider>
  );
}

function CvdRow({ row }: { row: Row }) {
  const sectionStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  };

  const gridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
    gap: 16,
    alignItems: 'start',
    ...(row.filterProfile
      ? { filter: `url(#${cvdFilterId(row.filterProfile)})` }
      : {}),
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'baseline',
    gap: 10,
    fontSize: 12,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    opacity: 0.7,
  };

  return (
    <section style={sectionStyle} aria-label={row.label}>
      <header style={headerStyle}>
        <strong style={{ fontSize: 12, fontWeight: 700 }}>{row.label}</strong>
        {row.filterProfile && (
          <code style={{ fontSize: 11, fontFamily: 'monospace', opacity: 0.7 }}>
            filter: {row.filterProfile}
          </code>
        )}
      </header>
      <div style={gridStyle}>
        {MODES.map((m) => (
          <StickerPanel key={m.mode} mode={m.mode} label={m.label} />
        ))}
      </div>
    </section>
  );
}
