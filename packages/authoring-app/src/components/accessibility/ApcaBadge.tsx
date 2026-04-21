interface Props {
  lc: number;
  showValue?: boolean;
}

function getTier(absLc: number): { label: string; passing: boolean } {
  if (absLc >= 75) return { label: 'Lc 75+', passing: true };
  if (absLc >= 60) return { label: 'Lc 60+', passing: true };
  if (absLc >= 45) return { label: 'Lc 45+', passing: true };
  return { label: 'fail', passing: false };
}

export function ApcaBadge({ lc, showValue = false }: Props) {
  const absLc = Math.abs(lc);
  const { label, passing } = getTier(absLc);
  const style = passing
    ? { backgroundColor: 'var(--p-success-subtle)', color: 'var(--p-success)' }
    : { backgroundColor: 'var(--p-danger-subtle)', color: 'var(--p-danger)' };

  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none"
      style={style}
      title={`APCA Lc: ${lc.toFixed(1)}`}
    >
      {label}
      {showValue && passing && (
        <span className="opacity-80">{Math.round(absLc)}</span>
      )}
    </span>
  );
}
