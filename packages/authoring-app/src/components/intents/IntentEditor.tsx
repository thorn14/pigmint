import {
  VOCABULARY_V1_SLICE,
  type ComplianceTarget,
  type Consistency,
  type CvdProfile,
  type FormalIntent,
  type Preference,
  type SurfaceContext,
  type VocabularyEntry,
} from '@pigmint/core';
import { HelpPopover } from '../ui/HelpPopover';
import { intentHelp } from './intentHelpCopy';
import {
  CVD_PROFILE_OPTIONS,
  DEFAULT_RESOLVER_FALLBACK_STEPS,
  ENGINE_MODE_OPTIONS,
  RESOLVER_MODE_OPTIONS,
  mergeIntent,
  useIntentStore,
  type EngineCompliance,
  type EngineMode,
} from '../../store/intentStore';
import {
  ComplianceHelpBody,
  CvdHelpBody,
  ConsistencyColumnHelpBody,
  EngineModesHelpBody,
  PreferenceColumnHelpBody,
  ResolverHelpBody,
  SurfaceColumnHelpBody,
  TargetLevelHelpBody,
  TokenColumnHelpBody,
} from './IntentHelpSections';

const PREFERENCE_OPTIONS: Preference[] = [
  'lowest-passing',
  'highest-contrast',
  'matched-to-set',
  'anchored',
];

const CONSISTENCY_OPTIONS: Consistency[] = [
  'independent',
  'matched-across-ramps',
  'anchored-to-reference',
];

const SURFACE_CONTEXT_OPTIONS: SurfaceContext[] = [
  'primary',
  'elevated',
  'inverse',
  'current',
];

const LEVEL_OPTIONS: ComplianceTarget[] = ['AA', 'AAA'];

/** WCAG uses AA/AAA; APCA uses the same internal `level` to pick minimum |Lc| (see `apcaThreshold` in core). */
const TARGET_LABEL: Record<EngineCompliance, Record<ComplianceTarget, string>> = {
  wcag21: { AA: 'AA', AAA: 'AAA' },
  apca: {
    AA: '|Lc| ≥ 60 (text)',
    AAA: '|Lc| ≥ 90 (text)',
  },
};

const COMPLIANCE_OPTIONS: { value: EngineCompliance; label: string }[] = [
  { value: 'wcag21', label: 'WCAG 2.1' },
  { value: 'apca', label: 'APCA' },
];

const DEFAULT_INTENT: FormalIntent = {
  threshold: { kind: 'wcag', level: 'AA', usage: 'nonText' },
  preference: 'lowest-passing',
  consistency: 'independent',
  surfaceContext: 'primary',
};

const GRID_COLUMNS = 'minmax(200px, 1.6fr) repeat(3, minmax(140px, 1fr)) 80px';

const headerCell: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--p-text-tertiary)',
};

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '4px 8px',
  fontSize: 12,
  background: 'var(--p-bg)',
  color: 'var(--p-text)',
  border: '1px solid var(--p-border)',
  borderRadius: 4,
};

function rowStyle(isOverridden: boolean): React.CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: GRID_COLUMNS,
    gap: 12,
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid var(--p-border)',
    background: isOverridden ? 'var(--p-bg-inset)' : 'transparent',
  };
}

const headerLabelRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  minWidth: 0,
  width: '100%',
};

