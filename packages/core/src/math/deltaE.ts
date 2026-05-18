import type { OklchColor } from '../types/palette.js';

function oklchToOklab(color: OklchColor): { L: number; a: number; b: number } {
  const hRad = (color.h * Math.PI) / 180;
  return {
    L: color.l,
    a: color.c * Math.cos(hRad),
    b: color.c * Math.sin(hRad),
  };
}

export function deltaEOklch(a: OklchColor, b: OklchColor): number {
  const A = oklchToOklab(a);
  const B = oklchToOklab(b);
  const dL = A.L - B.L;
  const da = A.a - B.a;
  const db = A.b - B.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}
