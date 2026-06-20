import { useEffect, useMemo, useRef, useState } from 'react';
import { usePaletteStore } from '../../store/paletteStore';
import { useIntentStore, useEffectiveMode } from '../../store/intentStore';
import { useVocabStore } from '../../store/vocabStore';
import { generateRamp } from '../../lib/colorMath';
import { buildScaleLinearGradientCss } from '../../lib/curveInterpolation';
import { runResolve } from '../../lib/resolveState';
import { IntentMarkers } from '../curves/IntentMarkers';
import type { ColorScale, GeneratedRamp } from '../../types/palette';
import type { ResolvedToken } from '@pigmint/core';

const PAD = 18;
const ROW_HEIGHT = 220;

type RowTokenData =
  | { status: 'skipped' }
  | { status: 'ok'; tokens: ResolvedToken[] }
  | { status: 'error'; error: string };

interface ScaleGradientRowProps {
  scale: ColorScale;
  ramp: GeneratedRamp;
  tokenData: RowTokenData;
}

function ScaleGradientRow({ scale, ramp, tokenData }: ScaleGradientRowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: ROW_HEIGHT });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const srgbGradient = useMemo(() => buildScaleLinearGradientCss(scale, { gamut: 'srgb' }), [scale]);
  const p3Gradient = useMemo(() => buildScaleLinearGradientCss(scale, { gamut: 'p3' }), [scale]);
  const n = ramp.steps.length;

  const tokens = tokenData.status === 'ok' ? tokenData.tokens : [];
  const resolveError = tokenData.status === 'error' ? tokenData.error : undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', borderBottom: '1px solid var(--p-border)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 32,
          padding: '0 12px',
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--p-text)',
          background: 'var(--p-surface))',
          borderBottom: '1px solid var(--p-border)',
        }}
      >
        {scale.name}
      </div>

      <div className="flex shrink-0 border-b" style={{ height: 28, borderColor: 'var(--p-border)' }}>
        {ramp.steps.map((step) => {
          const gamutLabel = step.gamut === 'p3' ? { text: 'P3', color: '#7c3aed' } : null;
          return (
            <div
              key={step.name}
              className="flex-1 flex items-center justify-center border-r last:border-r-0 gap-1"
              style={{ borderColor: 'var(--p-border)' }}
            >
              <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--p-text-secondary)' }}>
                {step.name}
              </span>
              {gamutLabel && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    lineHeight: 1,
                    padding: '1px 4px',
                    borderRadius: 3,
                    backgroundColor: gamutLabel.color,
                    color: '#fff',
                  }}
                >
                  {gamutLabel.text}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div
        ref={containerRef}
        style={{
          position: 'relative',
          height: ROW_HEIGHT,
          background: srgbGradient,
        }}
        aria-label={`${scale.name} continuous gradient with tokens`}
      >
        <div
          className="pigmint-p3-layer"
          style={{ position: 'absolute', inset: 0, background: p3Gradient }}
          aria-hidden
        />
        <svg
          className="absolute inset-0 w-full h-full"
          style={{ pointerEvents: 'none', overflow: 'visible' }}
        >
          <IntentMarkers
            tokens={tokens}
            resolveError={resolveError}
            ramp={ramp}
            n={n}
            width={size.width}
            height={size.height}
            pad={PAD}
          />
        </svg>
      </div>
    </div>
  );
}

export function TokensGradientView() {
  const scales = usePaletteStore((s) => s.scales);
  const engineModes = useIntentStore((s) => s.engineModes);
  const engineTarget = useIntentStore((s) => s.engineTarget);
  const engineCompliance = useIntentStore((s) => s.engineCompliance);
  const engineResolver = useIntentStore((s) => s.engineResolver);
  const vocabEntries = useVocabStore((s) => s.entries);
  const vocabRaw = useVocabStore((s) => s.raw);
  const vocabSurfacePaths = useVocabStore((s) => s.surfacePaths);
  const vocabSurfaceSteps = useVocabStore((s) => s.surfaceSteps);
  const vocabSemanticSteps = useVocabStore((s) => s.semanticSteps);
  const activeMarkerMode = useEffectiveMode();

  const vocabCtxForMarkers = useMemo(() => {
    if (!vocabEntries) return null;
    return {
      vocabulary: vocabEntries,
      tokenRamp: vocabRaw
        ? Object.fromEntries(
            Object.entries({ ...vocabRaw.surfaces, ...vocabRaw.foreground, ...vocabRaw.nonText, ...(vocabRaw.decorative ?? {}) })
              .map(([n, e]) => [n, (e as { ramp: string }).ramp])
          )
        : {},
      surfacePaths: vocabSurfacePaths ?? undefined,
      surfaceSteps: vocabSurfaceSteps ?? undefined,
      semanticSteps: vocabSemanticSteps ?? undefined,
    };
  }, [vocabEntries, vocabRaw, vocabSurfacePaths, vocabSurfaceSteps, vocabSemanticSteps]);

  const ramps = useMemo(() => {
    const map = new Map<string, GeneratedRamp>();
    for (const scale of scales) {
      try {
        map.set(scale.name, generateRamp(scale));
      } catch (e) {
        console.warn(`[TokensGradientView] generateRamp failed for "${scale.name}":`, e);
      }
    }
    return map;
  }, [scales]);

  const resolveResult = useMemo(() => {
    return runResolve(
      scales,
      engineModes,
      engineTarget,
      engineCompliance,
      vocabCtxForMarkers,
      engineResolver,
    );
  }, [scales, engineModes, engineTarget, engineCompliance, vocabCtxForMarkers, engineResolver]);

  if (scales.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          color: 'var(--p-text-secondary)',
        }}
      >
        Add ramps in the Primitives tab to see tokens over their gradients.
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      {scales.map((scale) => {
        const ramp = ramps.get(scale.name);
        if (!ramp) return null;
        const tokenData: RowTokenData = resolveResult.ok
          ? {
              status: 'ok',
              tokens: resolveResult.tokens.filter(
                (t) => t.source.ramp === scale.name && t.mode === activeMarkerMode,
              ),
            }
          : { status: 'error', error: resolveResult.error };
        return (
          <ScaleGradientRow
            key={scale.id}
            scale={scale}
            ramp={ramp}
            tokenData={tokenData}
          />
        );
      })}
    </div>
  );
}
