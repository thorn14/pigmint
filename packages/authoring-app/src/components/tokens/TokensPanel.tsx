import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { useVocabStore } from '../../store/vocabStore';
import { useIntentStore } from '../../store/intentStore';
import { usePaletteStore } from '../../store/paletteStore';
import { TokensPreview } from './TokensPreview';
import type {
  PortableSurfaceToken,
  PortableSemanticToken,
} from '@pigmint/core';

// ─── Shared styles ────────────────────────────────────────────────────────────

const ROW: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '160px repeat(4, minmax(0, 1fr)) 28px',
  gap: 8,
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
  padding: '14px 12px 5px',
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--p-text-secondary)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.07em',
  borderTop: '2px solid var(--p-border)',
  borderBottom: '1px solid var(--p-border)',
  marginTop: 16,
};

const FIRST_SECTION: React.CSSProperties = {
  ...SECTION,
  marginTop: 0,
  borderTop: 'none',
};

const EMPTY_ROW: React.CSSProperties = {
  padding: '10px 12px',
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

const sel: React.CSSProperties = {
  ...inp,
  cursor: 'pointer',
  minWidth: 0,
};

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
type TokenKind = 'surface' | 'foreground' | 'nonText' | 'decorative';

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
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', minWidth: 0 }}>
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

// ─── Add token modal ──────────────────────────────────────────────────────────

const field: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
};

const label: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--p-text-secondary)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
};

const modalInp: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  fontSize: 13,
  background: 'var(--p-bg)',
  border: '1px solid var(--p-border)',
  borderRadius: 6,
  color: 'var(--p-text)',
  boxSizing: 'border-box' as const,
};

const modalSel: React.CSSProperties = { ...modalInp, cursor: 'pointer' };

const kindTab: (active: boolean) => React.CSSProperties = (active) => ({
  flex: 1,
  padding: '6px 0',
  fontSize: 12,
  fontWeight: active ? 600 : 400,
  background: active ? 'var(--p-bg-inset)' : 'transparent',
  border: 'none',
  borderBottom: active ? '2px solid var(--p-accent)' : '2px solid transparent',
  color: active ? 'var(--p-text)' : 'var(--p-text-secondary)',
  cursor: 'pointer',
});

