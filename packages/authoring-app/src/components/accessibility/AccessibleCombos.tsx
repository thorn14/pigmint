import { useMemo, useState, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { usePaletteStore } from '../../store/paletteStore';
import { generateRamp } from '../../lib/colorMath';
import { getContrast, getApcaContrast } from '../../lib/colorMath';
import type { WcagMapEntry, ApcaMapEntry, ContrastMapColorRef, ContrastMode } from '../../types/palette';

type WcagLevel = 'aaa' | 'aa' | 'aa-large';
type ApcaLevel = 'lc75' | 'lc60' | 'lc45';
type Polarity = 'all' | 'light' | 'dark';

const WCAG_LEVELS: { key: WcagLevel; label: string; sub: string }[] = [
  { key: 'aaa', label: 'AAA', sub: '≥ 7:1' },
  { key: 'aa', label: 'AA', sub: '≥ 4.5:1' },
  { key: 'aa-large', label: 'AA Large', sub: '≥ 3:1' },
];

const APCA_LEVELS: { key: ApcaLevel; label: string; sub: string }[] = [
  { key: 'lc75', label: 'Lc 75+', sub: '|Lc| ≥ 75' },
  { key: 'lc60', label: 'Lc 60+', sub: '|Lc| ≥ 60' },
  { key: 'lc45', label: 'Lc 45+', sub: '|Lc| ≥ 45' },
];

const COLS = 7;
const ROW_HEIGHT = 120;
const ROW_GAP = 8;

function hexLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function matchesPolarity(fg: ContrastMapColorRef, bg: ContrastMapColorRef, polarity: Polarity): boolean {
  if (polarity === 'all') return true;
  const fgL = hexLuminance(fg.hex);
  const bgL = hexLuminance(bg.hex);
  if (polarity === 'light') return bgL > fgL;
  return bgL < fgL;
}

function matchesSearch(
  fg: ContrastMapColorRef,
  bg: ContrastMapColorRef,
  query: string,
): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return fg.ramp.toLowerCase().includes(q) || fg.step.toLowerCase().includes(q) || fg.hex.toLowerCase().includes(q)
    || bg.ramp.toLowerCase().includes(q) || bg.step.toLowerCase().includes(q) || bg.hex.toLowerCase().includes(q);
}

