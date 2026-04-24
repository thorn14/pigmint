import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

const GAP = 6;
const PANEL_MAX_W = 420;

type HelpPopoverProps = {
  title: string;
  children: ReactNode;
  /** Shown for the trigger; defaults to the title. */
  triggerLabel?: string;
};

/**
 * Click-to-open help popover with rich `children` as body. Closes on outside click or Escape.
 */
export function HelpPopover({ title, children, triggerLabel }: HelpPopoverProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; maxH: number; maxW: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();
  const label = triggerLabel ?? `Help: ${title}`;

  const updatePos = useCallback(() => {
    const t = triggerRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const maxW = Math.min(PANEL_MAX_W, vw - 16);
    const maxH = Math.min(Math.floor(vh * 0.62), 440);
    let top = r.bottom + GAP;
    if (top + maxH > vh - 8) {
      top = r.top - GAP - maxH;
    }
    if (top < 8) {
      top = 8;
    }
    const left = Math.max(8, Math.min(r.left, vw - 8 - maxW));
    setPos({ top, left, maxH, maxW });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    updatePos();
  }, [open, updatePos]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onReposition = () => {
      if (open) updatePos();
    };
    document.addEventListener('mousedown', onDoc, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', onReposition, true);
    window.addEventListener('resize', onReposition);
    return () => {
      document.removeEventListener('mousedown', onDoc, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', onReposition, true);
      window.removeEventListener('resize', onReposition);
    };
  }, [open, updatePos]);

  const portal =
    typeof document !== 'undefined' &&
    open &&
    pos &&
    createPortal(
      <div
        id={panelId}
        ref={panelRef}
        role="dialog"
        aria-label={title}
        style={{
          position: 'fixed',
          zIndex: 20_000,
          top: pos.top,
          left: pos.left,
          width: pos.maxW,
          maxHeight: pos.maxH,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--p-bg)',
          color: 'var(--p-text)',
          border: '1px solid var(--p-border)',
          borderRadius: 8,
          boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.04)',
          overflow: 'hidden',
          pointerEvents: 'auto',
        }}
      >
        <div
          style={{
            padding: '10px 12px 8px',
            borderBottom: '1px solid var(--p-border)',
            flex: '0 0 auto',
            background: 'var(--p-bg-subtle)',
          }}
        >
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>{title}</h3>
        </div>
        <div
          style={{
            padding: 12,
            overflow: 'auto',
            fontSize: 12,
            lineHeight: 1.5,
            flex: 1,
            minHeight: 0,
          }}
        >
          {children}
        </div>
      </div>,
      document.body,
    );

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((o) => !o)}
        className="focus-visible-ring"
        style={{
          display: 'inline-flex',
          flex: '0 0 auto',
          alignItems: 'center',
          justifyContent: 'center',
          width: 22,
          height: 22,
          padding: 0,
          border: '1px solid var(--p-border)',
          borderRadius: '50%',
          background: 'var(--p-bg-inset)',
          color: 'var(--p-text-secondary)',
          cursor: 'pointer',
        }}
      >
        <InfoGlyph />
      </button>
      {portal}
    </>
  );
}

function InfoGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 102 0v-3a1 1 0 00-1-1z"
        clipRule="evenodd"
      />
    </svg>
  );
}