function AddTokenModal({ rampNames, surfaceNames, onClose, onAddSurface, onAddSemantic }: {
  rampNames: string[];
  surfaceNames: string[];
  onClose: () => void;
  onAddSurface: (name: string, token: PortableSurfaceToken) => void;
  onAddSemantic: (kind: 'foreground' | 'nonText', name: string, token: PortableSemanticToken) => void;
}) {
  const [kind, setKind] = useState<TokenKind>('surface');
  const [name, setName] = useState('');
  const [ramp, setRamp] = useState(rampNames[0] ?? '');
  const [surface, setSurface] = useState(surfaceNames[0] ?? '');
  const [lightStep, setLightStep] = useState(0);
  const [darkStep, setDarkStep] = useState(10);
  const [pref, setPref] = useState<PortableSemanticToken['preference']>('lowest-passing');
  const [cons, setCons] = useState<PortableSemanticToken['consistency']>('independent');
  const [error, setError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function commit() {
    const n = name.trim();
    if (!n) { setError('Name is required'); return; }
    if (!ramp) { setError('Ramp is required'); return; }

    if (kind === 'surface') {
      onAddSurface(n, { ramp, lightStep, darkStep });
    } else if (kind === 'foreground' || kind === 'nonText') {
      if (!surface) { setError('Surface is required'); return; }
      onAddSemantic(kind, n, { ramp, surfaces: [surface], preference: pref, consistency: cons });
    }
    onClose();
  }

  const kinds: { id: TokenKind; label: string }[] = [
    { id: 'surface', label: 'Surface' },
    { id: 'foreground', label: 'Foreground' },
    { id: 'nonText', label: 'NonText' },
  ];

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 100,
        }}
      />
      {/* Panel */}
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 101,
        background: 'var(--p-bg)',
        border: '1px solid var(--p-border)',
        borderRadius: 10,
        width: 400,
        maxWidth: 'calc(100vw - 32px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}>
        {/* Title bar */}
        <div style={{
          padding: '14px 16px 12px',
          borderBottom: '1px solid var(--p-border)',
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--p-text)',
        }}>
          Add token
        </div>

        {/* Kind tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--p-border)',
          padding: '0 16px',
        }}>
          {kinds.map((k) => (
            <button key={k.id} style={kindTab(kind === k.id)} onClick={() => { setKind(k.id); setError(''); }}>
              {k.label}
            </button>
          ))}
        </div>

        {/* Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '16px' }}>
          <div style={field}>
            <span style={label}>Name</span>
            <input
              ref={nameRef}
              style={modalInp}
              placeholder={kind === 'surface' ? 'e.g. page, card' : 'e.g. text.default'}
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
            />
          </div>

          <div style={field}>
            <span style={label}>Ramp</span>
            <select style={modalSel} value={ramp} onChange={(e) => setRamp(e.target.value)}>
              {rampNames.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>

          {kind === 'surface' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={field}>
                <span style={label}>Light step</span>
                <input type="number" min={0} style={modalInp} value={lightStep}
                  onChange={(e) => setLightStep(Number(e.target.value))} />
              </div>
              <div style={field}>
                <span style={label}>Dark step</span>
                <input type="number" min={0} style={modalInp} value={darkStep}
                  onChange={(e) => setDarkStep(Number(e.target.value))} />
              </div>
            </div>
          )}

          {(kind === 'foreground' || kind === 'nonText') && (
            <>
              <div style={field}>
                <span style={label}>Surface</span>
                {surfaceNames.length === 0 ? (
                  <span style={{ fontSize: 12, color: 'var(--p-text-tertiary)', fontStyle: 'italic' }}>
                    Add a surface first
                  </span>
                ) : (
                  <select style={modalSel} value={surface} onChange={(e) => setSurface(e.target.value)}>
                    {surfaceNames.map((s) => <option key={s}>{s}</option>)}
                  </select>
                )}
              </div>
              <div style={field}>
                <span style={label}>Preference</span>
                <select style={modalSel} value={pref} onChange={(e) => setPref(e.target.value as typeof pref)}>
                  {PREFS.map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div style={field}>
                <span style={label}>Consistency</span>
                <select style={modalSel} value={cons} onChange={(e) => setCons(e.target.value as typeof cons)}>
                  {CONS.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
            </>
          )}

          {error && (
            <span style={{ fontSize: 12, color: '#e55' }}>{error}</span>
          )}
        </div>

        {/* Actions */}
        <div style={{
          display: 'flex',
          gap: 8,
          justifyContent: 'flex-end',
          padding: '12px 16px',
          borderTop: '1px solid var(--p-border)',
          background: 'var(--p-bg-subtle)',
        }}>
          <button style={btn} onClick={onClose}>Cancel</button>
          <button
            style={{
              ...btn,
              background: 'var(--p-accent, #6366f1)',
              borderColor: 'var(--p-accent, #6366f1)',
              color: '#fff',
              fontWeight: 600,
            }}
            onClick={commit}
            disabled={(kind === 'foreground' || kind === 'nonText') && surfaceNames.length === 0}
          >
            Add
          </button>
        </div>
      </div>
    </>,
    document.body,
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
  const [showAddModal, setShowAddModal] = useState(false);
  const [view, setView] = useState<'edit' | 'preview'>('edit');

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

        {/* View toggle */}
        <div style={{
          display: 'inline-flex',
          borderRadius: 6,
          background: 'var(--p-bg-inset, rgba(0,0,0,0.15))',
          padding: 2,
          gap: 2,
        }}>
          {(['edit', 'preview'] as const).map((v) => {
            const active = view === v;
            return (
              <button key={v} onClick={() => setView(v)} style={{
                border: 'none',
                background: active ? 'var(--p-text)' : 'transparent',
                color: active ? 'var(--p-bg)' : 'var(--p-text-secondary)',
                fontSize: 10, fontWeight: 600,
                textTransform: 'uppercase' as const, letterSpacing: '0.04em',
                padding: '3px 10px', borderRadius: 4, cursor: 'pointer',
              }}>
                {v}
              </button>
            );
          })}
        </div>

        {view === 'edit' && rampNames.length > 0 && (
          <button
            style={{
              ...btn,
              background: 'var(--p-accent, #6366f1)',
              borderColor: 'var(--p-accent, #6366f1)',
              color: '#fff',
              fontWeight: 600,
              padding: '3px 12px',
            }}
            onClick={() => setShowAddModal(true)}
          >
            + Add
          </button>
        )}
        <div style={{ flex: 1 }} />
        <button style={btn} onClick={() => setShowPaste((v) => !v)}>
          {showPaste ? 'Cancel paste' : 'Paste YAML'}
        </button>
        <input ref={fileRef} type="file" accept=".yaml,.yml,.json" onChange={handleFileUpload} style={{ display: 'none' }} />
        <button style={btn} onClick={() => fileRef.current?.click()}>Upload</button>
        {raw && (
          <>
            <button style={btn} onClick={handleExport}>Export</button>
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

      {/* No ramps hint (edit only) */}
      {view === 'edit' && rampNames.length === 0 && (
        <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--p-text-secondary)', borderBottom: '1px solid var(--p-border)' }}>
          Add ramps in the Primitives tab first — they become the available ramp options when defining tokens.
        </div>
      )}

      {/* Preview view */}
      {view === 'preview' && <TokensPreview />}

      {/* Edit view — sections */}
      {view === 'edit' && (
      <div style={{ flex: 1, overflow: 'auto' }}>

        {/* Surfaces */}
        <div style={FIRST_SECTION}>Surfaces</div>
        <div style={HEADER}>
          <span>name</span><span>ramp</span><span>step(s)</span><span /><span /><span />
        </div>
        {Object.entries(surfaces).map(([name, token]) => (
          <SurfaceRow key={name} name={name} token={token} rampNames={rampNames}
            onUpdate={(u) => updateSurface(name, u, ec())}
            onDelete={() => removeSurface(name, ec())} />
        ))}
        {surfaceNames.length === 0 && (
          <div style={EMPTY_ROW}>No surfaces yet — use + Add to create one</div>
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
        {Object.keys(foreground).length === 0 && (
          <div style={EMPTY_ROW}>No foreground tokens yet</div>
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
        {Object.keys(nonText).length === 0 && (
          <div style={EMPTY_ROW}>No nonText tokens yet</div>
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
      )}

      {/* Add token modal */}
      {showAddModal && (
        <AddTokenModal
          rampNames={rampNames}
          surfaceNames={surfaceNames}
          onClose={() => setShowAddModal(false)}
          onAddSurface={(n, t) => addSurface(n, t, ec())}
          onAddSemantic={(kind, n, t) => addToken(kind, n, t, ec())}
        />
      )}
    </div>
  );
}
