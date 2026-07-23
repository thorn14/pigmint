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
  'custom',
] as const;

export type EasingFamily = (typeof EASING_FAMILIES)[number];

export const EASING_VARIANTS = ['in', 'out', 'inOut'] as const;

export type EasingVariant = (typeof EASING_VARIANTS)[number];

export type EasingFn = (t: number) => number;

/**
 * Continuous custom-curve bias in [-1, 1]:
 * 0 = linear; positive = S-bend (pack toward ends); negative = inverted S (pack toward middle).
 */
export const CUSTOM_CURVE_BIAS_MIN = -1;
export const CUSTOM_CURVE_BIAS_MAX = 1;

export type ResolveEasingOptions = {
  /** Used when `family === 'custom'`. Clamped to [-1, 1]. */
  curveBias?: number;
  /**
   * Blend strength for named (non-custom) easings in [0, 1].
   * 0 = linear, 1 = full selected curve. Ignored for `custom` / `linear`.
   */
  amount?: number;
};

function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

const linear: EasingFn = (t) => clamp01(t);

function makeInOut(easeIn: EasingFn): EasingFn {
  return (t) => {
    const x = clamp01(t);
    return x < 0.5 ? easeIn(x * 2) / 2 : 1 - easeIn((1 - x) * 2) / 2;
  };
}

/** Ease-out then ease-in — inverted S that packs values toward the middle. */
function makeOutIn(easeIn: EasingFn): EasingFn {
  return (t) => {
    const x = clamp01(t);
    return x < 0.5
      ? (1 - easeIn(1 - x * 2)) / 2
      : 0.5 + easeIn((x - 0.5) * 2) / 2;
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

/**
 * Continuous S-bend curve for custom easing.
 * bias 0 → identity; positive → ease-in-out S (pack ends);
 * negative → inverted S (pack middle). Strength grows with |bias|.
 */
export function sBendEasing(curveBias = 0): EasingFn {
  const bias = clamp(curveBias, CUSTOM_CURVE_BIAS_MIN, CUSTOM_CURVE_BIAS_MAX);
  if (bias === 0) return linear;
  // |bias| 0→1 maps exp 1→4 so max strength is a clear quartic S.
  const exp = Math.pow(2, Math.abs(bias) * 2);
  const easeIn: EasingFn = (t) => Math.pow(clamp01(t), exp);
  return bias > 0 ? makeInOut(easeIn) : makeOutIn(easeIn);
}

/** Mix linear with `ease` by `amount` ∈ [0, 1]. */
export function blendEasing(ease: EasingFn, amount: number): EasingFn {
  const a = clamp(amount, 0, 1);
  if (a <= 0) return linear;
  if (a >= 1) return ease;
  return (t) => {
    const x = clamp01(t);
    return x + a * (ease(x) - x);
  };
}

function familyFns(family: EasingFamily): FamilyFns {
  switch (family) {
    case 'linear':
      return linear;
    case 'custom':
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
  options: ResolveEasingOptions = {},
): EasingFn {
  if (family === 'custom') {
    return sBendEasing(options.curveBias ?? 0);
  }
  const fns = familyFns(family);
  const base = typeof fns === 'function' ? fns : (fns[variant] ?? fns.inOut);
  if (family === 'linear') return base;
  const amount = options.amount;
  if (amount === undefined || amount >= 1) return base;
  return blendEasing(base, amount ?? 1);
}

export function easingFamilyHasVariants(family: EasingFamily): boolean {
  return family !== 'linear' && family !== 'custom';
}
