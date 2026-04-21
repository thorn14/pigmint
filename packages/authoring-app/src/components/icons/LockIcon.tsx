interface LockIconProps {
  locked?: boolean;
}

export function LockIcon({ locked }: LockIconProps) {
  return locked ? (
    <svg width="11" height="13" viewBox="0 0 11 13" fill="currentColor" aria-hidden="true" style={{ display: 'block' }}>
      <rect x="1.5" y="5.5" width="8" height="6.5" rx="1.5" />
      <path d="M3 5.5V3.5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <circle cx="5.5" cy="8.75" r="1" fill="var(--p-bg-subtle)" />
    </svg>
  ) : (
    <svg width="11" height="13" viewBox="0 0 11 13" fill="currentColor" aria-hidden="true" style={{ display: 'block' }}>
      <rect x="1.5" y="5.5" width="8" height="6.5" rx="1.5" />
      <path d="M3 5.5V3.5a2.5 2.5 0 0 1 5 0" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}
