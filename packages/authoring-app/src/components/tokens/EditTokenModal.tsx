import { useEffect, useMemo, useRef, useState } from 'react';
import { useVocabStore } from '../../store/vocabStore';
import { useIntentStore } from '../../store/intentStore';
import { usePaletteStore } from '../../store/paletteStore';
import { generateRamp } from '../../lib/colorMath';
import { parseStepRef, type GeneratedRamp } from '@pigmint/core';
import type {
  PortableSurfaceToken,
  PortableSemanticToken,
  PortableAlphaToken,
} from '@pigmint/core';
import {
  derivedConsistency,
  contrastBounds,
  findTokenKind,
  type Pref,
  type AlphaPref,
} from './tokenShared';
import { AppSelect, type AppSelectOption } from './AppSelect';
import { MultiSurfaceSelect } from './MultiSurfaceSelect';
import { ResponsivePanel, ConfirmDialog } from '../base-ui';
import {
  rampOptions,
  surfaceOptions,
  stepOptions,
  prefOptions,
  alphaPrefOptions,
} from './tokenOptions';

function ec() {
  const s = useIntentStore.getState();
  return { compliance: s.engineCompliance, target: s.engineTarget, modes: s.engineModes };
}

const field: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5 };
const label: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--p-text-secondary)',
  textTransform: 'uppercase', letterSpacing: '0.05em',
};
const inp: React.CSSProperties = {
  width: '100%', padding: '6px 8px', fontSize: 13,
  background: 'var(--p-bg)', border: '1px solid var(--p-border)',
  borderRadius: 6, color: 'var(--p-text)', boxSizing: 'border-box',
};
const readOnly: React.CSSProperties = { ...inp, color: 'var(--p-text-tertiary)', cursor: 'default' };
const btn: React.CSSProperties = {
  padding: '6px 12px', fontSize: 12, fontWeight: 500,
  background: 'var(--p-surface)', border: '1px solid var(--p-border)',
  borderRadius: 6, cursor: 'pointer', color: 'var(--p-text)',
};
const dangerBtn: React.CSSProperties = {
  ...btn,
  color: 'var(--p-danger)',
  borderColor: 'rgba(229,85,85,0.4)',
};
const primaryBtn: React.CSSProperties = {
  ...btn,
  background: 'var(--p-accent, #6366f1)',
  borderColor: 'var(--p-accent, #6366f1)',
  color: '#fff',
  fontWeight: 600,
};

const TYPE_OPTIONS: AppSelectOption[] = [
  { value: 'foreground', label: 'foreground (text)' },
  { value: 'nonText', label: 'nonText (non-text)' },
];

type Props = {
  path: string;
  onClose: () => void;
};

/**
 * Modal for editing a single token in place. Opened from the tokens preview
 * by clicking a swatch. Routes to the right field set based on which section
 * of the vocab the token lives in.
 */
