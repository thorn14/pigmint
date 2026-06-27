import type { CvdProfile } from '@pigmint/core';

/**
 * Color-vision-deficiency simulation via SVG `feColorMatrix`. These are the
 * widely-used static sRGB simulation matrices (per-profile 5×4 RGBA matrices);
 * they approximate how a swatch reads to someone with each deficiency, giving
 * designers real visual feedback without touching the resolver.
 */
const CVD_MATRICES: Record<CvdProfile, string> = {
  protanopia: [
    0.567, 0.433, 0, 0, 0,
    0.558, 0.442, 0, 0, 0,
    0, 0.242, 0.758, 0, 0,
    0, 0, 0, 1, 0,
  ].join(' '),
  deuteranopia: [
    0.625, 0.375, 0, 0, 0,
    0.7, 0.3, 0, 0, 0,
    0, 0.3, 0.7, 0, 0,
    0, 0, 0, 1, 0,
  ].join(' '),
  tritanopia: [
    0.95, 0.05, 0, 0, 0,
    0, 0.433, 0.567, 0, 0,
    0, 0.475, 0.525, 0, 0,
    0, 0, 0, 1, 0,
  ].join(' '),
  achromatopsia: [
    0.299, 0.587, 0.114, 0, 0,
    0.299, 0.587, 0.114, 0, 0,
    0.299, 0.587, 0.114, 0, 0,
    0, 0, 0, 1, 0,
  ].join(' '),
};

export const CVD_PROFILE_LABELS: Record<CvdProfile, string> = {
  protanopia: 'Protanopia',
  deuteranopia: 'Deuteranopia',
  tritanopia: 'Tritanopia',
  achromatopsia: 'Achromatopsia',
};

const filterId = (profile: CvdProfile) => `pigmint-cvd-${profile}`;

/**
 * Hidden SVG holding one filter per CVD profile. Render once near the preview;
 * elements reference a filter by `url(#pigmint-cvd-<profile>)`.
 */
export function CvdFilterDefs() {
  return (
    <svg aria-hidden="true" focusable="false" style={{ position: 'absolute', width: 0, height: 0 }}>
      <defs>
        {(Object.keys(CVD_MATRICES) as CvdProfile[]).map((profile) => (
          <filter key={profile} id={filterId(profile)} colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values={CVD_MATRICES[profile]} />
          </filter>
        ))}
      </defs>
    </svg>
  );
}

/**
 * CSS `filter` value for the first active CVD profile, or undefined when none
 * are active. (Stacking multiple deficiencies isn't physically meaningful, so
 * we apply one at a time.)
 */
export function cvdFilterCss(active: readonly CvdProfile[]): string | undefined {
  const first = active[0];
  return first ? `url(#${filterId(first)})` : undefined;
}
