import type { CvdProfile } from '@pigmint/core';
import type { CSSProperties } from 'react';
import { CVD_PROFILE_OPTIONS, ENGINE_MODE_OPTIONS, type EngineMode } from '../../store/intentStore';
import { intentHelp } from './intentHelpCopy';

const p: CSSProperties = {
  margin: '0 0 12px',
  fontSize: 12,
  lineHeight: 1.55,
  color: 'var(--p-text-secondary)',
};

const h4: CSSProperties = {
  margin: '16px 0 8px',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--p-text-tertiary)',
};

const code: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  fontSize: 11,
  padding: '2px 6px',
  borderRadius: 4,
  background: 'var(--p-bg-inset)',
  border: '1px solid var(--p-border)',
  color: 'var(--p-text)',
};

const optBlock: CSSProperties = {
  marginBottom: 12,
  paddingBottom: 12,
  borderBottom: '1px solid var(--p-border)',
};

export function TokenColumnHelpBody() {
  return (
    <>
      <p style={p}>{intentHelp.colToken}</p>
      <h4 style={{ ...h4, marginTop: 0 }}>What you see in the row</h4>
      <p style={{ ...p, marginBottom: 0 }}>
        The primary line is the token path. A second line (when present) is the vocabulary description; it may be
        truncated—export or the spec lists the full text.
      </p>
    </>
  );
}

export function PreferenceColumnHelpBody() {
  return (
    <>
      <p style={{ ...p, marginTop: 0 }}>{intentHelp.colPreference}</p>
      <h4 style={h4}>Options in the menu</h4>
      {(['lowest-passing', 'highest-contrast', 'matched-to-set', 'anchored'] as const).map((key) => (
        <div key={key} style={optBlock}>
          <div style={{ marginBottom: 6 }}>
            <code style={code}>{key}</code>
          </div>
          <p style={{ ...p, marginBottom: 0 }}>{intentHelp.preference[key]}</p>
        </div>
      ))}
    </>
  );
}

export function ConsistencyColumnHelpBody() {
  return (
    <>
      <p style={{ ...p, marginTop: 0 }}>{intentHelp.colConsistency}</p>
      <h4 style={h4}>Options in the menu</h4>
      {(['independent', 'matched-across-ramps', 'anchored-to-reference'] as const).map((key) => (
        <div key={key} style={optBlock}>
          <div style={{ marginBottom: 6 }}>
            <code style={code}>{key}</code>
          </div>
          <p style={{ ...p, marginBottom: 0 }}>{intentHelp.consistency[key]}</p>
        </div>
      ))}
    </>
  );
}

export function SurfaceColumnHelpBody() {
  return (
    <>
      <p style={{ ...p, marginTop: 0 }}>{intentHelp.colSurface}</p>
      <h4 style={h4}>Options in the menu</h4>
      {(['primary', 'elevated', 'inverse', 'current'] as const).map((key) => (
        <div key={key} style={optBlock}>
          <div style={{ marginBottom: 6 }}>
            <code style={code}>{key}</code>
          </div>
          <p style={{ ...p, marginBottom: 0 }}>{intentHelp.surface[key]}</p>
        </div>
      ))}
    </>
  );
}

export function ComplianceHelpBody() {
  return <p style={{ ...p, marginBottom: 0 }}>{intentHelp.engineCompliance}</p>;
}

export function TargetLevelHelpBody() {
  return (
    <>
      <p style={{ ...p, marginTop: 0 }}>{intentHelp.engineTarget}</p>
      <h4 style={h4}>AA</h4>
      <p style={p}>{intentHelp.levelAA}</p>
      <h4 style={h4}>AAA</h4>
      <p style={{ ...p, marginBottom: 0 }}>{intentHelp.levelAAA}</p>
    </>
  );
}

const MODE_ORDER: EngineMode[] = [...ENGINE_MODE_OPTIONS];

const MODE_HELP: Record<EngineMode, string> = {
  light: intentHelp.modeLight,
  dark: intentHelp.modeDark,
  'light-high-contrast': intentHelp.modeLightHc,
  'dark-high-contrast': intentHelp.modeDarkHc,
};

export function EngineModesHelpBody() {
  return (
    <>
      <p style={{ ...p, marginTop: 0 }}>{intentHelp.engineModes}</p>
      <h4 style={h4}>Each checkbox</h4>
      {MODE_ORDER.map((m) => (
        <div key={m} style={optBlock}>
          <div style={{ marginBottom: 6 }}>
            <code style={code}>{m}</code>
          </div>
          <p style={{ ...p, marginBottom: 0 }}>{MODE_HELP[m]}</p>
        </div>
      ))}
    </>
  );
}

export function ResolverHelpBody() {
  return (
    <>
      <p style={{ ...p, marginTop: 0 }}>{intentHelp.engineResolver}</p>
      <h4 style={h4}>stepped</h4>
      <p style={p}>{intentHelp.resolverStepped}</p>
      <h4 style={h4}>continuous</h4>
      <p style={p}>{intentHelp.resolverContinuous}</p>
      <h4 style={h4}>Fallback steps (number field)</h4>
      <p style={{ ...p, marginBottom: 0 }}>{intentHelp.engineResolverFallback}</p>
    </>
  );
}

const cvdLabel: Record<CvdProfile, string> = {
  deuteranopia: 'Deuteranopia',
  protanopia: 'Protanopia',
  tritanopia: 'Tritanopia',
  achromatopsia: 'Achromatopsia',
};

const CVD_TEXT: Record<CvdProfile, string> = {
  deuteranopia: intentHelp.cvdDeuteranopia,
  protanopia: intentHelp.cvdProtanopia,
  tritanopia: intentHelp.cvdTritanopia,
  achromatopsia: intentHelp.cvdAchromatopsia,
};

export function CvdHelpBody() {
  return (
    <>
      <p style={{ ...p, marginTop: 0 }}>{intentHelp.engineCvd}</p>
      <h4 style={h4}>Profiles</h4>
      {CVD_PROFILE_OPTIONS.map((profile) => (
        <div key={profile} style={optBlock}>
          <div style={{ marginBottom: 6 }}>
            <code style={code}>{profile}</code>
            <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--p-text-secondary)' }}>{cvdLabel[profile]}</span>
          </div>
          <p style={{ ...p, marginBottom: 0 }}>{CVD_TEXT[profile]}</p>
        </div>
      ))}
    </>
  );
}
