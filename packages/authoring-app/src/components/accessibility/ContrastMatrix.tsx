import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { GeneratedRamp } from '../../types/palette';
import { useContrastMatrix, useApcaContrastMatrix } from '../../hooks/useContrastMatrix';
import { ContrastBadge } from './ContrastBadge';
import { ApcaBadge } from './ApcaBadge';
import { usePaletteStore } from '../../store/paletteStore';

interface Props {
  ramp: GeneratedRamp;
}

export function ContrastMatrix({ ramp }: Props) {
  const contrastMode = usePaletteStore((s) => s.contrastMode);
  if (contrastMode === 'apca') return <ApcaContrastMatrixGrid ramp={ramp} />;
  return <WcagContrastMatrixGrid ramp={ramp} />;
}

function WcagContrastMatrixGrid({ ramp }: Props) {
  const matrix = useContrastMatrix(ramp);
  const stepNames = ramp.steps.map((s) => s.name);
  const rowCount = ramp.steps.length;
  const colCount = stepNames.length + 1;
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 5,
  });

  return (
    <div ref={parentRef} className="overflow-auto" style={{ maxHeight: 480 }}>
      <div
        role="grid"
        aria-label="Contrast matrix"
        className="text-xs"
        style={{ display: 'grid', gridTemplateColumns: `2.5rem repeat(${stepNames.length}, 3rem)` }}
      >
        <div role="row" className="contents">
          <div role="columnheader" className="h-8 sticky top-0 z-10" style={{ background: 'var(--p-bg)' }} />
          {stepNames.map((name) => (
            <div key={name} role="columnheader" className="h-8 flex items-center justify-center font-medium px-1 sticky top-0 z-10" style={{ background: 'var(--p-bg)', color: 'var(--p-text-secondary)' }}>
              {name}
            </div>
          ))}
        </div>

        <div
          style={{
            height: rowVirtualizer.getTotalSize(),
            position: 'relative',
            gridColumn: `1 / ${colCount + 1}`,
          }}
        >
          {rowVirtualizer.getVirtualItems().map((vRow) => {
            const ri = vRow.index;
            return (
              <div
                key={ri}
                role="row"
                style={{
                  position: 'absolute',
                  top: vRow.start,
                  left: 0,
                  right: 0,
                  height: vRow.size,
                  display: 'grid',
                  gridTemplateColumns: `2.5rem repeat(${stepNames.length}, 3rem)`,
                  alignItems: 'center',
                }}
              >
                <div role="rowheader" className="text-neutral-400 font-medium pr-2 text-right">{stepNames[ri]}</div>
                {matrix[ri].map((cell, ci) => (
                  <div key={ci} role="gridcell" className="p-0.5 text-center">
                    {ri === ci ? <span className="text-neutral-700">—</span> : <ContrastBadge level={cell.result.level} ratio={cell.result.ratio} showRatio />}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ApcaContrastMatrixGrid({ ramp }: Props) {
  const matrix = useApcaContrastMatrix(ramp);
  const stepNames = ramp.steps.map((s) => s.name);
  const rowCount = ramp.steps.length;
  const colCount = stepNames.length + 1;
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 5,
  });

  return (
    <div ref={parentRef} className="overflow-auto" style={{ maxHeight: 480 }}>
      <div
        role="grid"
        aria-label="Contrast matrix"
        className="text-xs"
        style={{ display: 'grid', gridTemplateColumns: `2.5rem repeat(${stepNames.length}, 3rem)` }}
      >
        <div role="row" className="contents">
          <div role="columnheader" className="h-8 sticky top-0 z-10" style={{ background: 'var(--p-bg)' }} />
          {stepNames.map((name) => (
            <div key={name} role="columnheader" className="h-8 flex items-center justify-center font-medium px-1 sticky top-0 z-10" style={{ background: 'var(--p-bg)', color: 'var(--p-text-secondary)' }}>
              {name}
            </div>
          ))}
        </div>

        <div
          style={{
            height: rowVirtualizer.getTotalSize(),
            position: 'relative',
            gridColumn: `1 / ${colCount + 1}`,
          }}
        >
          {rowVirtualizer.getVirtualItems().map((vRow) => {
            const ri = vRow.index;
            return (
              <div
                key={ri}
                role="row"
                style={{
                  position: 'absolute',
                  top: vRow.start,
                  left: 0,
                  right: 0,
                  height: vRow.size,
                  display: 'grid',
                  gridTemplateColumns: `2.5rem repeat(${stepNames.length}, 3rem)`,
                  alignItems: 'center',
                }}
              >
                <div role="rowheader" className="text-neutral-400 font-medium pr-2 text-right">{stepNames[ri]}</div>
                {matrix[ri].map((cell, ci) => (
                  <div key={ci} role="gridcell" className="p-0.5 text-center">
                    {ri === ci ? <span className="text-neutral-700">—</span> : <ApcaBadge lc={cell.lc} showValue />}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