function IntentRow({ entry }: { entry: VocabularyEntry }) {
  const override = useIntentStore((s) => s.overrides[entry.path]);
  const engineTarget = useIntentStore((s) => s.engineTarget);
  const engineCompliance = useIntentStore((s) => s.engineCompliance);
  const setPreference = useIntentStore((s) => s.setPreference);
  const setConsistency = useIntentStore((s) => s.setConsistency);
  const setSurfaceContext = useIntentStore((s) => s.setSurfaceContext);
  const resetOverride = useIntentStore((s) => s.resetOverride);

  const base = entry.defaultIntent ?? DEFAULT_INTENT;
  const effective = mergeIntent(base, override, engineTarget, engineCompliance);
  const isOverridden = override !== undefined && Object.keys(override).length > 0;

  return (
    <div style={rowStyle(isOverridden)}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--p-text)' }}>{entry.path}</div>
        {entry.description && (
          <div
            style={{
              fontSize: 11,
              color: 'var(--p-text-tertiary)',
              marginTop: 2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {entry.description}
          </div>
        )}
      </div>

      <select
        aria-label={`${entry.path} preference`}
        value={effective.preference}
        onChange={(e) => setPreference(entry.path, e.target.value as Preference)}
        style={selectStyle}
      >
        {PREFERENCE_OPTIONS.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>

      <select
        aria-label={`${entry.path} consistency`}
        value={effective.consistency}
        onChange={(e) => setConsistency(entry.path, e.target.value as Consistency)}
        style={selectStyle}
      >
        {CONSISTENCY_OPTIONS.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <select
        aria-label={`${entry.path} surface context`}
        value={effective.surfaceContext}
        onChange={(e) => setSurfaceContext(entry.path, e.target.value as SurfaceContext)}
        style={selectStyle}
      >
        {SURFACE_CONTEXT_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => resetOverride(entry.path)}
        disabled={!isOverridden}
        className="focus-visible-ring"
        style={{
          padding: '4px 10px',
          fontSize: 11,
          background: 'transparent',
          color: isOverridden ? 'var(--p-text-secondary)' : 'var(--p-text-tertiary)',
          border: '1px solid var(--p-border)',
          borderRadius: 4,
          cursor: isOverridden ? 'pointer' : 'default',
          opacity: isOverridden ? 1 : 0.5,
        }}
      >
        Reset
      </button>
    </div>
  );
}

const MODE_LABELS: Record<EngineMode, string> = {
  light: 'Light',
  dark: 'Dark',
  'light-high-contrast': 'Light HC',
  'dark-high-contrast': 'Dark HC',
};

const CVD_LABELS: Record<CvdProfile, string> = {
  deuteranopia: 'Deuteranopia',
  protanopia: 'Protanopia',
  tritanopia: 'Tritanopia',
  achromatopsia: 'Achromatopsia',
};

function EngineConfigPanel() {
  const engineTarget = useIntentStore((s) => s.engineTarget);
  const setEngineTarget = useIntentStore((s) => s.setEngineTarget);
  const engineCompliance = useIntentStore((s) => s.engineCompliance);
  const setEngineCompliance = useIntentStore((s) => s.setEngineCompliance);
  const engineModes = useIntentStore((s) => s.engineModes);
  const toggleEngineMode = useIntentStore((s) => s.toggleEngineMode);
  const engineCvd = useIntentStore((s) => s.engineCvd);
  const toggleEngineCvd = useIntentStore((s) => s.toggleEngineCvd);
  const engineResolver = useIntentStore((s) => s.engineResolver);
  const setResolverMode = useIntentStore((s) => s.setResolverMode);
  const setResolverFallbackSteps = useIntentStore((s) => s.setResolverFallbackSteps);
  const setMaterializeInterpolatedPrimitives = useIntentStore(
    (s) => s.setMaterializeInterpolatedPrimitives,
  );

  const fieldStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minWidth: 140,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--p-text-tertiary)',
  };

  return (
    <div
      style={{
        borderBottom: '1px solid var(--p-border)',
        background: 'var(--p-bg-subtle)',
      }}
    >
    <div
      style={{
        display: 'flex',
        gap: 16,
        padding: '14px 16px 6px',
        flexWrap: 'wrap',
        alignItems: 'flex-end',
      }}
    >
      <div style={fieldStyle}>
        <div style={headerLabelRow}>
          <span style={labelStyle}>Compliance</span>
          <HelpPopover title="Compliance">
            <ComplianceHelpBody />
          </HelpPopover>
        </div>
        <select
          id="intent-engine-compliance"
          aria-label="Engine contrast standard"
          value={engineCompliance}
          onChange={(e) => setEngineCompliance(e.target.value as EngineCompliance)}
          style={selectStyle}
        >
          {COMPLIANCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div style={fieldStyle}>
        <div style={headerLabelRow}>
          <label htmlFor="intent-engine-target" style={labelStyle}>
            {engineCompliance === 'apca' ? 'Min |Lc| (text)' : 'Target level'}
          </label>
          <HelpPopover
            title={engineCompliance === 'apca' ? 'APCA Lc floors' : 'Target level'}
            triggerLabel={
              engineCompliance === 'apca'
                ? 'Help: APCA minimum Lc'
                : 'Help: target level (AA or AAA)'
            }
          >
            <TargetLevelHelpBody engineCompliance={engineCompliance} />
          </HelpPopover>
        </div>
        <select
          id="intent-engine-target"
          value={engineTarget}
          onChange={(e) => setEngineTarget(e.target.value as ComplianceTarget)}
          style={selectStyle}
        >
          {LEVEL_OPTIONS.map((l) => (
            <option key={l} value={l}>
              {TARGET_LABEL[engineCompliance][l]}
            </option>
          ))}
        </select>
      </div>

      <div style={{ ...fieldStyle, minWidth: 240 }}>
        <div style={headerLabelRow}>
          <span style={labelStyle}>Modes</span>
          <HelpPopover title="Engine modes" triggerLabel="Help: which color scheme modes to build">
            <EngineModesHelpBody />
          </HelpPopover>
        </div>
        <div role="group" aria-label="Engine modes" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ENGINE_MODE_OPTIONS.map((m) => {
            const active = engineModes.includes(m);
            const lastActive = active && engineModes.length === 1;
            return (
              <label
                key={m}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  padding: '4px 8px',
                  border: '1px solid var(--p-border)',
                  borderRadius: 6,
                  background: active ? 'var(--p-bg-inset)' : 'var(--p-bg)',
                  color: active ? 'var(--p-text)' : 'var(--p-text-secondary)',
                  cursor: lastActive ? 'not-allowed' : 'pointer',
                  opacity: lastActive ? 0.65 : 1,
                }}
              >
                <input
                  type="checkbox"
                  checked={active}
                  disabled={lastActive}
                  onChange={() => toggleEngineMode(m)}
                  style={{ accentColor: 'var(--p-accent)' }}
                />
                {MODE_LABELS[m]}
              </label>
            );
          })}
        </div>
      </div>

      <div style={{ ...fieldStyle, minWidth: 300 }}>
        <div style={headerLabelRow}>
          <label htmlFor="intent-engine-resolver-mode" style={labelStyle}>
            Resolver
          </label>
          <HelpPopover title="Resolver" triggerLabel="Help: stepped vs continuous resolver">
            <ResolverHelpBody />
          </HelpPopover>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            id="intent-engine-resolver-mode"
            value={engineResolver.mode}
            onChange={(e) => setResolverMode(e.target.value as (typeof RESOLVER_MODE_OPTIONS)[number])}
            style={{ ...selectStyle, minWidth: 140, flex: '0 0 140px' }}
          >
            {RESOLVER_MODE_OPTIONS.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
          <input
            aria-label="Resolver fallback steps"
            type="number"
            min={2}
            step={1}
            value={engineResolver.fallbackSteps ?? DEFAULT_RESOLVER_FALLBACK_STEPS}
            disabled={engineResolver.mode !== 'continuous'}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (Number.isFinite(next) && next >= 2) {
                setResolverFallbackSteps(Math.floor(next));
              }
            }}
            style={{
              width: 96,
              padding: '4px 8px',
              fontSize: 12,
              background: 'var(--p-bg)',
              color: 'var(--p-text)',
              border: '1px solid var(--p-border)',
              borderRadius: 4,
              opacity: engineResolver.mode === 'continuous' ? 1 : 0.6,
              cursor: engineResolver.mode === 'continuous' ? 'text' : 'not-allowed',
            }}
          />
          {engineResolver.mode === 'continuous' && (
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                color: 'var(--p-text-secondary)',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={engineResolver.materializeInterpolatedPrimitives !== false}
                onChange={(e) =>
                  setMaterializeInterpolatedPrimitives(e.target.checked ? undefined : false)
                }
                style={{ accentColor: 'var(--p-accent)' }}
              />
              Materialize off-grid as primitives
            </label>
          )}
        </div>
      </div>

      <div style={{ ...fieldStyle, minWidth: 340 }}>
        <div style={headerLabelRow}>
          <span style={labelStyle}>CVD profiles</span>
          <HelpPopover title="CVD profiles" triggerLabel="Help: color vision deficiency profiles">
            <CvdHelpBody />
          </HelpPopover>
        </div>
        <div
          role="group"
          aria-label="Engine color vision deficiency profiles"
          style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}
        >
          {CVD_PROFILE_OPTIONS.map((profile) => {
            const active = engineCvd.includes(profile);
            return (
              <label
                key={profile}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  padding: '4px 8px',
                  border: '1px solid var(--p-border)',
                  borderRadius: 6,
                  background: active ? 'var(--p-bg-inset)' : 'var(--p-bg)',
                  color: active ? 'var(--p-text)' : 'var(--p-text-secondary)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => toggleEngineCvd(profile)}
                  style={{ accentColor: 'var(--p-accent)' }}
                />
                {CVD_LABELS[profile]}
              </label>
            );
          })}
        </div>
      </div>
    </div>

    <p
      style={{
        margin: 0,
        padding: '4px 16px 12px',
        maxWidth: 800,
        fontSize: 11,
        color: 'var(--p-text-tertiary)',
        lineHeight: 1.45,
      }}
    >
      {intentHelp.engineStripCaption}
    </p>
    </div>
  );
}

