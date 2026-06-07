interface ColorWheelIconProps {
  size?: number;
}

export function ColorWheelIcon({ size = 22 }: ColorWheelIconProps) {
  const r = size / 2;
  const cx = r;
  const cy = r;
  const outer = r - 1;
  const inner = outer * 0.45;

  const slices = [
    { from: 0, to: 60, fill: '#ef4444' },
    { from: 60, to: 120, fill: '#f59e0b' },
    { from: 120, to: 180, fill: '#22c55e' },
    { from: 180, to: 240, fill: '#06b6d4' },
    { from: 240, to: 300, fill: '#6366f1' },
    { from: 300, to: 360, fill: '#ec4899' },
  ];

  function polar(angle: number, radius: number) {
    const rad = (angle - 90) * (Math.PI / 180);
    return [cx + radius * Math.cos(rad), cy + radius * Math.sin(rad)] as const;
  }

  function slicePath(from: number, to: number) {
    const [x1, y1] = polar(from, outer);
    const [x2, y2] = polar(to, outer);
    const [x3, y3] = polar(to, inner);
    const [x4, y4] = polar(from, inner);
    const large = to - from > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${outer} ${outer} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${inner} ${inner} 0 ${large} 0 ${x4} ${y4} Z`;
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" style={{ display: 'block' }}>
      {slices.map((s) => (
        <path key={s.from} d={slicePath(s.from, s.to)} fill={s.fill} />
      ))}
      <circle cx={cx} cy={cy} r={inner - 0.5} fill="var(--p-bg)" />
    </svg>
  );
}
