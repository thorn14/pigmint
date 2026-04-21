import type { ColorScale } from '../../types/palette';
import { useGeneratedRamp } from '../../hooks/useGeneratedRamp';
import { Swatch } from './Swatch';
import { AdjacentContrastRow } from '../accessibility/AdjacentContrastRow';
import { usePaletteStore } from '../../store/paletteStore';

interface Props {
  scale: ColorScale;
  showLabel?: boolean;
}

export function RampRow({ scale, showLabel = true }: Props) {
  const ramp = useGeneratedRamp(scale);
  const setFocusedStep = usePaletteStore((s) => s.setFocusedStep);

  return (
    <div className="space-y-1">
      {showLabel && (
        <p className="text-xs font-medium text-neutral-400 mb-1">{scale.name}</p>
      )}
      <div className="flex gap-1">
        {ramp.steps.map((step) => (
          <Swatch
            key={step.name}
            step={step}
            onClick={() => setFocusedStep({ scaleId: scale.id, stepName: step.name })}
          />
        ))}
      </div>
      <AdjacentContrastRow ramp={ramp} />
    </div>
  );
}
