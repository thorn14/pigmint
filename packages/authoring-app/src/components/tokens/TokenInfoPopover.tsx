import { useState, type CSSProperties, type ReactNode } from 'react';
import { Popover } from '@base-ui/react/popover';
import type {
  ResolvedToken,
  PortableVocabulary,
  PortableSemanticToken,
  PortableSurfaceToken,
  PortableDecorativeToken,
  PortableAlphaToken,
} from '@pigmint/core';
import { findTokenKind, type TokenKind } from './tokenShared';

type RawToken =
  | { kind: 'surface'; token: PortableSurfaceToken }
  | { kind: 'foreground'; token: PortableSemanticToken }
  | { kind: 'nonText'; token: PortableSemanticToken }
  | { kind: 'decorative'; token: PortableDecorativeToken }
  | { kind: 'alpha'; token: PortableAlphaToken };

function lookupRawToken(vocab: PortableVocabulary, kind: TokenKind, path: string): RawToken | null {
  switch (kind) {
    case 'surface':    return vocab.surfaces[path]    ? { kind, token: vocab.surfaces[path]! }    : null;
    case 'foreground': return vocab.foreground[path]  ? { kind, token: vocab.foreground[path]! }  : null;
    case 'nonText':    return vocab.nonText[path]     ? { kind, token: vocab.nonText[path]! }     : null;
    case 'decorative': return vocab.decorative?.[path] ? { kind, token: vocab.decorative[path]! } : null;
    case 'alpha':      return vocab.alpha?.[path]      ? { kind, token: vocab.alpha[path]! }      : null;
  }
}

type Props = {
  token: ResolvedToken;
  vocabRaw: PortableVocabulary | null;
  useWcag: boolean;
  /** Rendered inside the trigger button. */
  children: ReactNode;
  triggerStyle: CSSProperties;
  triggerClassName?: string;
  onEdit: () => void;
};

export function TokenInfoPopover({
  token, vocabRaw, useWcag, children, triggerStyle, triggerClassName, onEdit,
}: Props) {
  const [open, setOpen] = useState(false);
  const kind = vocabRaw ? findTokenKind(vocabRaw, token.path) : null;
  const raw = kind && vocabRaw ? lookupRawToken(vocabRaw, kind, token.path) : null;

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next, details) => {
        // Click is reserved for opening the edit modal — never toggle the popover on press.
        if (details.reason === 'trigger-press') return;
        setOpen(next);
      }}
    >
      <Popover.Trigger
        openOnHover
        delay={250}
        closeDelay={120}
        className={triggerClassName}
        style={triggerStyle}
        onClick={onEdit}
      >
        {children}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side="top"
          align="center"
          sideOffset={8}
          collisionPadding={8}
          style={{ zIndex: 20_000 }}
        >
          <Popover.Popup
            style={{
              maxWidth: 320,
              width: 'max-content',
              background: 'var(--p-bg)',
              color: 'var(--p-text)',
              border: '1px solid var(--p-border)',
              borderRadius: 8,
              boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.04)',
              overflow: 'hidden',
            }}
          >
            <Body token={token} kind={kind} raw={raw} useWcag={useWcag} />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Body({
  token, kind, raw, useWcag,
}: {
  token: ResolvedToken;
  kind: TokenKind | null;
  raw: RawToken | null;
  useWcag: boolean;
}) {
  const np = token.source.nearestPrimitive ?? null;
  const positionLabel = `${(token.source.position * 100).toFixed(0)}%`;
  const tokenAlpha = token.alpha?.alphaValue ?? token.oklch.alpha;

  const contrast = useWcag
    ? (token.contrast?.wcag21 ?? null)
    : (token.contrast?.apca ?? null);
  const contrastStr = contrast !== null
    ? (useWcag ? `${contrast.toFixed(2)}:1` : `Lc ${Math.abs(contrast).toFixed(0)}`)
    : '—';

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{
        padding: '10px 12px 8px',
        borderBottom: '1px solid var(--p-border)',
        background: 'var(--p-surface)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <span
          aria-hidden="true"
          style={{
            width: 14, height: 14, borderRadius: 3,
            background: token.hex,
            border: '1px solid rgba(0,0,0,0.18)',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
            flexShrink: 0,
          }}
        />
        <span style={{
          fontFamily: 'monospace',
          fontWeight: 600,
          fontSize: 12,
          lineHeight: 1.3,
          wordBreak: 'break-all',
        }}>
          {token.path}
        </span>
      </div>
      <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {kind && <Row label="Kind" value={kind} />}
        <Row label="Source" value={np ?? `${token.source.ramp} @ ${positionLabel}`} />
        <Row label="Hex" value={token.hex} />
        {tokenAlpha != null && tokenAlpha < 1 && (
          <Row label="Alpha" value={tokenAlpha.toFixed(2)} />
        )}
        {token.resolvedAgainst && <Row label="Against" value={token.resolvedAgainst} />}
        {raw && renderRawDetails(raw)}
        <Row label="Contrast" value={contrastStr} />
        {token.compliance && <Row label="Compliance" value={token.compliance.level} />}
        {token.compliance?.apcaLc && (
          <Row label="APCA" value={`${token.compliance.apcaLc.achieved.toFixed(0)} / ${token.compliance.apcaLc.required.toFixed(0)}`} />
        )}
      </div>
    </div>
  );
}

