import { StickerPanel } from './components/StickerPanel';

interface ModeSpec {
  mode: string;
  label: string;
  className: string;
}

const MODES: ModeSpec[] = [
  { mode: 'light', label: 'Light', className: '' },
  { mode: 'dark', label: 'Dark', className: 'dark' },
  { mode: 'light-high-contrast', label: 'Light · HC', className: 'light-high-contrast' },
  { mode: 'dark-high-contrast', label: 'Dark · HC', className: 'dark-high-contrast' },
];

export default function App() {
  return (
    <div
      style={{
        minHeight: '100%',
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
          Sticker sheet · Tailwind adapter
        </h1>
        <p style={{ margin: 0, fontSize: 13, opacity: 0.75, maxWidth: 760 }}>
          Verification surface for <code>@pigmint/adapter-tailwind</code>. Each panel renders the
          same component set against a different engine mode using the CSS vars in{' '}
          <code>src/generated/tokens.css</code>. Regenerate via{' '}
          <code>pnpm --filter @pigmint/sticker-sheet-tailwind generate:tokens</code>. HC panels pick
          higher-contrast primitives than their base-mode counterparts — text AA floors lift to 7:1,
          non-text floors lift to 4.5:1.
        </p>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: 16,
          alignItems: 'start',
        }}
      >
        {MODES.map((m) => (
          <StickerPanel key={m.mode} mode={m.mode} label={m.label} className={m.className} />
        ))}
      </div>
    </div>
  );
}
