import type { CSSProperties } from 'react';
import { StickerPanel } from './components/StickerPanel';
import tokens from './generated/tokens.json';
import {
  CvdFilterDefs,
  CVD_PROFILE_LABELS,
  cvdFilterId,
  type CvdProfile,
} from './cvd';

interface ModeSpec {
  mode: string;
  label: string;
  className: string;
}

const MODES: ModeSpec[] = [
  { mode: 'light', label: 'Light', className: '' },
  { mode: 'dark', label: 'Dark', className: 'dark' },
  { mode: 'light-high-contrast', label: 'Light · HC', className: 'light-high-contrast' },
  { mode: 'dark-high-contrast', label: 'Dark · HC', className: 'dark-high-contrast' },
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

export default function App() {
  const cvd = readCvd();
  const rows = buildRows(cvd);

  return (
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

      <header style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
          Sticker sheet · Tailwind adapter
        </h1>
        <p style={{ margin: 0, fontSize: 13, opacity: 0.75, maxWidth: 760 }}>
          Verification surface for <code>@pigmint/adapter-tailwind</code>. Each panel renders the
          same component set against a different engine mode using the CSS vars in{' '}
          <code>src/generated/tokens.css</code>. Regenerate via{' '}
          <code>pnpm --filter @pigmint/sticker-sheet-tailwind generate:tokens</code>. HC panels pick
          higher-contrast primitives than their base-mode counterparts — text AA floors lift to 7:1,
          non-text floors lift to 4.5:1. CVD rows apply Machado 2009 feColorMatrix filters to the
          rendered output to preview how the same tokens appear under colour-vision deficiency;
          filters are purely visual — tokens and receipts are unchanged.
        </p>
      </header>

      {rows.map((row) => (
        <CvdRow key={row.key} row={row} />
      ))}
    </div>
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
          <StickerPanel key={m.mode} mode={m.mode} label={m.label} className={m.className} />
        ))}
      </div>
    </section>
  );
}
