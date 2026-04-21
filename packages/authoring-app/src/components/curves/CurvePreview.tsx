interface Props {
  values: number[];
  min: number;
  max: number;
  width?: number;
  height?: number;
  color?: string;
}

export function CurvePreview({ values, min, max, width = 120, height = 40, color = 'var(--p-text-secondary)' }: Props) {
  if (values.length < 2) return null;

  const range = max - min || 1;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible" role="img" aria-label="Curve preview">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {values.map((v, i) => {
        const x = (i / (values.length - 1)) * width;
        const y = height - ((v - min) / range) * height;
        return <circle key={i} cx={x} cy={y} r="2" fill={color} />;
      })}
    </svg>
  );
}
