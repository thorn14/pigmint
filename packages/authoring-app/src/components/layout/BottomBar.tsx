import type { CSSProperties } from 'react';

export type ActivePanel = 'scales' | 'edit' | null;

interface Props {
  activePanel: ActivePanel;
  onSelectPanel: (panel: ActivePanel) => void;
}

const barStyle: CSSProperties = {
  position: 'fixed',
  bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
  left: 14,
  display: 'inline-flex',
  alignItems: 'center',
  padding: 2,
  gap: 2,
  background: 'rgba(20, 20, 22, 0.78)',
  borderRadius: 8,
  boxShadow: '0 4px 12px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.06)',
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
  color: '#fff',
  zIndex: 40,
};

const btnBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '3px 10px',
  border: 'none',
  borderRadius: 6,
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  cursor: 'pointer',
  background: 'transparent',
  color: 'rgba(255,255,255,0.7)',
  transition: 'background-color 0.12s ease-out, color 0.12s ease-out',
};

const btnActive: CSSProperties = {
  ...btnBase,
  background: 'rgba(255,255,255,0.95)',
  color: '#000',
};

function ScalesIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="3" width="12" height="3" rx="1" />
      <rect x="2" y="7.5" width="12" height="2.5" rx="1" opacity="0.7" />
      <rect x="2" y="11.5" width="12" height="2" rx="1" opacity="0.45" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11.5 2.5l2 2L6 12l-3 1 1-3z" />
      <path d="M10 4l2 2" />
    </svg>
  );
}

export function BottomBar({ activePanel, onSelectPanel }: Props) {
  function toggle(panel: 'scales' | 'edit') {
    onSelectPanel(activePanel === panel ? null : panel);
  }

  return (
    <div style={barStyle} role="toolbar" aria-label="Authoring panels">
      <button
        type="button"
        className="focus-visible-ring"
        aria-pressed={activePanel === 'scales'}
        onClick={() => toggle('scales')}
        style={activePanel === 'scales' ? btnActive : btnBase}
      >
        <ScalesIcon />
        Scales
      </button>
      <button
        type="button"
        className="focus-visible-ring"
        aria-pressed={activePanel === 'edit'}
        onClick={() => toggle('edit')}
        style={activePanel === 'edit' ? btnActive : btnBase}
      >
        <EditIcon />
        Edit
      </button>
    </div>
  );
}
