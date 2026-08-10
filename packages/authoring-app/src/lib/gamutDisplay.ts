/**
 * Whether this display pipeline can render `color(display-p3 …)` at all.
 *
 * Evaluated once at module load, so it won't notice a window moving between a
 * wide-gamut and an sRGB display. That is acceptable because every step also
 * carries an sRGB hex: on a display that can't show P3 we fall back to that hex,
 * which is the same color the browser would have clipped to anyway.
 */
export const supportsP3 =
  typeof CSS !== 'undefined' && CSS.supports('color', 'color(display-p3 0 0 0)');

/** Background color for a step: its P3 rendering when available, else the safe hex. */
export function stepDisplayColor(step: { hex: string; displayP3?: string }): string {
  return (supportsP3 && step.displayP3) || step.hex;
}