export function EditTokenModal({ path: initialPath, onClose }: Props) {
  const raw = useVocabStore((s) => s.raw);
  const scales = usePaletteStore((s) => s.scales);
  const compliance = useIntentStore((s) => s.engineCompliance);

  // Track path internally so renames don't yank the modal closed.
  const [path, setPath] = useState(initialPath);
  useEffect(() => { setPath(initialPath); }, [initialPath]);

  const kind = useMemo(() => findTokenKind(raw, path), [raw, path]);

  const rampMap = useMemo(() => {
    const map = new Map<string, GeneratedRamp>();
    for (const scale of scales) {
      try { map.set(scale.name, generateRamp(scale)); } catch { /* ignore */ }
    }
    return map;
  }, [scales]);

  const rampNames = scales.map((s) => s.name);
  const surfaceNames = raw ? Object.keys(raw.surfaces) : [];

  if (!raw || !kind) return null;

  let body: React.ReactNode;
  if (kind === 'surface') {
    body = (
      <SurfaceFields name={path} token={raw.surfaces[path]!} rampNames={rampNames} rampMap={rampMap} onClose={onClose} onRenamed={setPath} />
    );
  } else if (kind === 'foreground' || kind === 'nonText') {
    const token = (kind === 'foreground' ? raw.foreground : raw.nonText)[path]!;
    body = (
      <SemanticFields
        name={path}
        section={kind}
        token={token}
        rampNames={rampNames}
        surfaceNames={surfaceNames}
        surfaces={raw.surfaces}
        rampMap={rampMap}
        compliance={compliance}
        onClose={onClose}
        onRenamed={setPath}
      />
    );
  } else if (kind === 'decorative') {
    body = (
      <DecorativeFields
        name={path}
        token={raw.decorative![path]!}
        rampNames={rampNames}
        rampMap={rampMap}
        onClose={onClose}
        onRenamed={setPath}
      />
    );
  } else {
    body = (
      <AlphaFields
        name={path}
        token={raw.alpha![path]!}
        rampNames={rampNames}
        surfaceNames={surfaceNames}
        surfaces={raw.surfaces}
        rampMap={rampMap}
        compliance={compliance}
        onClose={onClose}
        onRenamed={setPath}
      />
    );
  }

  return (
    <ResponsivePanel onOpenChange={(open) => { if (!open) onClose(); }}>
      <div style={{
        padding: '14px 16px 12px',
        borderBottom: '1px solid var(--p-border)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--p-text)' }}>Edit token</span>
        <span style={{ fontSize: 11, color: 'var(--p-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {kind}
        </span>
        <div style={{ flex: 1 }} />
        <CloseButton onClose={onClose} />
      </div>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, padding: 16 }}>
        {body}
      </div>
    </ResponsivePanel>
  );
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close"
      className="focus-visible-ring"
      style={{
        width: 28,
        height: 28,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: '1px solid var(--p-border)',
        borderRadius: 6,
        color: 'var(--p-text-secondary)',
        cursor: 'pointer',
        padding: 0,
      }}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
        <path d="M2.5 2.5 9.5 9.5M9.5 2.5 2.5 9.5" />
      </svg>
    </button>
  );
}

// ─── Shared: name field with commit-on-change ────────────────────────────────

function NameField({ value, onCommit, autoFocus }: { value: string; onCommit: (next: string) => void; autoFocus?: boolean }) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (autoFocus) ref.current?.select(); }, [autoFocus]);

  function commit() {
    const next = draft.trim();
    if (next && next !== value) onCommit(next);
    else setDraft(value);
  }

  return (
    <div style={field}>
      <span style={label}>Name</span>
      <input
        ref={ref}
        style={{ ...inp, fontFamily: 'monospace' }}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { commit(); (e.target as HTMLInputElement).blur(); }
          else if (e.key === 'Escape') { setDraft(value); (e.target as HTMLInputElement).blur(); }
        }}
      />
    </div>
  );
}

