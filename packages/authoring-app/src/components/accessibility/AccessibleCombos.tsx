import { useMemo, useState, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { AppStringSelect } from '../base-ui';
import { useIntentStore } from '../../store/intentStore';
import { usePaletteStore, useTargetGamut } from '../../store/paletteStore';
import { generateRamp } from '../../lib/colorMath';
import { getContrast, getApcaContrast } from '../../lib/colorMath';
import type { WcagMapEntry, ApcaMapEntry, ContrastMapColorRef } from '../../types/palette';
import { ComboToTokenModal } from './ComboToTokenModal';
import type { GeneratedRamp } from '@pigmint/core';

type WcagLevel = 'aaa' | 'aa' | 'aa-large';
type ApcaLevel = 'lc75' | 'lc60' | 'lc45';
type Polarity = 'light' | 'dark';

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

const MIN_CARD_WIDTH = 140;
const MAX_COLS = 7;
const ROW_HEIGHT = 120;
const ROW_GAP = 8;

function hexLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function matchesPolarity(fg: ContrastMapColorRef, bg: ContrastMapColorRef, polarity: Polarity): boolean {
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

function ComboCardShell({
  entry,
  metric,
  onClick,
}: {
  entry: WcagMapEntry | ApcaMapEntry;
  metric: string;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="swatch-hover"
      style={{
        borderRadius: 8,
        minWidth: 140,
        flexShrink: 0,
        cursor: 'pointer',
        height: '100%',
        background: entry.bg.hex,
        color: entry.fg.hex,
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <span style={{ fontSize: 20, fontWeight: 700, lineHeight: 1 }}>Aa</span>
      <span style={{ fontSize: 12 }}>
        {entry.fg.ramp} {entry.fg.step}
      </span>
      <span style={{ fontSize: 12 }}>
        on {entry.bg.ramp} {entry.bg.step}
      </span>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
        <span>{metric}</span>
        <span style={{ fontFamily: 'monospace' }}>{entry.fg.hex}</span>
      </div>
    </div>
  );
}

function WcagComboCard({ entry, onClick }: { entry: WcagMapEntry; onClick: () => void }) {
  return <ComboCardShell entry={entry} metric={`${entry.ratio}:1`} onClick={onClick} />;
}

function ApcaComboCard({ entry, onClick }: { entry: ApcaMapEntry; onClick: () => void }) {
  return <ComboCardShell entry={entry} metric={`Lc ${entry.lc.toFixed(1)}`} onClick={onClick} />;
}

const selectStyle: React.CSSProperties = {
  padding: '4px 8px',
  fontSize: 12,
  background: 'var(--p-surface)',
  border: '1px solid var(--p-border)',
  borderRadius: 6,
  color: 'var(--p-text)',
  cursor: 'pointer',
};

function FilterBar({
  search,
  setSearch,
  wcagLevel,
  setWcagLevel,
  apcaLevel,
  setApcaLevel,
  sortAsc,
  setSortAsc,
  useWcag,
}: {
  search: string;
  setSearch: (s: string) => void;
  wcagLevel: WcagLevel;
  setWcagLevel: (l: WcagLevel) => void;
  apcaLevel: ApcaLevel;
  setApcaLevel: (l: ApcaLevel) => void;
  sortAsc: boolean;
  setSortAsc: (v: boolean) => void;
  useWcag: boolean;
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
        <label htmlFor="combos-level" style={{ fontSize: 12, color: 'var(--p-text-secondary)' }}>Level:</label>
        {useWcag ? (
          <AppStringSelect
            id="combos-level"
            name="combos-level-wcag"
            value={wcagLevel}
            onValueChange={(v) => setWcagLevel(v as WcagLevel)}
            style={selectStyle}
            className="focus-visible-ring"
            options={WCAG_LEVELS.map(({ key, label }) => ({ value: key, label }))}
          />
        ) : (
          <AppStringSelect
            id="combos-level"
            name="combos-level-apca"
            value={apcaLevel}
            onValueChange={(v) => setApcaLevel(v as ApcaLevel)}
            style={selectStyle}
            className="focus-visible-ring"
            options={APCA_LEVELS.map(({ key, label }) => ({ value: key, label }))}
          />
        )}
      </div>

      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <label htmlFor="combos-sort" style={{ fontSize: 12, color: 'var(--p-text-secondary)' }}>Sort:</label>
        <AppStringSelect
          id="combos-sort"
          name="combos-sort"
          value={sortAsc ? 'asc' : 'desc'}
          onValueChange={(v) => setSortAsc(v === 'asc')}
          style={selectStyle}
          className="focus-visible-ring"
          options={[
            { value: 'desc', label: 'High → Low' },
            { value: 'asc', label: 'Low → High' },
          ]}
        />
      </div>
    </div>
  );
}

export function AccessibleCombos() {
  const scales = usePaletteStore((s) => s.scales);
  const gamut = useTargetGamut();
  const useWcag = useIntentStore((s) => s.engineCompliance === 'wcag21');

  const appTheme = useIntentStore((s) => s.appTheme);
  const polarity: Polarity = appTheme === 'dark' ? 'dark' : 'light';

  const [search, setSearch] = useState('');
  const [wcagLevel, setWcagLevel] = useState<WcagLevel>('aa');
  const [apcaLevel, setApcaLevel] = useState<ApcaLevel>('lc60');
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<WcagMapEntry | ApcaMapEntry | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(MAX_COLS);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      // floor((W + gap) / (minCard + gap)) keeps each track ≥ minCard while collapsing gracefully.
      const next = Math.max(1, Math.min(MAX_COLS, Math.floor((width + ROW_GAP) / (MIN_CARD_WIDTH + ROW_GAP))));
      setCols(next);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rampMap = useMemo(() => {
    const map = new Map<string, GeneratedRamp>();
    for (const scale of scales) {
      try { map.set(scale.name, generateRamp(scale, { gamut })); } catch { /* ignore */ }
    }
    return map;
  }, [scales, gamut]);

  // Group steps by ramp so we only compare within the same ramp
  const stepsByRamp = useMemo(
    () =>
      scales.map((s) => {
        const ramp = generateRamp(s, { gamut });
        return {
          name: ramp.scaleName,
          steps: ramp.steps.map((step) => ({ ramp: ramp.scaleName, step: step.name, hex: step.hex })),
        };
      }),
    [scales, gamut],
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

          if (useWcag) {
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
    if (useWcag) {
      (results as WcagMapEntry[]).sort((a, b) => dir * (a.ratio - b.ratio));
    } else {
      (results as ApcaMapEntry[]).sort((a, b) => dir * (Math.abs(a.lc) - Math.abs(b.lc)));
    }

    return results;
  }, [stepsByRamp, useWcag, search, polarity, wcagLevel, apcaLevel, sortAsc]);

  const activeLevel = useWcag
    ? WCAG_LEVELS.find((l) => l.key === wcagLevel)!
    : APCA_LEVELS.find((l) => l.key === apcaLevel)!;

  const rowCount = Math.ceil(entries.length / cols);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT + ROW_GAP,
    overscan: 5,
    getItemKey: (index) => `${cols}:${index}`,
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
      <div style={{ width: '100%' }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--p-text)', margin: '0 0 4px 0' }}>
            Accessible Combinations — {useWcag ? 'WCAG 2.1' : 'APCA'}
          </h2>
          <p style={{ fontSize: 12, color: 'var(--p-text-secondary)', margin: 0 }}>
            {totalSteps} color steps across {scales.length} ramps (same-ramp pairs). Toggle WCAG / APCA in the top bar.
          </p>
        </div>

        <FilterBar
          search={search}
          setSearch={setSearch}
          wcagLevel={wcagLevel}
          setWcagLevel={setWcagLevel}
          apcaLevel={apcaLevel}
          setApcaLevel={setApcaLevel}
          sortAsc={sortAsc}
          setSortAsc={setSortAsc}
          useWcag={useWcag}
        />

        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--p-text)' }}>
            {activeLevel.label}
          </span>
          <span style={{ fontSize: 12, color: 'var(--p-text-secondary)' }}>{activeLevel.sub}</span>
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 12,
              color: 'var(--p-text-secondary)',
              background: 'var(--p-surface)',
              border: '1px solid var(--p-border)',
              borderRadius: 10,
              padding: '1px 7px',
            }}
          >
            {entries.length} pairs
          </span>
        </div>

        <div ref={gridRef}>
        {entries.length === 0 ? (
          <span style={{ fontSize: 12, color: 'var(--p-text-secondary)', padding: '4px 0' }}>
            No pairs match these filters
          </span>
        ) : (
          <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
            {rowVirtualizer.getVirtualItems().map((vRow) => {
              const startIdx = vRow.index * cols;
              const rowEntries = entries.slice(startIdx, startIdx + cols);
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
                    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                    gap: ROW_GAP,
                  }}
                >
                  {useWcag
                    ? (rowEntries as WcagMapEntry[]).map((entry, i) => (
                        <WcagComboCard key={startIdx + i} entry={entry} onClick={() => setSelectedEntry(entry)} />
                      ))
                    : (rowEntries as ApcaMapEntry[]).map((entry, i) => (
                        <ApcaComboCard key={startIdx + i} entry={entry} onClick={() => setSelectedEntry(entry)} />
                      ))}
                </div>
              );
            })}
          </div>
        )}
        </div>
      </div>

      {selectedEntry && (
        <ComboToTokenModal
          entry={selectedEntry}
          isWcag={useWcag}
          rampMap={rampMap}
          onClose={() => setSelectedEntry(null)}
        />
      )}
    </div>
  );
}
