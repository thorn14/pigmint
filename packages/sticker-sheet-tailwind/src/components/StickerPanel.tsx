import type { CSSProperties, ReactNode } from 'react';

export interface StickerPanelProps {
  mode: string;
  label: string;
  className: string;
  dataAttrs?: Record<string, string>;
  children?: ReactNode;
}

export function StickerPanel({ mode, label, className, dataAttrs, children }: StickerPanelProps) {
  const attrs = dataAttrs ?? {};
  const rootStyle: CSSProperties = {
    background: 'var(--background)',
    color: 'var(--foreground)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  };
  return (
    <section className={className} {...attrs} style={rootStyle} aria-label={`Mode: ${mode}`}>
      <PanelHeader label={label} mode={mode} />
      {children ?? <DefaultSheet />}
    </section>
  );
}

function PanelHeader({ label, mode }: { label: string; mode: string }) {
  return (
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, letterSpacing: '0.02em' }}>{label}</h2>
      <code style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--muted-foreground)' }}>
        {mode}
      </code>
    </header>
  );
}

function DefaultSheet() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Typography />
      <ButtonRow />
      <StatusCallouts />
      <Card />
      <BorderStripes />
      <InputGroup />
      <Callout />
      <SurfaceInverse />
    </div>
  );
}

function Typography() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <p style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Heading on main surface</p>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--muted-foreground)' }}>
        Muted supporting copy on the main surface.
      </p>
      <p
        style={{
          margin: 0,
          fontSize: 12,
          color: 'var(--color-foreground-subtle)',
        }}
      >
        Subtle caption — lowest foreground emphasis.
      </p>
    </div>
  );
}

function ButtonRow() {
  const focusStyle: CSSProperties = { outline: '2px solid var(--ring)', outlineOffset: 2 };
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button
        type="button"
        style={{
          background: 'var(--primary)',
          color: 'var(--primary-foreground)',
          border: 'none',
          borderRadius: 8,
          padding: '8px 14px',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          ...focusStyle,
        }}
      >
        Primary
      </button>
      <button
        type="button"
        style={{
          background: 'transparent',
          color: 'var(--foreground)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '8px 14px',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Outline
      </button>
      <button
        type="button"
        style={{
          background: 'var(--secondary)',
          color: 'var(--secondary-foreground)',
          border: '1px solid transparent',
          borderRadius: 8,
          padding: '8px 14px',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Secondary
      </button>
      <button
        type="button"
        style={{
          background: 'transparent',
          color: 'var(--muted-foreground)',
          border: 'none',
          borderRadius: 8,
          padding: '8px 14px',
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        Ghost
      </button>
      <button
        type="button"
        style={{
          background: 'var(--destructive)',
          color: 'var(--destructive-foreground)',
          border: 'none',
          borderRadius: 8,
          padding: '8px 14px',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Destructive
      </button>
      <button
        type="button"
        disabled
        style={{
          background: 'var(--primary)',
          color: 'var(--primary-foreground)',
          border: 'none',
          borderRadius: 8,
          padding: '8px 14px',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'not-allowed',
          opacity: 0.45,
        }}
      >
        Disabled
      </button>
    </div>
  );
}

function StatusCallouts() {
  const base: CSSProperties = {
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <strong style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.8 }}>
        Feedback
      </strong>
      <div
        style={{
          ...base,
          background: 'var(--success)',
          color: 'var(--success-foreground)',
          border: '1px solid var(--success-border)',
        }}
      >
        <strong>Success</strong>
        <span>Background, text, and border from the success ramp.</span>
      </div>
      <div
        style={{
          ...base,
          background: 'var(--destructive)',
          color: 'var(--destructive-foreground)',
          border: '1px solid var(--destructive-border)',
        }}
      >
        <strong>Danger</strong>
        <span>Destructive status and actions share the danger ramp.</span>
      </div>
      <div
        style={{
          ...base,
          background: 'var(--warning)',
          color: 'var(--warning-foreground)',
        }}
      >
        <strong>Warning</strong>
        <span>Caution copy and surfaces.</span>
      </div>
      <div
        style={{
          ...base,
          background: 'var(--info)',
          color: 'var(--info-foreground)',
        }}
      >
        <strong>Info</strong>
        <span>Informational panels and hints.</span>
      </div>
    </div>
  );
}

function BorderStripes() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <strong style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.8 }}>
        Borders
      </strong>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div
          style={{
            height: 10,
            borderRadius: 4,
            border: '2px solid var(--border)',
            background: 'var(--background)',
          }}
          title="color.border.main"
        />
        <div
          style={{
            height: 10,
            borderRadius: 4,
            border: '2px solid var(--color-border-subtle)',
            background: 'var(--background)',
          }}
          title="color.border.subtle"
        />
        <div
          style={{
            height: 10,
            borderRadius: 4,
            border: '2px solid var(--border-strong)',
            background: 'var(--background)',
          }}
          title="color.border.prominent"
        />
      </div>
    </div>
  );
}

function Card() {
  return (
    <div
      style={{
        background: 'var(--card)',
        color: 'var(--foreground)',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 10,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 13 }}>Elevated card</strong>
        <Badge>badge</Badge>
      </div>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--muted-foreground)' }}>
        Rendered on <code>--card</code> (<code>color.surface.elevated</code>) with a subtle-border
        outline.
      </p>
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: 'var(--muted)',
        color: 'var(--muted-foreground)',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 999,
        padding: '2px 8px',
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </span>
  );
}

function InputGroup() {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
      <span style={{ fontWeight: 600 }}>Email</span>
      <input
        type="email"
        placeholder="you@example.com"
        style={{
          background: 'var(--background)',
          color: 'var(--foreground)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '8px 10px',
          fontSize: 13,
          outline: 'none',
        }}
        onFocus={(e) => {
          e.currentTarget.style.outline = '2px solid var(--ring)';
          e.currentTarget.style.outlineOffset = '2px';
        }}
        onBlur={(e) => {
          e.currentTarget.style.outline = 'none';
        }}
      />
      <span style={{ fontSize: 11, color: 'var(--color-foreground-subtle)' }}>
        We never share your address.
      </span>
    </label>
  );
}

function Callout() {
  return (
    <div
      style={{
        background: 'var(--muted)',
        color: 'var(--muted-foreground)',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 8,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <strong style={{ fontSize: 12, color: 'var(--foreground)' }}>Heads up</strong>
      <span style={{ fontSize: 12 }}>Callout rendered on the subtle surface.</span>
    </div>
  );
}

function SurfaceInverse() {
  return (
    <div
      style={{
        background: 'var(--accent)',
        color: 'var(--accent-foreground)',
        borderRadius: 8,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <strong style={{ fontSize: 13 }}>Inverse surface</strong>
      <span style={{ fontSize: 12, opacity: 0.85 }}>
        Text resolves against <code>color.surface.inverse</code>.
      </span>
    </div>
  );
}
