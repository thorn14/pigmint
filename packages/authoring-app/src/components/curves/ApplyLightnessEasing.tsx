import { useEffect, useMemo, useState } from 'react';
import {
  CUSTOM_CURVE_BIAS_MAX,
  CUSTOM_CURVE_BIAS_MIN,
  EASING_FAMILY_OPTIONS,
  EASING_VARIANT_OPTIONS,
  easingFamilyHasVariants,
  type EasingFamily,
  type EasingVariant,
} from '../../constants/stepPresets';
import { usePaletteStore } from '../../store/paletteStore';
import { AppSlider, AppStringSelect, type AppStringSelectOption } from '../base-ui';

const familyOptions: readonly AppStringSelectOption[] = EASING_FAMILY_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));

const variantOptions: readonly AppStringSelectOption[] = EASING_VARIANT_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));

const selectStyle: React.CSSProperties = {
  width: '100%',
  height: 28,
  padding: '0 22px 0 8px',
  fontSize: 12,
  fontFamily: 'inherit',
  color: 'var(--p-text)',
};

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--p-text-secondary)',
};

type ApplyScope = 'active' | 'selected' | 'all';

type Props = {
  activeScaleId: string;
  onApplied?: () => void;
};

/**
 * Primer Prism–style apply-easing controls: base curve + variant + explicit Apply,
 * with a scope so the same easing can hit one or many ramps.
 * Custom base exposes a continuous Curve slider for S-bend strength.
 */
export function ApplyLightnessEasing({ activeScaleId, onApplied }: Props) {
  const scales = usePaletteStore((s) => s.scales);
  const selectedScaleIds = usePaletteStore((s) => s.selectedScaleIds);
  const applyLightnessEasing = usePaletteStore((s) => s.applyLightnessEasing);
  const beginCurveEdit = usePaletteStore((s) => s.beginCurveEdit);
  const commitCurveEdit = usePaletteStore((s) => s.commitCurveEdit);

  const [family, setFamily] = useState<EasingFamily>('cubic');
  const [variant, setVariant] = useState<EasingVariant>('inOut');
  const [scope, setScope] = useState<ApplyScope>('active');
  const [curveBias, setCurveBias] = useState(0);

  const isCustom = family === 'custom';
  const hasVariants = easingFamilyHasVariants(family);
  const hasSelection = selectedScaleIds.length > 0;

  useEffect(() => {
    if (!hasSelection && scope === 'selected') setScope('active');
  }, [hasSelection, scope]);

  useEffect(() => {
    setCurveBias(0);
  }, [activeScaleId]);

  const scopeOptions = useMemo((): readonly AppStringSelectOption[] => {
    const opts: AppStringSelectOption[] = [
      { value: 'active', label: 'This scale' },
    ];
    if (hasSelection) {
      opts.push({ value: 'selected', label: `Selected (${selectedScaleIds.length})` });
    }
    opts.push({ value: 'all', label: `All scales (${scales.length})` });
    return opts;
  }, [hasSelection, selectedScaleIds.length, scales.length]);

  function resolveTargetIds(): string[] {
    if (scope === 'all') return scales.map((s) => s.id);
    if (scope === 'selected') return selectedScaleIds.slice();
    return [activeScaleId];
  }

  function handleApply() {
    const ids = resolveTargetIds();
    if (ids.length === 0) return;
    applyLightnessEasing(
      ids,
      family,
      hasVariants ? variant : 'inOut',
      isCustom ? { curveBias } : undefined,
    );
    onApplied?.();
  }

  function handleCurveBiasChange(v: number) {
    setCurveBias(v);
    const ids = resolveTargetIds();
    if (ids.length === 0) return;
    applyLightnessEasing(ids, 'custom', 'inOut', { curveBias: v });
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '8px 0 2px',
        borderTop: '1px solid var(--p-border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <label htmlFor="scales-easing-family" style={{ ...fieldLabelStyle, width: 56, flexShrink: 0 }}>
          Base
        </label>
        <div style={{ flex: 1, minWidth: 0 }}>
          <AppStringSelect
            id="scales-easing-family"
            name="scales-easing-family"
            value={family}
            options={familyOptions}
            style={selectStyle}
            onValueChange={(v) => {
              const next = v as EasingFamily;
              setFamily(next);
              if (next === 'custom') setCurveBias(0);
            }}
          />
        </div>
      </div>

      {isCustom ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <label htmlFor="scales-easing-curve" style={{ ...fieldLabelStyle, width: 56, flexShrink: 0 }}>
            Curve
          </label>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AppSlider
              id="scales-easing-curve"
              value={curveBias}
              min={CUSTOM_CURVE_BIAS_MIN}
              max={CUSTOM_CURVE_BIAS_MAX}
              step={0.01}
              onValueChange={handleCurveBiasChange}
              onPointerDown={() => beginCurveEdit(activeScaleId)}
              onValueCommitted={() => commitCurveEdit()}
              style={{ width: '100%' }}
              aria-label="Custom lightness S-curve strength"
              getAriaValueText={(formatted) => `${formatted} S-curve strength`}
            />
            <span
              style={{
                fontSize: 11,
                fontFamily: 'monospace',
                color: 'var(--p-text-secondary)',
                width: 36,
                textAlign: 'right',
                flexShrink: 0,
              }}
            >
              {curveBias.toFixed(2)}
            </span>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <label htmlFor="scales-easing-variant" style={{ ...fieldLabelStyle, width: 56, flexShrink: 0 }}>
            Easing
          </label>
          <div style={{ flex: 1, minWidth: 0 }}>
            <AppStringSelect
              id="scales-easing-variant"
              name="scales-easing-variant"
              value={hasVariants ? variant : 'inOut'}
              options={hasVariants ? variantOptions : [{ value: 'inOut', label: '—' }]}
              style={selectStyle}
              disabled={!hasVariants}
              onValueChange={(v) => setVariant(v as EasingVariant)}
            />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <label htmlFor="scales-easing-scope" style={{ ...fieldLabelStyle, width: 56, flexShrink: 0 }}>
          Apply to
        </label>
        <div style={{ flex: 1, minWidth: 0 }}>
          <AppStringSelect
            id="scales-easing-scope"
            name="scales-easing-scope"
            value={scope}
            options={scopeOptions}
            style={selectStyle}
            onValueChange={(v) => setScope(v as ApplyScope)}
          />
        </div>
      </div>

      {scope === 'selected' && hasSelection && (
        <p style={{ margin: 0, fontSize: 11, color: 'var(--p-text-secondary)', paddingLeft: 62 }}>
          {selectedScaleIds.length} scale{selectedScaleIds.length === 1 ? '' : 's'} will update from their own endpoints
        </p>
      )}

      {isCustom && (
        <p style={{ margin: 0, fontSize: 11, color: 'var(--p-text-secondary)', paddingLeft: 62 }}>
          0 is even; positive is an S-bend (pack ends); negative inverts the S (pack middle)
        </p>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingLeft: 62 }}>
        <button
          type="button"
          onClick={handleApply}
          className="focus-visible-ring"
          style={{
            padding: '5px 10px',
            fontSize: 12,
            background: 'var(--p-surface)',
            border: '1px solid var(--p-border-strong)',
            borderRadius: 6,
            color: 'var(--p-text)',
            cursor: 'pointer',
          }}
        >
          Apply easing
        </button>
      </div>
    </div>
  );
}
