import type { ReactNode } from 'react';

export interface StickerPanelProps {
  mode: string;
  label: string;
  className: string;
  dataAttrs?: Record<string, string>;
  children?: ReactNode;
}

export function StickerPanel({ mode, label, className, dataAttrs, children }: StickerPanelProps) {
  const attrs = dataAttrs ?? {};
  return (
    <section
      className={className}
      {...attrs}
      style={{
        background: 'var(--background)',
        color: 'var(--foreground)',
        borderRadius: 12,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        boxShadow: '0 0 0 1px rgba(255,255,255,0.08)',
      }}
      aria-label={`Mode: ${mode}`}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, letterSpacing: '0.02em' }}>{label}</h2>
        <code style={{ fontSize: 11, opacity: 0.6, fontFamily: 'monospace' }}>{mode}</code>
      </header>
      {children ?? <DefaultSheet />}
    </section>
  );
}

function DefaultSheet() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Typography />
      <Actions />
      <SurfacePair />
      <FormField />
    </div>
  );
}

function Typography() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <p style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Body text on main surface</p>
      <p style={{ margin: 0, fontSize: 13, opacity: 0.75 }}>
        Secondary paragraph. Resolves against <code style={{ fontFamily: 'monospace' }}>color.surface.main</code>.
      </p>
    </div>
  );
}

function Actions() {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <button
        type="button"
        style={{
          background: 'var(--primary)',
          color: 'var(--background)',
          border: 'none',
          borderRadius: 8,
          padding: '8px 16px',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Primary action
      </button>
      <button
        type="button"
        style={{
          background: 'transparent',
          color: 'var(--foreground)',
          border: '1px solid var(--foreground)',
          borderRadius: 8,
          padding: '8px 16px',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          opacity: 0.8,
        }}
      >
        Secondary
      </button>
      <button
        type="button"
        disabled
        style={{
          background: 'var(--primary)',
          color: 'var(--background)',
          border: 'none',
          borderRadius: 8,
          padding: '8px 16px',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'not-allowed',
          opacity: 0.5,
        }}
      >
        Disabled
      </button>
    </div>
  );
}

function SurfacePair() {
  return (
    <div
      style={{
        background: 'var(--accent)',
        color: 'var(--background)',
        borderRadius: 8,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <strong style={{ fontSize: 13 }}>Inverse surface</strong>
      <span style={{ fontSize: 12, opacity: 0.85 }}>
        Text resolved against <code style={{ fontFamily: 'monospace' }}>color.surface.inverse</code>.
      </span>
    </div>
  );
}

function FormField() {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
      <span style={{ fontWeight: 600 }}>Email</span>
      <input
        type="email"
        placeholder="you@example.com"
        style={{
          background: 'var(--background)',
          color: 'var(--foreground)',
          border: '1px solid var(--foreground)',
          borderRadius: 6,
          padding: '8px 10px',
          fontSize: 13,
          outline: 'none',
        }}
      />
    </label>
  );
}
