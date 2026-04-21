import type { WCAGLevel } from '../../types/palette';

interface Props {
  level: WCAGLevel;
  ratio?: number;
  showRatio?: boolean;
}

const LEVEL_STYLES: Record<WCAGLevel, { backgroundColor: string; color: string }> = {
  AAA: { backgroundColor: 'var(--p-success-subtle)', color: 'var(--p-success)' },
  AA: { backgroundColor: 'var(--p-success-subtle)', color: 'var(--p-success)' },
  'AA-large': { backgroundColor: 'var(--p-success-subtle)', color: 'var(--p-success)' },
  fail: { backgroundColor: 'var(--p-danger-subtle)', color: 'var(--p-danger)' },
};

const LEVEL_LABEL: Record<WCAGLevel, string> = {
  AAA: 'AAA',
  AA: 'AA',
  'AA-large': 'AA lg',
  fail: 'fail',
};

export function ContrastBadge({ level, ratio, showRatio = false }: Props) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none"
      style={LEVEL_STYLES[level]}
      title={ratio ? `Contrast ratio: ${ratio.toFixed(2)}:1` : undefined}
    >
      {LEVEL_LABEL[level]}
      {showRatio && ratio && <span className="opacity-80">{ratio.toFixed(1)}</span>}
    </span>
  );
}
