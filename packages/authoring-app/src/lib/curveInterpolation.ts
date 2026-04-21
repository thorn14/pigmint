// Linear interpolation
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Clamp value between min and max
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Normalize a value from [inMin, inMax] to [outMin, outMax]
export function remap(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  const t = (value - inMin) / (inMax - inMin);
  return lerp(outMin, outMax, clamp(t, 0, 1));
}

// Generate evenly spaced values between start and end (inclusive), count points
export function linspace(start: number, end: number, count: number): number[] {
  if (count <= 1) return [start];
  return Array.from({ length: count }, (_, i) => lerp(start, end, i / (count - 1)));
}

/**
 * Builds an SVG path `d` attribute string for a curve through the given points.
 * Smooth nodes use cubic bezier tangents derived from the monotone spline;
 * corner nodes use independent incoming/outgoing tangents (segment chord slopes)
 * so the curve forms a genuine sharp angle at that point.
 *
 * @param points   Screen-space {x, y} positions for each control point
 * @param nodeTypes Per-point type: 'smooth' uses spline tangents, 'corner' creates sharp break
 * @returns SVG `d` string starting with M, using C (cubic bezier) commands
 */
export function buildCurvePath(
  points: { x: number; y: number }[],
  nodeTypes: ('smooth' | 'corner')[],
): string {
  const n = points.length;
  if (n === 0) return '';
  if (n === 1) return `M ${points[0].x},${points[0].y}`;

  // Compute monotone cubic tangents in Y (X spacing is uniform)
  const ys = points.map((p) => p.y);
  const xs = points.map((p) => p.x);

  // Slopes between consecutive points
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = xs[i + 1] - xs[i];
    d.push(dx === 0 ? 0 : (ys[i + 1] - ys[i]) / dx);
  }

  // Initial tangents (average of neighboring slopes)
  const m: number[] = new Array(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    m[i] = (d[i - 1] + d[i]) / 2;
  }

  // Fritsch–Carlson monotonicity constraints.
  // Treat corner nodes as hard boundaries: their effective tangents are
  // replaced later with segment chord slopes, so they must not participate
  // in scaling decisions for neighboring smooth tangents.
  for (let i = 0; i < n - 1; i++) {
    const leftType = nodeTypes[i] ?? 'smooth';
    const rightType = nodeTypes[i + 1] ?? 'smooth';
    if (leftType === 'corner' || rightType === 'corner') continue;

    if (Math.abs(d[i]) < 1e-10) {
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      const alpha = m[i] / d[i];
      const beta = m[i + 1] / d[i];
      const r = alpha * alpha + beta * beta;
      if (r > 9) {
        const t = 3 / Math.sqrt(r);
        m[i] = t * alpha * d[i];
        m[i + 1] = t * beta * d[i];
      }
    }
  }

  // Split tangents: mIn (arrival) and mOut (departure) per node.
  // Smooth nodes share a single tangent (C1); corner nodes use the
  // chord slope of the adjacent segment for a genuine sharp break.
  const mIn: number[] = new Array(n);
  const mOut: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    if ((nodeTypes[i] ?? 'smooth') === 'corner') {
      mIn[i] = i > 0 ? d[i - 1] : d[0];
      mOut[i] = i < n - 1 ? d[i] : d[n - 2];
    } else {
      mIn[i] = m[i];
      mOut[i] = m[i];
    }
  }

  // Build path using cubic bezier commands
  let path = `M ${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = (xs[i + 1] - xs[i]) / 3;
    const cp1x = xs[i] + h;
    const cp1y = ys[i] + mOut[i] * h;
    const cp2x = xs[i + 1] - h;
    const cp2y = ys[i + 1] - mIn[i + 1] * h;
    path += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${points[i + 1].x.toFixed(2)},${points[i + 1].y.toFixed(2)}`;
  }
  return path;
}

// Monotone cubic spline interpolation for smooth curve preview
// Returns a function that interpolates the given points
export function buildMonotoneCubicInterpolant(xs: number[], ys: number[]): (x: number) => number {
  const n = xs.length;
  if (n < 2) return () => ys[0] ?? 0;

  // Compute slopes
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  }

  // Tangents
  const m: number[] = new Array(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    m[i] = (d[i - 1] + d[i]) / 2;
  }

  // Monotonicity constraints (Fritsch–Carlson)
  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(d[i]) < 1e-10) {
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      const alpha = m[i] / d[i];
      const beta = m[i + 1] / d[i];
      const r = alpha * alpha + beta * beta;
      if (r > 9) {
        const t = 3 / Math.sqrt(r);
        m[i] = t * alpha * d[i];
        m[i + 1] = t * beta * d[i];
      }
    }
  }

  return (x: number): number => {
    // Binary search for segment
    let lo = 0, hi = n - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (xs[mid] <= x) lo = mid; else hi = mid;
    }
    const h = xs[hi] - xs[lo];
    const t = h === 0 ? 0 : (x - xs[lo]) / h;
    const t2 = t * t, t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[lo] +
      (t3 - 2 * t2 + t) * h * m[lo] +
      (-2 * t3 + 3 * t2) * ys[hi] +
      (t3 - t2) * h * m[hi]
    );
  };
}
