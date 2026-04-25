import { Slider } from '@base-ui/react/slider';
import type { CSSProperties } from 'react';

type Orientation = 'horizontal' | 'vertical';

export type AppSliderProps = {
  value: number;
  onValueChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  /** CSS color for thumb + filled indicator */
  thumbColor?: string;
  'aria-label'?: string;
  getAriaValueText?: (formattedValue: string, value: number, index: number) => string;
  id?: string;
  name?: string;
  disabled?: boolean;
  orientation?: Orientation;
  /** Fires when the user finishes a drag or track press (maps to pointer-up commit). */
  onValueCommitted?: () => void;
  /** Fires on pointer down on the control (e.g. begin curve edit batch). */
  onPointerDown?: () => void;
  style?: CSSProperties;
  className?: string;
};

/**
 * Single-thumb Base UI slider styled like the legacy `input.p-range` controls.
 */
export function AppSlider({
  value,
  onValueChange,
  min,
  max,
  step = 1,
  thumbColor,
  'aria-label': ariaLabelProp,
  getAriaValueText,
  id,
  name,
  disabled,
  orientation = 'horizontal',
  onValueCommitted,
  onPointerDown,
  style,
  className,
}: AppSliderProps) {
  const ariaLabel = ariaLabelProp ?? 'Value';
  const rootClass =
    orientation === 'vertical'
      ? `app-slider-root app-slider-root-vertical ${className ?? ''}`.trim()
      : `app-slider-root ${className ?? ''}`.trim();

  return (
    <Slider.Root
      className={rootClass}
      style={
        {
          ['--app-slider-thumb' as string]: thumbColor ?? 'var(--p-text-secondary)',
          flex: orientation === 'horizontal' ? 1 : undefined,
          minWidth: orientation === 'horizontal' ? 0 : undefined,
          width: orientation === 'vertical' ? '100%' : undefined,
          ...style,
        } as CSSProperties
      }
      value={value}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      name={name}
      orientation={orientation}
      onValueChange={(v) => onValueChange(v as number)}
      onValueCommitted={() => onValueCommitted?.()}
    >
      <Slider.Control
        className="app-slider-control focus-visible-ring"
        onPointerDown={() => onPointerDown?.()}
      >
        <Slider.Track className="app-slider-track">
          <Slider.Indicator className="app-slider-indicator" />
        </Slider.Track>
        <Slider.Thumb
          className="app-slider-thumb"
          index={0}
          id={id}
          getAriaLabel={() => ariaLabel}
          getAriaValueText={getAriaValueText ?? undefined}
        />
      </Slider.Control>
    </Slider.Root>
  );
}