function Footer({
  onDelete,
  onClose,
  confirmTitle,
  confirmMessage,
}: {
  onDelete: () => void;
  onClose: () => void;
  confirmTitle: string;
  confirmMessage: React.ReactNode;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
      <button style={dangerBtn} onClick={() => setConfirming(true)}>Delete</button>
      <button style={primaryBtn} onClick={onClose}>Done</button>
      {confirming && (
        <ConfirmDialog
          title={confirmTitle}
          message={confirmMessage}
          confirmLabel="Delete"
          destructive
          onConfirm={() => { setConfirming(false); onDelete(); }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}

// ─── Surface ─────────────────────────────────────────────────────────────────

function SurfaceFields({
  name, token, rampNames, rampMap, onClose, onRenamed,
}: {
  name: string;
  token: PortableSurfaceToken;
  rampNames: string[];
  rampMap: Map<string, GeneratedRamp>;
  onClose: () => void;
  onRenamed: (next: string) => void;
}) {
  const updateSurface = useVocabStore((s) => s.updateSurface);
  const removeSurface = useVocabStore((s) => s.removeSurface);
  const renameSurface = useVocabStore((s) => s.renameSurface);

  function handleRename(next: string) { renameSurface(name, next, ec()); onRenamed(next); }

  const ramp = rampMap.get(token.ramp);
  const lastIdx = (ramp?.steps.length ?? 1) - 1;
  const lightIdx = Math.min(token.lightStep ?? token.step ?? 0, lastIdx);
  const darkIdx = Math.min(token.darkStep ?? token.step ?? lastIdx, lastIdx);

  function handleDelete() { removeSurface(name, ec()); onClose(); }

  return (
    <>
      <NameField value={name} autoFocus onCommit={handleRename} />
      <div style={field}>
        <span style={label}>Ramp</span>
        <AppSelect
          options={rampOptions(rampNames, rampMap)}
          value={token.ramp}
          onChange={(r) => updateSurface(name, { ramp: r }, ec())}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={field}>
          <span style={label}>Light step</span>
          <AppSelect
            options={stepOptions(ramp)}
            value={String(lightIdx)}
            onChange={(v) => updateSurface(name, { lightStep: Number(v) }, ec())}
          />
        </div>
        <div style={field}>
          <span style={label}>Dark step</span>
          <AppSelect
            options={stepOptions(ramp)}
            value={String(darkIdx)}
            onChange={(v) => updateSurface(name, { darkStep: Number(v) }, ec())}
          />
        </div>
      </div>
      <Footer
        onDelete={handleDelete}
        onClose={onClose}
        confirmTitle="Delete surface token"
        confirmMessage={<>Delete surface token <strong>{name}</strong>? This cannot be undone.</>}
      />
    </>
  );
}

// ─── Foreground / NonText ────────────────────────────────────────────────────

function SemanticFields({
  name, section, token, rampNames, surfaceNames, surfaces, rampMap, compliance, onClose, onRenamed,
}: {
  name: string;
  section: 'foreground' | 'nonText';
  token: PortableSemanticToken;
  rampNames: string[];
  surfaceNames: string[];
  surfaces: Record<string, PortableSurfaceToken>;
  rampMap: Map<string, GeneratedRamp>;
  compliance: 'wcag21' | 'apca';
  onClose: () => void;
  onRenamed: (next: string) => void;
}) {
  const updateToken = useVocabStore((s) => s.updateToken);
  const removeToken = useVocabStore((s) => s.removeToken);
  const renameToken = useVocabStore((s) => s.renameToken);
  const moveToken = useVocabStore((s) => s.moveToken);

  function handleRename(next: string) { renameToken(section, name, next, ec()); onRenamed(next); }

  const bounds = contrastBounds(compliance);
  const consistency = derivedConsistency(token.preference);

  useEffect(() => {
    if (token.consistency !== consistency) updateToken(section, name, { consistency }, ec());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token.preference]);

  function handlePrefChange(preference: Pref) {
    const updates: Partial<PortableSemanticToken> = {
      preference,
      consistency: derivedConsistency(preference),
    };
    if (preference === 'preferred-contrast' && typeof token.targetContrast !== 'number') {
      updates.targetContrast = compliance === 'apca' ? 60 : 5;
    }
    updateToken(section, name, updates, ec());
  }

  function handleDelete() { removeToken(section, name, ec()); onClose(); }

  return (
    <>
      <NameField value={name} autoFocus onCommit={handleRename} />
      <div style={field}>
        <span style={label}>Type</span>
        <AppSelect
          options={TYPE_OPTIONS}
          value={section}
          onChange={(to) => { if (to !== section) moveToken(section, to as 'foreground' | 'nonText', name, ec()); }}
        />
      </div>
      <div style={field}>
        <span style={label}>Ramp</span>
        <AppSelect
          options={rampOptions(rampNames, rampMap)}
          value={token.ramp}
          onChange={(r) => updateToken(section, name, { ramp: r }, ec())}
        />
      </div>
      <div style={field}>
        <span style={label}>Surfaces</span>
        {surfaceNames.length === 0 ? (
          <span style={{ fontSize: 12, color: 'var(--p-text-tertiary)', fontStyle: 'italic' }}>Add a surface first</span>
        ) : (
          <MultiSurfaceSelect
            surfaceNames={surfaceNames}
            surfaces={surfaces}
            rampMap={rampMap}
            value={token.surfaces}
            onChange={(next) => { if (next.length > 0) updateToken(section, name, { surfaces: next }, ec()); }}
          />
        )}
      </div>
      <div style={field}>
        <span style={label}>Preference</span>
        <AppSelect
          options={prefOptions()}
          value={token.preference}
          onChange={(p) => handlePrefChange(p as Pref)}
        />
      </div>
      {token.preference === 'preferred-contrast' ? (
        <div style={field}>
          <span style={label}>Target {compliance === 'apca' ? 'APCA |Lc|' : 'WCAG ratio'}</span>
          <input
            type="number"
            min={bounds.min} max={bounds.max} step={bounds.step}
            style={inp}
            value={token.targetContrast ?? (compliance === 'apca' ? 60 : 5)}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (Number.isFinite(v)) updateToken(section, name, { targetContrast: v }, ec());
            }}
          />
        </div>
      ) : (
        <div style={field}>
          <span style={label}>Consistency</span>
          <span style={readOnly} title="Derived from preference — matched-to-set syncs across ramps; everything else is independent.">
            {consistency}
          </span>
        </div>
      )}
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--p-text-secondary)', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={Boolean(token.decorative)}
          onChange={(e) => updateToken(section, name, { decorative: e.target.checked || undefined }, ec())}
        />
        Decorative — skip a11y compliance check
      </label>
      <Footer
        onDelete={handleDelete}
        onClose={onClose}
        confirmTitle={`Delete ${section === 'foreground' ? 'foreground' : 'non-text'} token`}
        confirmMessage={<>Delete <strong>{name}</strong>? This cannot be undone.</>}
      />
    </>
  );
}

// ─── Decorative ──────────────────────────────────────────────────────────────

function DecorativeFields({
  name, token, rampNames, rampMap, onClose, onRenamed,
}: {
  name: string;
  token: { ramp: string; step?: number };
  rampNames: string[];
  rampMap: Map<string, GeneratedRamp>;
  onClose: () => void;
  onRenamed: (next: string) => void;
}) {
  const addDecorative = useVocabStore((s) => s.addDecorative);
  const removeToken = useVocabStore((s) => s.removeToken);
  const renameToken = useVocabStore((s) => s.renameToken);

  function handleRename(next: string) { renameToken('decorative', name, next, ec()); onRenamed(next); }

  const ramp = rampMap.get(token.ramp);
  const stepIdx = Math.min(token.step ?? 0, (ramp?.steps.length ?? 1) - 1);

  function handleDelete() { removeToken('decorative', name, ec()); onClose(); }

  return (
    <>
      <NameField value={name} autoFocus onCommit={handleRename} />
      <div style={field}>
        <span style={label}>Ramp</span>
        <AppSelect
          options={rampOptions(rampNames, rampMap)}
          value={token.ramp}
          onChange={(r) => addDecorative(name, { ramp: r, step: stepIdx }, ec())}
        />
      </div>
      <div style={field}>
        <span style={label}>Step</span>
        <AppSelect
          options={stepOptions(ramp)}
          value={String(stepIdx)}
          onChange={(v) => addDecorative(name, { ramp: token.ramp, step: Number(v) }, ec())}
        />
      </div>
      <Footer
        onDelete={handleDelete}
        onClose={onClose}
        confirmTitle="Delete decorative token"
        confirmMessage={<>Delete decorative token <strong>{name}</strong>? This cannot be undone.</>}
      />
    </>
  );
}

// ─── Alpha ───────────────────────────────────────────────────────────────────

function AlphaFields({
  name, token, rampNames, surfaceNames, surfaces, rampMap, compliance, onClose, onRenamed,
}: {
  name: string;
  token: PortableAlphaToken;
  rampNames: string[];
  surfaceNames: string[];
  surfaces: Record<string, PortableSurfaceToken>;
  rampMap: Map<string, GeneratedRamp>;
  compliance: 'wcag21' | 'apca';
  onClose: () => void;
  onRenamed: (next: string) => void;
}) {
  const updateAlpha = useVocabStore((s) => s.updateAlpha);
  const removeAlpha = useVocabStore((s) => s.removeAlpha);
  const renameAlpha = useVocabStore((s) => s.renameAlpha);

  function handleRename(next: string) { renameAlpha(name, next, ec()); onRenamed(next); }

  const isScrim = Boolean(token.base);
  const parsed = token.base ? parseStepRef(token.base) : null;
  const rampName = token.baseRamp ?? parsed?.ramp ?? rampNames[0] ?? '';
  const ramp = rampMap.get(rampName);
  const bounds = contrastBounds(compliance);

  const stepName = parsed?.step ?? '';
  const stepIdx = ramp ? Math.max(0, ramp.steps.findIndex((s) => s.name === stepName)) : 0;

  function handleRampChange(r: string) {
    if (isScrim) {
      const newStepName = rampMap.get(r)?.steps[stepIdx]?.name ?? stepName;
      updateAlpha(name, { base: `{color.primitive.${r}.${newStepName}}` }, ec());
    } else {
      updateAlpha(name, { baseRamp: r }, ec());
    }
  }

  function handleStepChange(idx: number) {
    const newStepName = ramp?.steps[idx]?.name ?? String(idx);
    updateAlpha(name, { base: `{color.primitive.${rampName}.${newStepName}}` }, ec());
  }

  function handleDelete() { removeAlpha(name, ec()); onClose(); }

  function handlePrefChange(preference: AlphaPref) {
    const updates: Partial<PortableAlphaToken> = { preference };
    if (preference === 'preferred-contrast' && typeof token.targetContrast !== 'number') {
      updates.targetContrast = compliance === 'apca' ? 60 : 5;
    }
    updateAlpha(name, updates, ec());
  }

  const refSurfaceOptions: AppSelectOption[] = [
    { value: '', label: 'auto' },
    ...surfaceOptions(surfaceNames, surfaces, rampMap),
  ];

  return (
    <>
      <NameField value={name} autoFocus onCommit={handleRename} />
      <div style={field}>
        <span style={label}>Ramp</span>
        <AppSelect
          options={rampOptions(rampNames, rampMap)}
          value={rampName}
          onChange={handleRampChange}
        />
      </div>
      {isScrim ? (
        <div style={field}>
          <span style={label}>Step</span>
          <AppSelect
            options={stepOptions(ramp)}
            value={String(stepIdx)}
            onChange={(v) => handleStepChange(Number(v))}
          />
        </div>
      ) : (
        <div style={field}>
          <span style={label}>Surfaces</span>
          {surfaceNames.length === 0 ? (
            <span style={{ fontSize: 12, color: 'var(--p-text-tertiary)', fontStyle: 'italic' }}>Add a surface first</span>
          ) : (
            <MultiSurfaceSelect
              surfaceNames={surfaceNames}
              surfaces={surfaces}
              rampMap={rampMap}
              value={token.surfaces ?? []}
              onChange={(next) => { if (next.length > 0) updateAlpha(name, { surfaces: next }, ec()); }}
            />
          )}
        </div>
      )}
      <div style={field}>
        <span style={label}>Alpha</span>
        <input
          type="number"
          min={0} max={1} step={0.05}
          style={inp}
          value={token.value}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!Number.isNaN(v)) updateAlpha(name, { value: Math.min(1, Math.max(0, Math.round(v * 100) / 100)) }, ec());
          }}
        />
      </div>
      {!isScrim && (
        <>
          <div style={field}>
            <span style={label}>Preference</span>
            <AppSelect
              options={alphaPrefOptions()}
              value={token.preference ?? 'lowest-passing'}
              onChange={(p) => handlePrefChange(p as AlphaPref)}
            />
          </div>
          {token.preference === 'preferred-contrast' && (
            <div style={field}>
              <span style={label}>Target {compliance === 'apca' ? 'APCA |Lc|' : 'WCAG ratio'}</span>
              <input
                type="number"
                min={bounds.min} max={bounds.max} step={bounds.step}
                style={inp}
                value={token.targetContrast ?? (compliance === 'apca' ? 60 : 5)}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (Number.isFinite(v)) updateAlpha(name, { targetContrast: v }, ec());
                }}
              />
            </div>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--p-text-secondary)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={Boolean(token.decorative)}
              onChange={(e) => updateAlpha(name, { decorative: e.target.checked || undefined }, ec())}
            />
            Decorative — skip a11y compliance check
          </label>
        </>
      )}
      <div style={field}>
        <span style={label}>Reference surface (optional)</span>
        <AppSelect
          options={refSurfaceOptions}
          value={token.referenceSurface ?? ''}
          onChange={(v) => updateAlpha(name, { referenceSurface: v || undefined }, ec())}
        />
      </div>
      <Footer
        onDelete={handleDelete}
        onClose={onClose}
        confirmTitle="Delete alpha token"
        confirmMessage={<>Delete alpha token <strong>{name}</strong>? This cannot be undone.</>}
      />
    </>
  );
}