export function IntentEditor() {
  const overrides = useIntentStore((s) => s.overrides);
  const clearAll = useIntentStore((s) => s.clearAll);
  const overrideCount = Object.keys(overrides).length;

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        background: 'var(--p-bg)',
        color: 'var(--p-text)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          padding: '16px 16px 12px',
          borderBottom: '1px solid var(--p-border)',
        }}
      >
        <div style={{ minWidth: 0, flex: 1, maxWidth: 720 }}>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Intents</h2>
          <p
            style={{
              margin: '6px 0 0',
              fontSize: 11,
              color: 'var(--p-text-tertiary)',
              lineHeight: 1.45,
            }}
          >
            {intentHelp.pageTitle}
          </p>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flex: '0 0 auto',
          }}
        >
          <button
            type="button"
            onClick={clearAll}
            disabled={overrideCount === 0}
            className="focus-visible-ring"
            style={{
              padding: '4px 10px',
              fontSize: 11,
              background: 'transparent',
              color: overrideCount === 0 ? 'var(--p-text-tertiary)' : 'var(--p-text-secondary)',
              border: '1px solid var(--p-border)',
              borderRadius: 4,
              cursor: overrideCount === 0 ? 'default' : 'pointer',
              opacity: overrideCount === 0 ? 0.5 : 1,
            }}
          >
            Clear overrides
          </button>
        </div>
      </div>

      <EngineConfigPanel />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: GRID_COLUMNS,
          gap: 12,
          padding: '10px 16px',
          borderBottom: '1px solid var(--p-border)',
          background: 'var(--p-bg-inset)',
          position: 'sticky',
          top: 0,
          zIndex: 2,
        }}
      >
        <div style={headerLabelRow}>
          <span style={headerCell}>Token</span>
          <HelpPopover title="Token column" triggerLabel="Help: token column">
            <TokenColumnHelpBody />
          </HelpPopover>
        </div>
        <div style={headerLabelRow}>
          <span style={headerCell}>Preference</span>
          <HelpPopover title="Preference" triggerLabel="Help: intent preference">
            <PreferenceColumnHelpBody />
          </HelpPopover>
        </div>
        <div style={headerLabelRow}>
          <span style={headerCell}>Consistency</span>
          <HelpPopover title="Consistency" triggerLabel="Help: cross-ramp consistency">
            <ConsistencyColumnHelpBody />
          </HelpPopover>
        </div>
        <div style={headerLabelRow}>
          <span style={headerCell}>Surface</span>
          <HelpPopover title="Surface context" triggerLabel="Help: which surface to contrast against">
            <SurfaceColumnHelpBody />
          </HelpPopover>
        </div>
        <div style={headerCell} aria-hidden>
          {'\u00a0'}
        </div>
      </div>

      {VOCABULARY_V1_SLICE.map((entry) => (
        <IntentRow key={entry.path} entry={entry} />
      ))}
    </div>
  );
}
