import type { GeneratedStep } from '../../types/palette';
import { getContrast, getApcaContrast } from '../../lib/colorMath';
import { ContrastBadge } from '../accessibility/ContrastBadge';
import { ApcaBadge } from '../accessibility/ApcaBadge';
import { usePaletteStore } from '../../store/paletteStore';

const supportsP3 = typeof CSS !== 'undefined' && CSS.supports('color', 'color(display-p3 0 0 0)');

interface Props {
  step: GeneratedStep;
  isActive?: boolean;
  onClick?: () => void;
}

export function Swatch({ step, isActive, onClick }: Props) {
  const srgbPreview = usePaletteStore((s) => s.srgbPreview);
  const contrastMode = usePaletteStore((s) => s.contrastMode);

  const bgColor = (!srgbPreview && supportsP3 && step.displayP3) || step.hex;

  if (contrastMode === 'apca') {
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
        style={{ backgroundColor: bgColor, minHeight: '80px', minWidth: '64px' }}
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
      style={{ backgroundColor: bgColor, minHeight: '80px', minWidth: '64px' }}
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
