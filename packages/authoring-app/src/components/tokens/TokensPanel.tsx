import { useRef, useState } from 'react';
import { useVocabStore } from '../../store/vocabStore';
import { useIntentStore } from '../../store/intentStore';
import { usePaletteStore } from '../../store/paletteStore';
import type {
  PortableSurfaceToken,
  PortableSemanticToken,
} from '@pigmint/core';

// ─── Shared styles ────────────────────────────────────────────────────────────

const ROW: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '160px 110px 1fr 130px 110px 28px',
  gap: 6,
  alignItems: 'center',
  padding: '4px 12px',
  borderBottom: '1px solid var(--p-border)',
  fontSize: 12,
};

const HEADER: React.CSSProperties = {
  ...ROW,
  background: 'var(--p-bg-subtle)',
  color: 'var(--p-text-secondary)',
  fontWeight: 600,
  fontSize: 11,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
};

const SECTION: React.CSSProperties = {
  padding: '8px 12px 4px',
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--p-text-secondary)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.07em',
  borderBottom: '1px solid var(--p-border)',
};

const EMPTY_ROW: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 12,
  color: 'var(--p-text-tertiary)',
  fontStyle: 'italic',
  borderBottom: '1px solid var(--p-border)',
};

const inp: React.CSSProperties = {
  width: '100%',
  padding: '3px 6px',
  fontSize: 12,
  background: 'var(--p-bg)',
  border: '1px solid var(--p-border)',
  borderRadius: 4,
  color: 'var(--p-text)',
  boxSizing: 'border-box' as const,
};

const sel: React.CSSProperties = { ...inp, cursor: 'pointer' };

const btn: React.CSSProperties = {
  padding: '3px 8px',
  fontSize: 11,
  background: 'var(--p-bg-subtle)',
  border: '1px solid var(--p-border)',
  borderRadius: 4,
  cursor: 'pointer',
  color: 'var(--p-text)',
  whiteSpace: 'nowrap' as const,
};

const delBtn: React.CSSProperties = {
  padding: '2px 6px',
  fontSize: 14,
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--p-text-secondary)',
};

const PREFS = ['lowest-passing', 'highest-contrast', 'matched-to-set'] as const;
const CONS = ['independent', 'matched-across-ramps'] as const;

function ec() {
  const s = useIntentStore.getState();
  return { compliance: s.engineCompliance, target: s.engineTarget, modes: s.engineModes };
}

// ─── Surface row ──────────────────────────────────────────────────────────────

