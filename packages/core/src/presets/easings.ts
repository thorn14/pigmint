/** Primer Prism–style easing families for redistributing lightness between endpoints. */

export const EASING_FAMILIES = [
  'linear',
  'quadratic',
  'cubic',
  'quartic',
  'quintic',
  'sine',
  'circular',
  'exponential',
] as const;

export type EasingFamily = (typeof EASING_FAMILIES)[number];

export const EASING_VARIANTS = ['in', 'out', 'inOut'] as const;

export type EasingVariant = (typeof EASING_VARIANTS)[number];

export type EasingFn = (t: number) => number;

function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

const linear: EasingFn = (t) => clamp01(t);

function makeInOut(easeIn: EasingFn): EasingFn {
  return (t) => {
    const x = clamp01(t);
    return x < 0.5 ? easeIn(x * 2) / 2 : 1 - easeIn((1 - x) * 2) / 2;
  };
}

function easeOutFromIn(easeIn: EasingFn): EasingFn {
  return (t) => 1 - easeIn(1 - clamp01(t));
}

const quadraticIn: EasingFn = (t) => {
  const x = clamp01(t);
  return x * x;
};

const cubicIn: EasingFn = (t) => {
  const x = clamp01(t);
  return x * x * x;
};

const quarticIn: EasingFn = (t) => {
  const x = clamp01(t);
  return x * x * x * x;
};

const quinticIn: EasingFn = (t) => {
  const x = clamp01(t);
  return x * x * x * x * x;
};

const sineIn: EasingFn = (t) => 1 - Math.cos((clamp01(t) * Math.PI) / 2);

const circularIn: EasingFn = (t) => {
  const x = clamp01(t);
  return 1 - Math.sqrt(1 - x * x);
};

const exponentialIn: EasingFn = (t) => {
  const x = clamp01(t);
  return x === 0 ? 0 : Math.pow(2, 10 * x - 10);
};

type FamilyFns = EasingFn | Record<EasingVariant, EasingFn>;

function familyFns(family: EasingFamily): FamilyFns {
  switch (family) {
    case 'linear':
      return linear;
    case 'quadratic':
      return {
        in: quadraticIn,
        out: easeOutFromIn(quadraticIn),
        inOut: makeInOut(quadraticIn),
      };
    case 'cubic':
      return {
        in: cubicIn,
        out: easeOutFromIn(cubicIn),
        inOut: makeInOut(cubicIn),
      };
    case 'quartic':
      return {
        in: quarticIn,
        out: easeOutFromIn(quarticIn),
        inOut: makeInOut(quarticIn),
      };
    case 'quintic':
      return {
        in: quinticIn,
        out: easeOutFromIn(quinticIn),
        inOut: makeInOut(quinticIn),
      };
    case 'sine':
      return {
        in: sineIn,
        out: easeOutFromIn(sineIn),
        inOut: makeInOut(sineIn),
      };
    case 'circular':
      return {
        in: circularIn,
        out: easeOutFromIn(circularIn),
        inOut: makeInOut(circularIn),
      };
    case 'exponential':
      return {
        in: exponentialIn,
        out: easeOutFromIn(exponentialIn),
        inOut: makeInOut(exponentialIn),
      };
  }
}

/** Resolve an easing function for a Primer-style base curve + variant. */
export function resolveEasingFunction(
  family: EasingFamily,
  variant: EasingVariant = 'inOut',
): EasingFn {
  const fns = familyFns(family);
  if (typeof fns === 'function') return fns;
  return fns[variant] ?? fns.inOut;
}

export function easingFamilyHasVariants(family: EasingFamily): boolean {
  return family !== 'linear';
}
