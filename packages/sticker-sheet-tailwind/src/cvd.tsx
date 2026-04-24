import type { ReactElement } from 'react';

export type CvdProfile =
  | 'deuteranopia'
  | 'protanopia'
  | 'tritanopia'
  | 'achromatopsia';

// Machado 2009 simulation matrices at severity 1.0 (see https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html).
// Row-major 3×3 applied to linear-sRGB; feColorMatrix takes 4×5 so we pad.
const MATRICES_3X3: Record<Exclude<CvdProfile, 'achromatopsia'>, number[]> = {
  deuteranopia: [
    0.367322, 0.860646, -0.227968,
    0.280085, 0.672501, 0.047413,
    -0.011820, 0.042940, 0.968881,
  ],
  protanopia: [
    0.152286, 1.052583, -0.204868,
    0.114503, 0.786281, 0.099216,
    -0.003882, -0.048116, 1.051998,
  ],
  tritanopia: [
    1.255528, -0.076749, -0.178779,
    -0.078411, 0.930809, 0.147602,
    0.004733, 0.691367, 0.303900,
  ],
};

// BT.709 luma weights — achromatopsia is a full desaturation to grey.
const ACHROMATOPSIA_3X3 = [
  0.2126, 0.7152, 0.0722,
  0.2126, 0.7152, 0.0722,
  0.2126, 0.7152, 0.0722,
];

function to4x5(mat3: number[]): number[] {
  const [a, b, c, d, e, f, g, h, i] = mat3;
  return [
    a ?? 1, b ?? 0, c ?? 0, 0, 0,
    d ?? 0, e ?? 1, f ?? 0, 0, 0,
    g ?? 0, h ?? 0, i ?? 1, 0, 0,
    0, 0, 0, 1, 0,
  ];
}

export const CVD_PROFILE_LABELS: Record<CvdProfile, string> = {
  deuteranopia: 'Deuteranopia',
  protanopia: 'Protanopia',
  tritanopia: 'Tritanopia',
  achromatopsia: 'Achromatopsia',
};

export function cvdFilterId(profile: CvdProfile): string {
  return `pigmint-cvd-${profile}`;
}

export function CvdFilterDefs({
  profiles,
}: {
  profiles: CvdProfile[];
}): ReactElement | null {
  if (profiles.length === 0) return null;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="0"
      height="0"
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
    >
      <defs>
        {profiles.map((profile) => {
          const matrix =
            profile === 'achromatopsia'
              ? to4x5(ACHROMATOPSIA_3X3)
              : to4x5(MATRICES_3X3[profile]);
          return (
            <filter
              key={profile}
              id={cvdFilterId(profile)}
              x="0%"
              y="0%"
              width="100%"
              height="100%"
              colorInterpolationFilters="sRGB"
            >
              <feColorMatrix type="matrix" values={matrix.join(' ')} />
            </filter>
          );
        })}
      </defs>
    </svg>
  );
}