function SurfaceRow({ name, token, rampNames, onUpdate, onDelete }: {
  name: string; token: PortableSurfaceToken; rampNames: string[];
  onUpdate: (u: Partial<PortableSurfaceToken>) => void; onDelete: () => void;
}) {
  const isMulti = token.lightStep !== undefined || token.darkStep !== undefined;
  return (
    <div style={ROW}>
      <span style={{ fontFamily: 'monospace', color: 'var(--p-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
      <select style={sel} value={token.ramp} onChange={(e) => onUpdate({ ramp: e.target.value })}>
        {rampNames.map((r) => <option key={r}>{r}</option>)}
      </select>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {isMulti ? (
          <>
            <label style={{ fontSize: 11, color: 'var(--p-text-secondary)', flexShrink: 0 }}>light</label>
            <input type="number" min={0} style={{ ...inp, width: 48 }} value={token.lightStep ?? 0}
              onChange={(e) => onUpdate({ lightStep: Number(e.target.value), step: undefined })} />
            <label style={{ fontSize: 11, color: 'var(--p-text-secondary)', flexShrink: 0 }}>dark</label>
            <input type="number" min={0} style={{ ...inp, width: 48 }} value={token.darkStep ?? 0}
              onChange={(e) => onUpdate({ darkStep: Number(e.target.value), step: undefined })} />
          </>
        ) : (
          <>
            <label style={{ fontSize: 11, color: 'var(--p-text-secondary)', flexShrink: 0 }}>step</label>
            <input type="number" min={0} style={{ ...inp, width: 48 }} value={token.step ?? 0}
              onChange={(e) => onUpdate({ step: Number(e.target.value) })} />
            <button style={{ ...btn, fontSize: 10 }} onClick={() => onUpdate({ lightStep: token.step ?? 0, darkStep: token.step ?? 0, step: undefined })}>
              per-mode
            </button>
          </>
        )}
      </div>
      <span /><span />
      <button style={delBtn} onClick={onDelete} title="Remove">✕</button>
    </div>
  );
}

// ─── Semantic token row ────────────────────────────────────────────────────────

function SemanticRow({ name, token, rampNames, surfaceNames, onUpdate, onDelete }: {
  name: string; token: PortableSemanticToken; rampNames: string[]; surfaceNames: string[];
  onUpdate: (u: Partial<PortableSemanticToken>) => void; onDelete: () => void;
}) {
  return (
    <div style={ROW}>
      <span style={{ fontFamily: 'monospace', color: 'var(--p-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
      <select style={sel} value={token.ramp} onChange={(e) => onUpdate({ ramp: e.target.value })}>
        {rampNames.map((r) => <option key={r}>{r}</option>)}
      </select>
      <select style={sel} value={token.surfaces[0] ?? ''} onChange={(e) => onUpdate({ surfaces: [e.target.value] })}>
        {surfaceNames.map((s) => <option key={s}>{s}</option>)}
      </select>
      <select style={sel} value={token.preference} onChange={(e) => onUpdate({ preference: e.target.value as PortableSemanticToken['preference'] })}>
        {PREFS.map((p) => <option key={p}>{p}</option>)}
      </select>
      <select style={sel} value={token.consistency ?? 'independent'} onChange={(e) => onUpdate({ consistency: e.target.value as PortableSemanticToken['consistency'] })}>
        {CONS.map((c) => <option key={c}>{c}</option>)}
      </select>
      <button style={delBtn} onClick={onDelete} title="Remove">✕</button>
    </div>
  );
}

// ─── Add row forms ─────────────────────────────────────────────────────────────

function AddSurfaceRow({ rampNames, onAdd }: { rampNames: string[]; onAdd: (name: string, token: PortableSurfaceToken) => void }) {
  const [name, setName] = useState('');
  const [ramp, setRamp] = useState(rampNames[0] ?? '');

  function commit() {
    const n = name.trim();
    if (!n || !ramp) return;
    onAdd(n, { ramp, lightStep: 0, darkStep: 10 });
    setName('');
  }

  return (
    <div style={{ ...ROW, background: 'var(--p-bg-subtle)' }}>
      <input style={inp} placeholder="surface name" value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); }} />
      <select style={sel} value={ramp} onChange={(e) => setRamp(e.target.value)}>
        {rampNames.map((r) => <option key={r}>{r}</option>)}
      </select>
      <span style={{ fontSize: 11, color: 'var(--p-text-tertiary)' }}>light/dark steps editable after adding</span>
      <span /><span />
      <button style={{ ...delBtn, color: 'var(--p-accent)', fontSize: 18, fontWeight: 600 }} onClick={commit} title="Add surface">+</button>
    </div>
  );
}

function AddTokenRow({ rampNames, surfaceNames, onAdd }: {
  rampNames: string[]; surfaceNames: string[];
  onAdd: (name: string, token: PortableSemanticToken) => void;
}) {
  const [name, setName] = useState('');
  const [ramp, setRamp] = useState(rampNames[0] ?? '');
  const [surface, setSurface] = useState(surfaceNames[0] ?? '');
  const [pref, setPref] = useState<PortableSemanticToken['preference']>('lowest-passing');

  function commit() {
    const n = name.trim();
    if (!n || !ramp || !surface) return;
    onAdd(n, { ramp, surfaces: [surface], preference: pref });
    setName('');
  }

  return (
    <div style={{ ...ROW, background: 'var(--p-bg-subtle)' }}>
      <input style={inp} placeholder="token name" value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); }} />
      <select style={sel} value={ramp} onChange={(e) => setRamp(e.target.value)}>
        {rampNames.map((r) => <option key={r}>{r}</option>)}
      </select>
      <select style={sel} value={surface} onChange={(e) => setSurface(e.target.value)}>
        {surfaceNames.map((s) => <option key={s}>{s}</option>)}
      </select>
      <select style={sel} value={pref} onChange={(e) => setPref(e.target.value as typeof pref)}>
        {PREFS.map((p) => <option key={p}>{p}</option>)}
      </select>
      <span />
      <button style={{ ...delBtn, color: 'var(--p-accent)', fontSize: 18, fontWeight: 600 }} onClick={commit} title="Add token">+</button>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function TokensPanel() {
  const raw = useVocabStore((s) => s.raw);
  const error = useVocabStore((s) => s.error);
  const loadFromText = useVocabStore((s) => s.loadFromText);
  const addSurface = useVocabStore((s) => s.addSurface);
  const updateSurface = useVocabStore((s) => s.updateSurface);
  const removeSurface = useVocabStore((s) => s.removeSurface);
  const addToken = useVocabStore((s) => s.addToken);
  const updateToken = useVocabStore((s) => s.updateToken);
  const addDecorative = useVocabStore((s) => s.addDecorative);
  const removeToken = useVocabStore((s) => s.removeToken);
  const exportYaml = useVocabStore((s) => s.exportYaml);
  const clear = useVocabStore((s) => s.clear);

  const scales = usePaletteStore((s) => s.scales);
  const rampNames = scales.map((s) => s.name);
  const surfaces = raw?.surfaces ?? {};
  const foreground = raw?.foreground ?? {};
  const nonText = raw?.nonText ?? {};
  const decorative = raw?.decorative ?? {};
  const surfaceNames = Object.keys(surfaces);

  const fileRef = useRef<HTMLInputElement>(null);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      loadFromText(reader.result as string, ec());
      setShowPaste(false);
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleApplyPaste() {
    if (pasteText.trim()) {
      loadFromText(pasteText, ec());
      setPasteText('');
      setShowPaste(false);
    }
  }

  function handleExport() {
    const yaml = exportYaml();
    if (!yaml) return;
    const blob = new Blob([yaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'tokens.yaml'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', gap: 8, padding: '10px 12px',
        borderBottom: '1px solid var(--p-border)', background: 'var(--p-bg)',
        alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' as const,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--p-text)', marginRight: 4 }}>Tokens</span>
        <button style={btn} onClick={() => setShowPaste((v) => !v)}>
          {showPaste ? 'Cancel paste' : 'Paste tokens.yaml'}
        </button>
        <input ref={fileRef} type="file" accept=".yaml,.yml,.json" onChange={handleFileUpload} style={{ display: 'none' }} />
        <button style={btn} onClick={() => fileRef.current?.click()}>Upload file</button>
        {raw && (
          <>
            <button style={btn} onClick={handleExport}>Export tokens.yaml</button>
            <button style={{ ...btn, color: 'var(--p-text-secondary)' }} onClick={clear}>Clear</button>
          </>
        )}
        {error && <span style={{ fontSize: 12, color: '#e55' }}>{error}</span>}
      </div>

      {/* Paste area */}
      {showPaste && (
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--p-border)', background: 'var(--p-bg-subtle)', flexShrink: 0 }}>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="Paste tokens.yaml content here…"
            style={{
              width: '100%', minHeight: 120, padding: 8, fontSize: 12,
              fontFamily: 'monospace', background: 'var(--p-bg)',
              border: '1px solid var(--p-border)', borderRadius: 6,
              color: 'var(--p-text-secondary)', resize: 'vertical' as const,
              boxSizing: 'border-box' as const,
            }}
          />
          <button style={{ ...btn, marginTop: 6, borderColor: 'var(--p-accent)', color: 'var(--p-accent)' }} onClick={handleApplyPaste}>
            Apply
          </button>
        </div>
      )}

      {/* No ramps hint */}
      {rampNames.length === 0 && (
        <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--p-text-secondary)', borderBottom: '1px solid var(--p-border)' }}>
          Add ramps in the Primitives tab first — they become the available ramp options when defining tokens.
        </div>
      )}

      {/* Sections — always visible */}
      <div style={{ flex: 1, overflow: 'auto' }}>

        {/* Surfaces */}
        <div style={SECTION}>Surfaces</div>
        <div style={HEADER}>
          <span>name</span><span>ramp</span><span>step(s)</span><span /><span /><span />
        </div>
        {Object.entries(surfaces).map(([name, token]) => (
          <SurfaceRow key={name} name={name} token={token} rampNames={rampNames}
            onUpdate={(u) => updateSurface(name, u, ec())}
            onDelete={() => removeSurface(name, ec())} />
        ))}
        {surfaceNames.length === 0 && <div style={EMPTY_ROW}>No surfaces yet — add one below to use as a contrast reference</div>}
        {rampNames.length > 0 && (
          <AddSurfaceRow rampNames={rampNames} onAdd={(n, t) => addSurface(n, t, ec())} />
        )}

        {/* Foreground */}
        <div style={SECTION}>Foreground</div>
        <div style={HEADER}>
          <span>name</span><span>ramp</span><span>surface</span><span>preference</span><span>consistency</span><span />
        </div>
        {Object.entries(foreground).map(([name, token]) => (
          <SemanticRow key={name} name={name} token={token} rampNames={rampNames} surfaceNames={surfaceNames}
            onUpdate={(u) => updateToken('foreground', name, u, ec())}
            onDelete={() => removeToken('foreground', name, ec())} />
        ))}
        {Object.keys(foreground).length === 0 && <div style={EMPTY_ROW}>No foreground tokens yet</div>}
        {rampNames.length > 0 && surfaceNames.length > 0 && (
          <AddTokenRow rampNames={rampNames} surfaceNames={surfaceNames} onAdd={(n, t) => addToken('foreground', n, t, ec())} />
        )}
        {surfaceNames.length === 0 && rampNames.length > 0 && (
          <div style={EMPTY_ROW}>Add at least one surface first</div>
        )}

        {/* NonText */}
        <div style={SECTION}>NonText</div>
        <div style={HEADER}>
          <span>name</span><span>ramp</span><span>surface</span><span>preference</span><span>consistency</span><span />
        </div>
        {Object.entries(nonText).map(([name, token]) => (
          <SemanticRow key={name} name={name} token={token} rampNames={rampNames} surfaceNames={surfaceNames}
            onUpdate={(u) => updateToken('nonText', name, u, ec())}
            onDelete={() => removeToken('nonText', name, ec())} />
        ))}
        {Object.keys(nonText).length === 0 && <div style={EMPTY_ROW}>No nonText tokens yet</div>}
        {rampNames.length > 0 && surfaceNames.length > 0 && (
          <AddTokenRow rampNames={rampNames} surfaceNames={surfaceNames} onAdd={(n, t) => addToken('nonText', n, t, ec())} />
        )}
        {surfaceNames.length === 0 && rampNames.length > 0 && (
          <div style={EMPTY_ROW}>Add at least one surface first</div>
        )}

        {/* Decorative */}
        {Object.keys(decorative).length > 0 && (
          <>
            <div style={SECTION}>Decorative</div>
            <div style={HEADER}>
              <span>name</span><span>ramp</span><span>step</span><span /><span /><span />
            </div>
            {Object.entries(decorative).map(([name, token]) => (
              <div key={name} style={ROW}>
                <span style={{ fontFamily: 'monospace', color: 'var(--p-text)' }}>{name}</span>
                <select style={sel} value={token.ramp} onChange={(e) => addDecorative(name, { ...token, ramp: e.target.value }, ec())}>
                  {rampNames.map((r) => <option key={r}>{r}</option>)}
                </select>
                <input type="number" min={0} style={{ ...inp, width: 60 }}
                  value={token.step}
                  onChange={(e) => addDecorative(name, { ...token, step: Number(e.target.value) }, ec())} />
                <span /><span />
                <button style={delBtn} onClick={() => removeToken('decorative', name, ec())}>✕</button>
              </div>
            ))}
          </>
        )}

      </div>
    </div>
  );
}
