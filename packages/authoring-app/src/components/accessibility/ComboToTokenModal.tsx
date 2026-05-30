import { useEffect, useRef, useState } from 'react';
import { useVocabStore } from '../../store/vocabStore';
import { useIntentStore } from '../../store/intentStore';
import type { PortableSemanticToken, GeneratedRamp } from '@pigmint/core';
import type { WcagMapEntry, ApcaMapEntry } from '../../types/palette';
import { AppDrawer } from '../base-ui';
import { AppSelect, type AppSelectOption } from '../tokens/AppSelect';
import { surfaceOptions, stepOptions } from '../tokens/tokenOptions';
import { derivedConsistency } from '../tokens/tokenShared';

type Mode = 'new' | 'existing';
type FgKind = 'foreground' | 'nonText';

// Combo-to-token only supports preferences that map cleanly to a 2-color
// pairing — anchor/level-up etc. require additional context the dialog
// doesn't collect.
const PREFS: PortableSemanticToken['preference'][] = ['lowest-passing', 'highest-contrast', 'matched-to-set'];
const PREF_OPTIONS: AppSelectOption[] = PREFS.map((p) => ({ value: p, label: p }));
const FG_KIND_OPTIONS: AppSelectOption[] = [
  { value: 'foreground', label: 'Foreground' },
  { value: 'nonText', label: 'NonText' },
];

function ec() {
  const s = useIntentStore.getState();
  return { compliance: s.engineCompliance, target: s.engineTarget, modes: s.engineModes };
}

function findStepIndex(rampMap: Map<string, GeneratedRamp>, rampName: string, stepName: string): number {
  const ramp = rampMap.get(rampName);
  if (!ramp) return 0;
  const idx = ramp.steps.findIndex((s) => s.name === stepName);
  return idx >= 0 ? idx : 0;
}

const field: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5 };
const lbl: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--p-text-secondary)',
  textTransform: 'uppercase', letterSpacing: '0.05em',
};
const inp: React.CSSProperties = {
  width: '100%', padding: '6px 8px', fontSize: 13,
  background: 'var(--p-bg)', border: '1px solid var(--p-border)',
  borderRadius: 6, color: 'var(--p-text)', boxSizing: 'border-box',
};
const readOnly: React.CSSProperties = { ...inp, color: 'var(--p-text-secondary)' };
const btn: React.CSSProperties = {
  padding: '3px 8px', fontSize: 11,
  background: 'var(--p-surface)', border: '1px solid var(--p-border)',
  borderRadius: 4, cursor: 'pointer', color: 'var(--p-text)', whiteSpace: 'nowrap',
};
const modeToggle = (active: boolean): React.CSSProperties => ({
  padding: '3px 10px', fontSize: 11, fontWeight: active ? 600 : 400,
  background: active ? 'var(--p-text)' : 'transparent',
  color: active ? 'var(--p-bg)' : 'var(--p-text-secondary)',
  border: 'none', cursor: 'pointer', borderRadius: 4,
});

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div style={{
      display: 'inline-flex', borderRadius: 6,
      background: 'var(--p-surface))', padding: 2, gap: 2,
    }}>
      <button style={modeToggle(mode === 'new')} onClick={() => onChange('new')}>New</button>
      <button style={modeToggle(mode === 'existing')} onClick={() => onChange('existing')}>Existing</button>
    </div>
  );
}

function StepSelect({
  rampMap, rampName, value, onChange,
}: {
  rampMap: Map<string, GeneratedRamp>;
  rampName: string;
  value: number;
  onChange: (i: number) => void;
}) {
  const ramp = rampMap.get(rampName);
  return (
    <AppSelect
      options={stepOptions(ramp)}
      value={String(value)}
      onChange={(v) => onChange(Number(v))}
    />
  );
}

