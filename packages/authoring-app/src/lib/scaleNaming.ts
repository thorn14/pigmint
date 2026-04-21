/** Canonical identity for palette scale names (trimmed; whitespace-only → "Color"). */
export function canonicalScaleName(name: string): string {
  return name.trim() || 'Color';
}

/** Pick the first key `base`, `base 2`, `base 3`, … not present in `used`. */
export function disambiguateKey(base: string, used: ReadonlySet<string>): string {
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}
