import { useId, type ReactNode } from 'react';
import { Popover } from '@base-ui/react/popover';

const PANEL_MAX_W = 420;

type HelpPopoverProps = {
  title: string;
  children: ReactNode;
  /** Shown for the trigger; defaults to the title. */
  triggerLabel?: string;
};

/**
 * Click-to-open help popover with rich `children` as body (Base UI `Popover`).
 */
export function HelpPopover({ title, children, triggerLabel }: HelpPopoverProps) {
  const panelId = useId();
  const label = triggerLabel ?? `Help: ${title}`;

  return (
    <Popover.Root modal={false}>
      <Popover.Trigger
        className="focus-visible-ring"
        id={panelId}
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
        aria-label={label}
      >
        <InfoGlyph />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="start"
          sideOffset={6}
          collisionPadding={8}
          style={{ zIndex: 20_000, maxWidth: PANEL_MAX_W, width: 'max-content' as const }}
        >
          <Popover.Popup
            className="focus-visible-ring"
            id={`${panelId}-popup`}
            style={{
              maxWidth: PANEL_MAX_W,
              width: 'min(100vw - 16px, 420px)',
              maxHeight: 'min(62vh, 440px)',
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--p-bg)',
              color: 'var(--p-text)',
              border: '1px solid var(--p-border)',
              borderRadius: 8,
              boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.04)',
              overflow: 'hidden',
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
              <Popover.Title
                id={`${panelId}-title`}
                style={{ margin: 0, fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}
              >
                {title}
              </Popover.Title>
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
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
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