function renderRawDetails(raw: RawToken): ReactNode[] {
  switch (raw.kind) {
    case 'surface': {
      const t = raw.token;
      const rows: ReactNode[] = [<Row key="ramp" label="Ramp" value={t.ramp} />];
      if (t.step != null)      rows.push(<Row key="step"  label="Step"       value={String(t.step)} />);
      if (t.lightStep != null) rows.push(<Row key="light" label="Light step" value={String(t.lightStep)} />);
      if (t.darkStep != null)  rows.push(<Row key="dark"  label="Dark step"  value={String(t.darkStep)} />);
      return rows;
    }
    case 'foreground':
    case 'nonText': {
      const t = raw.token;
      const rows: ReactNode[] = [
        <Row key="ramp" label="Ramp"       value={t.ramp} />,
        <Row key="pref" label="Preference" value={t.preference} />,
      ];
      if (t.consistency)         rows.push(<Row key="cons"   label="Consistency" value={t.consistency} />);
      if (t.level)               rows.push(<Row key="level"  label="Level"       value={t.level} />);
      if (t.targetContrast != null) rows.push(<Row key="target" label="Target"   value={String(t.targetContrast)} />);
      if (t.preference === 'pin-to-step') {
        if (t.lightStep != null) rows.push(<Row key="light" label="Light step" value={String(t.lightStep)} />);
        if (t.darkStep != null)  rows.push(<Row key="dark"  label="Dark step"  value={String(t.darkStep)} />);
      }
      if (t.surfaces.length > 0) rows.push(<Row key="surfaces" label="Surfaces" value={t.surfaces.join(', ')} />);
      if (t.decorative)          rows.push(<Row key="dec" label="Decorative" value="yes" />);
      return rows;
    }
    case 'decorative': {
      const t = raw.token;
      return [
        <Row key="ramp" label="Ramp" value={t.ramp} />,
        <Row key="step" label="Step" value={String(t.step)} />,
      ];
    }
    case 'alpha': {
      const t = raw.token;
      const rows: ReactNode[] = [];
      if (t.base)        rows.push(<Row key="base"     label="Base"      value={t.base} />);
      if (t.baseRamp)    rows.push(<Row key="baseRamp" label="Base ramp" value={t.baseRamp} />);
      rows.push(<Row key="value" label="Alpha" value={String(t.value)} />);
      if (t.referenceSurface) rows.push(<Row key="ref"   label="Against"    value={t.referenceSurface} />);
      if (t.preference)       rows.push(<Row key="pref"  label="Preference" value={t.preference} />);
      if (t.surfaces && t.surfaces.length > 0) rows.push(<Row key="surfaces" label="Surfaces" value={t.surfaces.join(', ')} />);
      if (t.level)            rows.push(<Row key="level" label="Level" value={t.level} />);
      if (t.usage)            rows.push(<Row key="usage" label="Usage" value={t.usage} />);
      if (t.targetContrast != null) rows.push(<Row key="target" label="Target" value={String(t.targetContrast)} />);
      return rows;
    }
  }
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      gap: 12,
      alignItems: 'baseline',
    }}>
      <span style={{ color: 'var(--p-text-secondary)', fontSize: 11, flexShrink: 0 }}>{label}</span>
      <span style={{
        color: 'var(--p-text)',
        fontFamily: 'monospace',
        fontSize: 12,
        fontWeight: 600,
        textAlign: 'right',
        wordBreak: 'break-all',
      }}>
        {value}
      </span>
    </div>
  );
}
