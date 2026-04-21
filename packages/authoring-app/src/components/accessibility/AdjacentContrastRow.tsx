import type { GeneratedRamp } from '../../types/palette';
import { useAdjacentContrasts, useAdjacentApcaContrasts } from '../../hooks/useContrastMatrix';
import { ContrastBadge } from './ContrastBadge';
import { ApcaBadge } from './ApcaBadge';
import { usePaletteStore } from '../../store/paletteStore';

interface Props {
  ramp: GeneratedRamp;
}

export function AdjacentContrastRow({ ramp }: Props) {
  const contrastMode = usePaletteStore((s) => s.contrastMode);
  const wcagContrasts = useAdjacentContrasts(ramp);
  const apcaContrasts = useAdjacentApcaContrasts(ramp);

  return (
    <div className="flex gap-1 px-1">
      {/* Empty first cell to align with swatches */}
      <div className="flex-1" />
      {contrastMode === 'apca'
        ? apcaContrasts.map((lc, i) => (
            <div key={i} className="flex-1 flex justify-center">
              <ApcaBadge lc={lc} showValue />
            </div>
          ))
        : wcagContrasts.map((result, i) => (
            <div key={i} className="flex-1 flex justify-center">
              <ContrastBadge level={result.level} ratio={result.ratio} showRatio />
            </div>
          ))}
      <div className="flex-1" />
    </div>
  );
}
