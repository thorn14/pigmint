import { formatCss } from 'culori';
import type { GeneratedStep } from '../../types/palette';
import { getContrast, getApcaContrast } from '../../lib/colorMath';
import { ContrastBadge } from '../accessibility/ContrastBadge';
import { ApcaBadge } from '../accessibility/ApcaBadge';
import { useIntentStore } from '../../store/intentStore';
import { stepDisplayColor } from '../../lib/gamutDisplay';


interface Props {
  step: GeneratedStep;
  isActive?: boolean;
  onClick?: () => void;
}

export function Swatch({ step, isActive, onClick }: Props) {
  const apca = useIntentStore((s) => s.engineCompliance === 'apca');

  const stepAlpha = step.oklch.alpha;
  const isTransparent = stepAlpha != null && stepAlpha < 1;
  const { l, c, h } = step.oklch;
  const bgColor = isTransparent
    ? (formatCss({ mode: 'oklch', l, c, h, alpha: stepAlpha }) ?? step.hex)
    : stepDisplayColor(step);

  const bgStyle: React.CSSProperties = { backgroundColor: bgColor };

  if (apca) {
    const lcWhite = getApcaContrast('#ffffff', step.hex);
    const lcBlack = getApcaContrast('#000000', step.hex);
    const bestLc = Math.abs(lcBlack) >= Math.abs(lcWhite) ? lcBlack : lcWhite;
    const textColor = Math.abs(lcBlack) >= Math.abs(lcWhite) ? '#000000' : '#ffffff';

    return (
      <button
        onClick={onClick}
        aria-label={`${step.name}: ${step.hex}`}
        className={`motion-safe-swatch focus-visible-ring flex flex-col items-start justify-end p-2 rounded cursor-pointer
          ${isActive ? 'ring-2 ring-white ring-offset-2 ring-offset-neutral-900 scale-105' : 'motion-safe hover:scale-[1.03]'}
        `}
        style={{ ...bgStyle, minHeight: '80px', minWidth: '64px' }}
        title={`${step.name}: ${step.hex}`}
      >
        <span className="text-[10px] font-mono font-medium leading-tight" style={{ color: textColor }}>
          {step.name}
        </span>
        <span className="text-[9px] font-mono opacity-80 leading-tight" style={{ color: textColor }}>
          {step.hex}
        </span>
        <div className="mt-1">
          <ApcaBadge lc={bestLc} showValue />
        </div>
      </button>
    );
  }

  const contrastWhite = getContrast(step.hex, '#ffffff');
  const contrastBlack = getContrast(step.hex, '#000000');
  const textColor = contrastBlack.ratio > contrastWhite.ratio ? '#000000' : '#ffffff';
  const bestContrast = contrastBlack.ratio > contrastWhite.ratio ? contrastBlack : contrastWhite;

  return (
    <button
      onClick={onClick}
      aria-label={`${step.name}: ${step.hex}`}
      className={`motion-safe-swatch focus-visible-ring flex flex-col items-start justify-end p-2 rounded cursor-pointer
        ${isActive ? 'ring-2 ring-white ring-offset-2 ring-offset-neutral-900 scale-105' : 'motion-safe hover:scale-[1.03]'}
      `}
      style={{ ...bgStyle, minHeight: '80px', minWidth: '64px' }}
      title={`${step.name}: ${step.hex}`}
    >
      <span className="text-[10px] font-mono font-medium leading-tight" style={{ color: textColor }}>
        {step.name}
      </span>
      <span className="text-[9px] font-mono opacity-80 leading-tight" style={{ color: textColor }}>
        {step.hex}
      </span>
      <div className="mt-1">
        <ContrastBadge level={bestContrast.level} ratio={bestContrast.ratio} showRatio />
      </div>
    </button>
  );
}