function WcagComboCard({ entry }: { entry: WcagMapEntry }) {
  return (
    <div
      style={{
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid var(--p-border)',
        minWidth: 140,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          background: entry.bg.hex,
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <span style={{ color: entry.fg.hex, fontSize: 20, fontWeight: 700, lineHeight: 1 }}>Aa</span>
        <span style={{ color: entry.fg.hex, fontSize: 10, opacity: 0.85 }}>
          {entry.fg.ramp} {entry.fg.step}
        </span>
        <span style={{ color: entry.fg.hex, fontSize: 10, opacity: 0.6 }}>
          on {entry.bg.ramp} {entry.bg.step}
        </span>
      </div>
      <div
        style={{
          padding: '5px 8px',
          background: 'var(--p-bg-subtle)',
          fontSize: 10,
          color: 'var(--p-text-secondary)',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>{entry.ratio}:1</span>
        <span style={{ fontFamily: 'monospace', fontSize: 9, opacity: 0.7 }}>{entry.fg.hex}</span>
      </div>
    </div>
  );
}

function ApcaComboCard({ entry }: { entry: ApcaMapEntry }) {
  return (
    <div
      style={{
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid var(--p-border)',
        minWidth: 140,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          background: entry.bg.hex,
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <span style={{ color: entry.fg.hex, fontSize: 20, fontWeight: 700, lineHeight: 1 }}>Aa</span>
        <span style={{ color: entry.fg.hex, fontSize: 10, opacity: 0.85 }}>
          {entry.fg.ramp} {entry.fg.step}
        </span>
        <span style={{ color: entry.fg.hex, fontSize: 10, opacity: 0.6 }}>
          on {entry.bg.ramp} {entry.bg.step}
        </span>
      </div>
      <div
        style={{
          padding: '5px 8px',
          background: 'var(--p-bg-subtle)',
          fontSize: 10,
          color: 'var(--p-text-secondary)',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>Lc {entry.lc.toFixed(1)}</span>
        <span style={{ fontFamily: 'monospace', fontSize: 9, opacity: 0.7 }}>{entry.fg.hex}</span>
      </div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: '4px 8px',
  fontSize: 12,
  background: 'var(--p-bg-subtle)',
  border: '1px solid var(--p-border)',
  borderRadius: 6,
  color: 'var(--p-text)',
  cursor: 'pointer',
};

function FilterBar({
  search,
  setSearch,
  polarity,
  setPolarity,
  wcagLevel,
  setWcagLevel,
  apcaLevel,
  setApcaLevel,
  sortAsc,
  setSortAsc,
  contrastMode,
}: {
  search: string;
  setSearch: (s: string) => void;
  polarity: Polarity;
  setPolarity: (p: Polarity) => void;
  wcagLevel: WcagLevel;
  setWcagLevel: (l: WcagLevel) => void;
  apcaLevel: ApcaLevel;
  setApcaLevel: (l: ApcaLevel) => void;
  sortAsc: boolean;
  setSortAsc: (v: boolean) => void;
  contrastMode: ContrastMode;
}) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or hex…"
        aria-label="Search color combinations"
        spellCheck={false}
        className="focus-visible-ring"
        style={{ ...selectStyle, width: 180, cursor: 'text' }}
      />

      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <label htmlFor="combos-polarity" style={{ fontSize: 11, color: 'var(--p-text-tertiary)' }}>Background:</label>
        <select
          id="combos-polarity"
          value={polarity}
          onChange={(e) => setPolarity(e.target.value as Polarity)}
          style={selectStyle}
          className="focus-visible-ring"
        >
          <option value="all">All</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <label htmlFor="combos-level" style={{ fontSize: 11, color: 'var(--p-text-tertiary)' }}>Level:</label>
        {contrastMode === 'wcag' ? (
          <select
            id="combos-level"
            value={wcagLevel}
            onChange={(e) => setWcagLevel(e.target.value as WcagLevel)}
            style={selectStyle}
            className="focus-visible-ring"
          >
            {WCAG_LEVELS.map(({ key, label }) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        ) : (
          <select
            id="combos-level"
            value={apcaLevel}
            onChange={(e) => setApcaLevel(e.target.value as ApcaLevel)}
            style={selectStyle}
            className="focus-visible-ring"
          >
            {APCA_LEVELS.map(({ key, label }) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        )}
      </div>

      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <label htmlFor="combos-sort" style={{ fontSize: 11, color: 'var(--p-text-tertiary)' }}>Sort:</label>
        <select
          id="combos-sort"
          value={sortAsc ? 'asc' : 'desc'}
          onChange={(e) => setSortAsc(e.target.value === 'asc')}
          style={selectStyle}
          className="focus-visible-ring"
        >
          <option value="desc">High → Low</option>
          <option value="asc">Low → High</option>
        </select>
      </div>
    </div>
  );
}

export function AccessibleCombos() {
  const scales = usePaletteStore((s) => s.scales);
  const contrastMode = usePaletteStore((s) => s.contrastMode);

  const [search, setSearch] = useState('');
  const [polarity, setPolarity] = useState<Polarity>('all');
  const [wcagLevel, setWcagLevel] = useState<WcagLevel>('aa');
  const [apcaLevel, setApcaLevel] = useState<ApcaLevel>('lc60');
  const [sortAsc, setSortAsc] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Group steps by ramp so we only compare within the same ramp
  const stepsByRamp = useMemo(
    () =>
      scales.map((s) => {
        const ramp = generateRamp(s);
        return {
          name: ramp.scaleName,
          steps: ramp.steps.map((step) => ({ ramp: ramp.scaleName, step: step.name, hex: step.hex })),
        };
      }),
    [scales],
  );

  const totalSteps = useMemo(() => stepsByRamp.reduce((n, r) => n + r.steps.length, 0), [stepsByRamp]);

  // Compute only the active contrast mode's entries within each ramp, filtered by level and polarity
  const entries = useMemo(() => {
    const results: (WcagMapEntry | ApcaMapEntry)[] = [];

    for (const ramp of stepsByRamp) {
      const { steps } = ramp;
      for (const fg of steps) {
        for (const bg of steps) {
          if (fg.hex === bg.hex) continue;
          if (!matchesPolarity(fg, bg, polarity)) continue;
          if (!matchesSearch(fg, bg, search)) continue;

          if (contrastMode === 'wcag') {
            const { ratio } = getContrast(fg.hex, bg.hex);
            let pass = false;
            if (wcagLevel === 'aaa') pass = ratio >= 7;
            else if (wcagLevel === 'aa') pass = ratio >= 4.5;
            else pass = ratio >= 3;
            if (pass) {
              results.push({ fg, bg, ratio: Math.round(ratio * 100) / 100 } as WcagMapEntry);
            }
          } else {
            const lc = getApcaContrast(fg.hex, bg.hex);
            const absLc = Math.abs(lc);
            let pass = false;
            if (apcaLevel === 'lc75') pass = absLc >= 75;
            else if (apcaLevel === 'lc60') pass = absLc >= 60;
            else pass = absLc >= 45;
            if (pass) {
              results.push({ fg, bg, lc: Math.round(lc * 100) / 100 } as ApcaMapEntry);
            }
          }
        }
      }
    }

    const dir = sortAsc ? 1 : -1;
    if (contrastMode === 'wcag') {
      (results as WcagMapEntry[]).sort((a, b) => dir * (a.ratio - b.ratio));
    } else {
      (results as ApcaMapEntry[]).sort((a, b) => dir * (Math.abs(a.lc) - Math.abs(b.lc)));
    }

    return results;
  }, [stepsByRamp, contrastMode, search, polarity, wcagLevel, apcaLevel, sortAsc]);

  const activeLevel = contrastMode === 'wcag'
    ? WCAG_LEVELS.find((l) => l.key === wcagLevel)!
    : APCA_LEVELS.find((l) => l.key === apcaLevel)!;

  const rowCount = Math.ceil(entries.length / COLS);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT + ROW_GAP,
    overscan: 5,
  });

  return (
    <div
      ref={scrollRef}
      style={{
        flex: 1,
        overflow: 'auto',
        padding: '20px 24px',
        background: 'var(--p-bg)',
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--p-text)', margin: '0 0 4px 0' }}>
            Accessible Combinations — {contrastMode === 'wcag' ? 'WCAG 2.1' : 'APCA'}
          </h2>
          <p style={{ fontSize: 12, color: 'var(--p-text-secondary)', margin: 0 }}>
            {totalSteps} color steps across {scales.length} ramps (same-ramp pairs). Toggle WCAG / APCA in the toolbar.
          </p>
        </div>

        <FilterBar
          search={search}
          setSearch={setSearch}
          polarity={polarity}
          setPolarity={setPolarity}
          wcagLevel={wcagLevel}
          setWcagLevel={setWcagLevel}
          apcaLevel={apcaLevel}
          setApcaLevel={setApcaLevel}
          sortAsc={sortAsc}
          setSortAsc={setSortAsc}
          contrastMode={contrastMode}
        />

        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--p-text)' }}>
            {activeLevel.label}
          </span>
          <span style={{ fontSize: 11, color: 'var(--p-text-tertiary)' }}>{activeLevel.sub}</span>
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 11,
              color: 'var(--p-text-secondary)',
              background: 'var(--p-bg-subtle)',
              border: '1px solid var(--p-border)',
              borderRadius: 10,
              padding: '1px 7px',
            }}
          >
            {entries.length} pairs
          </span>
        </div>

        {entries.length === 0 ? (
          <span style={{ fontSize: 12, color: 'var(--p-text-tertiary)', padding: '4px 0' }}>
            No pairs match these filters
          </span>
        ) : (
          <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
            {rowVirtualizer.getVirtualItems().map((vRow) => {
              const startIdx = vRow.index * COLS;
              const rowEntries = entries.slice(startIdx, startIdx + COLS);
              return (
                <div
                  key={vRow.index}
                  style={{
                    position: 'absolute',
                    top: vRow.start,
                    left: 0,
                    right: 0,
                    height: ROW_HEIGHT,
                    display: 'grid',
                    gridTemplateColumns: `repeat(${COLS}, 1fr)`,
                    gap: ROW_GAP,
                  }}
                >
                  {contrastMode === 'wcag'
                    ? (rowEntries as WcagMapEntry[]).map((entry, i) => (
                        <WcagComboCard key={startIdx + i} entry={entry} />
                      ))
                    : (rowEntries as ApcaMapEntry[]).map((entry, i) => (
                        <ApcaComboCard key={startIdx + i} entry={entry} />
                      ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
