import { StickerPanel } from './components/StickerPanel';

interface ModeSpec {
  mode: string;
  label: string;
  className: string;
  dataAttrs?: Record<string, string>;
}

// Tailwind adapter currently supports light and dark (see packages/adapter-tailwind/src/manifest.ts).
// High-contrast panels are intentionally omitted until the adapter's MODE_SELECTORS use element-scoped
// selectors (currently `:root[data-contrast="high"]` only matches the document root).
const MODES: ModeSpec[] = [
  { mode: 'light', label: 'Light', className: '' },
  { mode: 'dark', label: 'Dark', className: 'dark' },
];

export default function App() {
  return (
    <div style={{ minHeight: '100%', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Sticker sheet · Tailwind adapter</h1>
        <p style={{ margin: 0, fontSize: 13, opacity: 0.75, maxWidth: 720 }}>
          Verification surface for <code>@pigmint/adapter-tailwind</code>. Each panel renders against a different engine
          mode using the generated CSS vars under <code>src/generated/tokens.css</code>. Regenerate via{' '}
          <code>pnpm --filter @pigmint/sticker-sheet-tailwind generate:tokens</code>. Modes that the current fixture
          doesn't emit render with fallback values (browser default).
        </p>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 16,
        }}
      >
        {MODES.map((m) => (
          <StickerPanel
            key={m.mode}
            mode={m.mode}
            label={m.label}
            className={m.className}
            dataAttrs={m.dataAttrs}
          />
        ))}
      </div>
    </div>
  );
}
