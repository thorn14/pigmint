import { DriverError } from './errors.js';
import type { FormalIntent } from '../types/spec.js';

/**
 * Spec/05: preference × consistency valid pairings. Call before resolution.
 */
export function assertValidFormalIntent(path: string, intent: FormalIntent): void {
  const { preference, consistency } = intent;
  if (preference === 'matched-to-set' && consistency !== 'matched-across-ramps') {
    throw new DriverError(
      `token ${path}: preference "matched-to-set" requires consistency "matched-across-ramps" (got ${consistency})`,
    );
  }
  if (preference === 'anchored' && consistency === 'matched-across-ramps') {
    throw new DriverError(
      `token ${path}: preference "anchored" is incompatible with "matched-across-ramps" (see spec/05 matrix)`,
    );
  }
  // midpoint/median/level-up are per-ramp step-pick strategies — they have no
  // synchronized-T interpretation, so matched-across-ramps is rejected. Use
  // matched-to-set if cross-ramp coordination is needed.
  if (
    (preference === 'midpoint' || preference === 'median' || preference === 'level-up' || preference === 'preferred-contrast') &&
    consistency === 'matched-across-ramps'
  ) {
    throw new DriverError(
      `token ${path}: preference "${preference}" cannot pair with "matched-across-ramps" — use "independent" or switch to "matched-to-set" for cross-ramp coordination`,
    );
  }
  if (preference === 'preferred-contrast') {
    const t = intent.constraints?.targetContrast;
    if (typeof t !== 'number' || !Number.isFinite(t)) {
      throw new DriverError(
        `token ${path}: preference "preferred-contrast" requires constraints.targetContrast (finite number)`,
      );
    }
  }
  if (consistency === 'anchored-to-reference' && !intent.constraints?.referenceRamp) {
    throw new DriverError(
      `token ${path}: consistency "anchored-to-reference" requires constraints.referenceRamp (ramp name)`,
    );
  }
  if (preference === 'matched-to-set' && consistency === 'anchored-to-reference') {
    throw new DriverError(
      `token ${path}: "matched-to-set" cannot pair with "anchored-to-reference" (spec/05)`,
    );
  }
  if (preference === 'anchored' && consistency === 'independent') {
    if (typeof intent.constraints?.anchor !== 'number' || !Number.isFinite(intent.constraints.anchor)) {
      throw new DriverError(
        `token ${path}: preference "anchored" with independent consistency requires constraints.anchor (number, WCAG ratio)`,
      );
    }
  }
}
