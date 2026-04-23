import type { VocabularyEntry } from '../types/spec.js';

function firstNamed(rampNames: string[], ...candidates: string[]): string | undefined {
  for (const c of candidates) {
    const hit = rampNames.find((n) => n === c);
    if (hit) return hit;
  }
  return undefined;
}

export function buildDefaultTokenRamp(
  vocabulary: VocabularyEntry[],
  rampNames: string[],
): Record<string, string> {
  const neutral = rampNames.find((n) => n === 'neutral') ?? rampNames[0];
  const accent = rampNames.find((n) => n !== 'neutral') ?? neutral;
  if (!neutral || !accent) return {};
  const map: Record<string, string> = {};
  for (const entry of vocabulary) {
    if (entry.usage === 'decorative') continue;
    const path = entry.path;
    if (path.startsWith('color.action.secondary.')) {
      map[path] = firstNamed(rampNames, 'slate', 'secondary', 'violet', 'mauve') ?? neutral;
      continue;
    }
    if (path.startsWith('color.feedback.success.')) {
      map[path] = firstNamed(rampNames, 'success', 'emerald', 'green') ?? accent;
      continue;
    }
    if (path.startsWith('color.feedback.danger.')) {
      map[path] = firstNamed(rampNames, 'danger', 'red', 'crimson') ?? accent;
      continue;
    }
    if (path.startsWith('color.feedback.warning.')) {
      map[path] = firstNamed(rampNames, 'warning', 'amber', 'orange') ?? accent;
      continue;
    }
    if (path.startsWith('color.feedback.info.')) {
      map[path] =
        firstNamed(rampNames, 'info', 'sky', 'cyan') ?? firstNamed(rampNames, 'blue') ?? accent;
      continue;
    }
    const isSurface = path.startsWith('color.surface.');
    const isForeground = path.startsWith('color.foreground.');
    const isBorder = path.startsWith('color.border.');
    map[path] = isSurface || isForeground || isBorder ? neutral : accent;
  }
  return map;
}