export function ComboToTokenModal({
  entry,
  isWcag,
  rampMap,
  onClose,
}: {
  entry: WcagMapEntry | ApcaMapEntry;
  isWcag: boolean;
  rampMap: Map<string, GeneratedRamp>;
  onClose: () => void;
}) {
  const raw = useVocabStore((s) => s.raw);
  const addSurface = useVocabStore((s) => s.addSurface);
  const addToken = useVocabStore((s) => s.addToken);

  const surfaces = raw?.surfaces ?? {};
  const foreground = raw?.foreground ?? {};
  const nonText = raw?.nonText ?? {};
  const surfaceNames = Object.keys(surfaces);
  const allFgTokens = [
    ...Object.keys(foreground).map((n) => ({ name: n, kind: 'foreground' as FgKind })),
    ...Object.keys(nonText).map((n) => ({ name: n, kind: 'nonText' as FgKind })),
  ];

  const bgIdx = findStepIndex(rampMap, entry.bg.ramp, entry.bg.step);

  const [bgMode, setBgMode] = useState<Mode>('new');
  const [fgMode, setFgMode] = useState<Mode>('new');
  const [bgName, setBgName] = useState(`${entry.bg.ramp}.surface`);
  const [lightStep, setLightStep] = useState(bgIdx);
  const [darkStep, setDarkStep] = useState(bgIdx);
  const [fgName, setFgName] = useState(`${entry.fg.ramp}.text`);
  const [fgKind, setFgKind] = useState<FgKind>('foreground');
  const [pref, setPref] = useState<PortableSemanticToken['preference']>('lowest-passing');
  const [existingSurface, setExistingSurface] = useState(surfaceNames[0] ?? '');
  const [existingFg, setExistingFg] = useState(allFgTokens[0]?.name ?? '');
  const [error, setError] = useState('');

  const bgNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = setTimeout(() => bgNameRef.current?.focus(), 50);
    return () => clearTimeout(id);
  }, []);

  const contrastLabel = isWcag
    ? `${(entry as WcagMapEntry).ratio}:1`
    : `Lc ${Math.abs((entry as ApcaMapEntry).lc).toFixed(1)}`;

  const resolvedSurfaceName = bgMode === 'new' ? bgName.trim() : existingSurface;

  function commit() {
    const engineConfig = ec();
    setError('');

    if (bgMode === 'new') {
      const n = bgName.trim();
      if (!n) { setError('Surface name is required'); return; }
      addSurface(n, { ramp: entry.bg.ramp, lightStep, darkStep }, engineConfig);
    }

    if (fgMode === 'new') {
      const n = fgName.trim();
      if (!n) { setError('Token name is required'); return; }
      if (!resolvedSurfaceName) { setError('Select or create a surface first'); return; }
      addToken(
        fgKind, n,
        { ramp: entry.fg.ramp, surfaces: [resolvedSurfaceName], preference: pref, consistency: derivedConsistency(pref) },
        engineConfig,
      );
    }

    onClose();
  }

  const saveDisabled =
    (bgMode === 'new' && !bgName.trim()) ||
    (fgMode === 'new' && !fgName.trim()) ||
    (fgMode === 'new' && bgMode === 'existing' && !existingSurface);

  return (
    <AppDrawer onOpenChange={(open) => { if (!open) onClose(); }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px 12px', borderBottom: '1px solid var(--p-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--p-text)' }}>Save as tokens</span>
        <button onClick={onClose} style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--p-text-secondary)', fontSize: 16, lineHeight: 1, padding: '2px 4px',
        }}>✕</button>
      </div>

        {/* Combo preview */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 16px', borderBottom: '1px solid var(--p-border)',
          background: 'var(--p-surface)', flexShrink: 0,
        }}>
          <div style={{
            background: entry.bg.hex, borderRadius: 6,
            width: 72, height: 56, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid var(--p-border)',
          }}>
            <span style={{ color: entry.fg.hex, fontSize: 24, fontWeight: 700, lineHeight: 1 }}>Aa</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
            <span style={{ fontSize: 12, color: 'var(--p-text)', fontWeight: 500 }}>
              {entry.fg.ramp} {entry.fg.step}
              <span style={{ color: 'var(--p-text-tertiary)', fontWeight: 400 }}> on </span>
              {entry.bg.ramp} {entry.bg.step}
            </span>
            <span style={{ fontSize: 11, color: 'var(--p-text-secondary)', fontFamily: 'monospace' }}>
              {entry.fg.hex} / {entry.bg.hex}
            </span>
            <span style={{
              fontSize: 11, color: 'var(--p-text-secondary)',
              background: 'var(--p-bg)', border: '1px solid var(--p-border)',
              borderRadius: 4, padding: '1px 5px', alignSelf: 'flex-start',
            }}>
              {contrastLabel}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, overflow: 'auto' }}>
          {/* Background section */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--p-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--p-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Background → Surface
              </span>
              <ModeToggle mode={bgMode} onChange={(m) => { setBgMode(m); setError(''); }} />
            </div>
            {bgMode === 'new' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={field}>
                  <span style={lbl}>Name</span>
                  <input
                    ref={bgNameRef}
                    style={inp}
                    value={bgName}
                    onChange={(e) => { setBgName(e.target.value); setError(''); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
                    placeholder="e.g. surface.page"
                  />
                </div>
                <div style={field}>
                  <span style={lbl}>Ramp</span>
                  <div style={{ ...readOnly, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 12, height: 12, borderRadius: 2, flexShrink: 0,
                      background: entry.bg.hex, border: '1px solid rgba(0,0,0,0.14)',
                    }} />
                    {entry.bg.ramp}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={field}>
                    <span style={lbl}>Light step</span>
                    <StepSelect rampMap={rampMap} rampName={entry.bg.ramp} value={lightStep} onChange={setLightStep} />
                  </div>
                  <div style={field}>
                    <span style={lbl}>Dark step</span>
                    <StepSelect rampMap={rampMap} rampName={entry.bg.ramp} value={darkStep} onChange={setDarkStep} />
                  </div>
                </div>
              </div>
            ) : (
              <div style={field}>
                <span style={lbl}>Existing surface</span>
                {surfaceNames.length === 0 ? (
                  <span style={{ fontSize: 12, color: 'var(--p-text-tertiary)', fontStyle: 'italic' }}>
                    No surfaces yet — switch to New to create one
                  </span>
                ) : (
                  <AppSelect
                    options={surfaceOptions(surfaceNames, surfaces, rampMap)}
                    value={existingSurface}
                    onChange={(v) => { setExistingSurface(v); setError(''); }}
                  />
                )}
              </div>
            )}
          </div>

          {/* Foreground section */}
          <div style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--p-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Foreground → Token
              </span>
              <ModeToggle mode={fgMode} onChange={(m) => { setFgMode(m); setError(''); }} />
            </div>
            {fgMode === 'new' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={field}>
                  <span style={lbl}>Name</span>
                  <input
                    style={inp}
                    value={fgName}
                    onChange={(e) => { setFgName(e.target.value); setError(''); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
                    placeholder="e.g. text.default"
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={field}>
                    <span style={lbl}>Ramp</span>
                    <div style={{ ...readOnly, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        width: 12, height: 12, borderRadius: 2, flexShrink: 0,
                        background: entry.fg.hex, border: '1px solid rgba(0,0,0,0.14)',
                      }} />
                      {entry.fg.ramp}
                    </div>
                  </div>
                  <div style={field}>
                    <span style={lbl}>Type</span>
                    <AppSelect
                      options={FG_KIND_OPTIONS}
                      value={fgKind}
                      onChange={(v) => setFgKind(v as FgKind)}
                    />
                  </div>
                </div>
                <div style={field}>
                  <span style={lbl}>Preference</span>
                  <AppSelect
                    options={PREF_OPTIONS}
                    value={pref}
                    onChange={(v) => setPref(v as PortableSemanticToken['preference'])}
                  />
                </div>
              </div>
            ) : (
              <div style={field}>
                <span style={lbl}>Existing token</span>
                {allFgTokens.length === 0 ? (
                  <span style={{ fontSize: 12, color: 'var(--p-text-tertiary)', fontStyle: 'italic' }}>
                    No foreground or nonText tokens yet — switch to New to create one
                  </span>
                ) : (
                  <AppSelect
                    options={allFgTokens.map(({ name, kind }) => ({
                      value: name,
                      label: name,
                      trailing: kind,
                    }))}
                    value={existingFg}
                    onChange={setExistingFg}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 8,
          padding: '12px 16px', borderTop: '1px solid var(--p-border)',
          background: 'var(--p-surface)', flexShrink: 0,
        }}>
          {error && <span style={{ fontSize: 12, color: 'var(--p-danger)' }}>{error}</span>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button style={btn} onClick={onClose}>Cancel</button>
            <button
              style={{
                ...btn,
                background: 'var(--p-accent, #6366f1)',
                borderColor: 'var(--p-accent, #6366f1)',
                color: '#fff',
                fontWeight: 600,
                opacity: saveDisabled ? 0.5 : 1,
                cursor: saveDisabled ? 'not-allowed' : 'pointer',
              }}
              onClick={commit}
              disabled={saveDisabled}
            >
              Save
            </button>
          </div>
        </div>
    </AppDrawer>
  );
}
