import type { VocabularyEntry } from '../types/spec.js';

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
    const isSurface = entry.path.startsWith('color.surface.');
    const isForeground = entry.path.startsWith('color.foreground.');
    const isBorder = entry.path.startsWith('color.border.');
    map[entry.path] = isSurface || isForeground || isBorder ? neutral : accent;
  }
  return map;
}
