import { writeFile, access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import * as p from '@clack/prompts';
import { tryParseHex } from '@pigmint/core';

export interface RampDef {
  name: string;
  sourceHex: string;
}

export interface AdapterDef {
  name: string;
  preset?: string;
}

export interface ScaffoldOptions {
  ramps: RampDef[];
  modes: string[];
  compliance: 'wcag21' | 'apca';
  target: 'AA' | 'AAA';
  resolver?: 'stepped' | 'continuous';
  fallbackSteps?: number;
  cvd?: string[];
  adapters?: AdapterDef[];
  out: string;
  force?: boolean;
}

const NEUTRAL_NAMES = new Set([
  'neutral', 'gray', 'grey', 'slate', 'stone', 'zinc',
  'sand', 'mauve', 'olive', 'sage', 'fog', 'mist', 'smoke',
]);

function findNeutralRamp(ramps: RampDef[]): RampDef {
  const byName = ramps.find((r) => NEUTRAL_NAMES.has(r.name.toLowerCase()));
  return byName ?? ramps[ramps.length - 1] ?? ramps[0]!;
}

function findBrandRamp(ramps: RampDef[], neutralRamp: RampDef): RampDef {
  return ramps.find((r) => r !== neutralRamp) ?? neutralRamp;
}

function hasDarkMode(modes: string[]): boolean {
  return modes.some((m) => m === 'dark' || m.endsWith('-dark') || m.startsWith('dark'));
}

function buildConfigYaml(opts: ScaffoldOptions): string {
  const lines: string[] = [];

  lines.push('engine:');
  lines.push(`  compliance: ${opts.compliance}`);
  lines.push(`  target: ${opts.target}`);
  lines.push('  modes:');
  for (const mode of opts.modes) {
    lines.push(`    - ${mode}`);
  }

  if (opts.resolver && opts.resolver !== 'stepped') {
    lines.push('  resolver:');
    lines.push(`    mode: ${opts.resolver}`);
    if (opts.fallbackSteps !== undefined) {
      lines.push(`    fallbackSteps: ${opts.fallbackSteps}`);
    }
  }

  if (opts.cvd && opts.cvd.length > 0) {
    lines.push('  cvd:');
    for (const profile of opts.cvd) {
      lines.push(`    - ${profile}`);
    }
  }

  lines.push('');
  lines.push('defaults:');
  lines.push('  vocabulary: ./tokens.yaml');

  lines.push('');
  lines.push('ramps:');
  for (const ramp of opts.ramps) {
    lines.push(`  - name: ${ramp.name}`);
    lines.push(`    source: "${ramp.sourceHex}"`);
  }

  lines.push('');
  lines.push('output:');
  lines.push('  primitives: ./primitives.json');
  lines.push('  dtcg: ./tokens.json');

  if (opts.adapters && opts.adapters.length > 0) {
    lines.push('');
    lines.push('adapters:');
    for (const adapter of opts.adapters) {
      lines.push(`  - name: ${adapter.name}`);
      lines.push(`    output: ./dist/${adapter.name}`);
      if (adapter.preset) {
        lines.push(`    preset: ${adapter.preset}`);
      }
    }
  }

  return lines.join('\n') + '\n';
}

function buildVocabularyYaml(opts: ScaffoldOptions): string {
  const { ramps, modes } = opts;
  const neutral = findNeutralRamp(ramps);
  const brand = findBrandRamp(ramps, neutral);
  const dark = hasDarkMode(modes);

  const surfaceStep = (light: number, darkStep: number): string =>
    dark
      ? `\n    lightStep: ${light}\n    darkStep: ${darkStep}`
      : `\n    step: ${light}`;

  const lines: string[] = [];

  lines.push('surfaces:');
  lines.push(`  surface.main:`);
  lines.push(`    ramp: ${neutral.name}${surfaceStep(0, 10)}`);
  lines.push(`  surface.elevated:`);
  lines.push(`    ramp: ${neutral.name}${surfaceStep(1, 9)}`);
  lines.push(`  surface.subtle:`);
  lines.push(`    ramp: ${neutral.name}${surfaceStep(2, 8)}`);
  lines.push(`  surface.inverse:`);
  lines.push(`    ramp: ${neutral.name}${surfaceStep(10, 0)}`);

  lines.push('');
  lines.push('foreground:');
  lines.push(`  foreground.main:`);
  lines.push(`    ramp: ${neutral.name}`);
  lines.push(`    surfaces: [surface.main]`);
  lines.push(`    preference: highest-contrast`);
  lines.push(`    level: AAA`);
  lines.push(`  foreground.muted:`);
  lines.push(`    ramp: ${neutral.name}`);
  lines.push(`    surfaces: [surface.main]`);
  lines.push(`    preference: matched-to-set`);
  lines.push(`    consistency: matched-across-ramps`);
  lines.push(`  foreground.subtle:`);
  lines.push(`    ramp: ${neutral.name}`);
  lines.push(`    surfaces: [surface.main]`);
  lines.push(`    preference: lowest-passing`);
  lines.push(`  foreground.inverse:`);
  lines.push(`    ramp: ${neutral.name}`);
  lines.push(`    surfaces: [surface.inverse]`);
  lines.push(`    preference: highest-contrast`);

  lines.push('');
  lines.push('nonText:');
  lines.push(`  action.primary.background:`);
  lines.push(`    ramp: ${brand.name}`);
  lines.push(`    surfaces: [surface.main]`);
  lines.push(`    preference: lowest-passing`);
  lines.push(`  action.primary.text:`);
  lines.push(`    ramp: ${neutral.name}`);
  lines.push(`    surfaces: [surface.main]`);
  lines.push(`    preference: highest-contrast`);
  lines.push(`  action.secondary.background:`);
  lines.push(`    ramp: ${neutral.name}`);
  lines.push(`    surfaces: [surface.main]`);
  lines.push(`    preference: lowest-passing`);
  lines.push(`  action.secondary.text:`);
  lines.push(`    ramp: ${neutral.name}`);
  lines.push(`    surfaces: [surface.main]`);
  lines.push(`    preference: highest-contrast`);
  lines.push(`  border.main:`);
  lines.push(`    ramp: ${neutral.name}`);
  lines.push(`    surfaces: [surface.main]`);
  lines.push(`    preference: lowest-passing`);
  lines.push(`  border.subtle:`);
  lines.push(`    ramp: ${neutral.name}`);
  lines.push(`    surfaces: [surface.main]`);
  lines.push(`    preference: lowest-passing`);
  lines.push(`  border.prominent:`);
  lines.push(`    ramp: ${neutral.name}`);
  lines.push(`    surfaces: [surface.main]`);
  lines.push(`    preference: highest-contrast`);
  lines.push(`  feedback.danger.background:`);
  lines.push(`    ramp: ${brand.name}`);
  lines.push(`    surfaces: [surface.main]`);
  lines.push(`    preference: lowest-passing`);
  lines.push(`  feedback.danger.text:`);
  lines.push(`    ramp: ${brand.name}`);
  lines.push(`    surfaces: [surface.main]`);
  lines.push(`    preference: lowest-passing`);
  lines.push(`  feedback.success.background:`);
  lines.push(`    ramp: ${neutral.name}`);
  lines.push(`    surfaces: [surface.main]`);
  lines.push(`    preference: lowest-passing`);
  lines.push(`  feedback.success.text:`);
  lines.push(`    ramp: ${neutral.name}`);
  lines.push(`    surfaces: [surface.main]`);
  lines.push(`    preference: lowest-passing`);
  lines.push(`  feedback.warning.background:`);
  lines.push(`    ramp: ${brand.name}`);
  lines.push(`    surfaces: [surface.main]`);
  lines.push(`    preference: lowest-passing`);
  lines.push(`  feedback.warning.text:`);
  lines.push(`    ramp: ${brand.name}`);
  lines.push(`    surfaces: [surface.main]`);
  lines.push(`    preference: lowest-passing`);
  lines.push(`  feedback.info.background:`);
  lines.push(`    ramp: ${brand.name}`);
  lines.push(`    surfaces: [surface.main]`);
  lines.push(`    preference: lowest-passing`);
  lines.push(`  feedback.info.text:`);
  lines.push(`    ramp: ${brand.name}`);
  lines.push(`    surfaces: [surface.main]`);
  lines.push(`    preference: lowest-passing`);
  lines.push(`  focus.ring:`);
  lines.push(`    ramp: ${brand.name}`);
  lines.push(`    surfaces: [surface.main]`);
  lines.push(`    preference: highest-contrast`);
  lines.push(`  focus.outline:`);
  lines.push(`    ramp: ${neutral.name}`);
  lines.push(`    surfaces: [surface.main]`);
  lines.push(`    preference: highest-contrast`);

  // Stubs for extra brand ramps beyond the first two
  const extraBrandRamps = ramps.filter((r) => r !== neutral && r !== brand);
  if (extraBrandRamps.length > 0) {
    lines.push('');
    lines.push('# Additional ramp stubs — assign these to tokens as needed:');
    for (const extra of extraBrandRamps) {
      lines.push(`#   ${extra.name}: <token-path>`);
      lines.push(`#     ramp: ${extra.name}`);
      lines.push(`#     surfaces: [surface.main]`);
      lines.push(`#     preference: lowest-passing`);
    }
  }

  return lines.join('\n') + '\n';
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function validateHex(raw: string): string | null {
  const hex = raw.trim();
  const normalized = hex.startsWith('#') ? hex : `#${hex}`;
  return tryParseHex(normalized) ? normalized : null;
}

async function scaffoldInteractive(): Promise<ScaffoldOptions | null> {
  p.intro('pigmint scaffold');

  const rampCountInput = await p.text({
    message: 'How many color ramps?',
    placeholder: '2',
    defaultValue: '2',
    validate(value) {
      const n = parseInt(value, 10);
      if (isNaN(n) || n < 1 || n > 20) return 'Enter a number between 1 and 20';
    },
  });
  if (p.isCancel(rampCountInput)) { p.cancel('Cancelled.'); return null; }
  const rampCount = parseInt(String(rampCountInput), 10);

  const ramps: RampDef[] = [];
  const defaultNames = ['brand', 'neutral', 'accent', 'secondary'];
  for (let i = 0; i < rampCount; i++) {
    const defaultName = defaultNames[i] ?? `ramp${i + 1}`;

    const nameInput = await p.text({
      message: `Ramp ${i + 1} name:`,
      placeholder: defaultName,
      defaultValue: defaultName,
      validate(value) {
        if (!value.trim()) return 'Name is required';
        if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(value.trim())) {
          return 'Name must start with a letter and contain only letters, numbers, hyphens, or underscores';
        }
      },
    });
    if (p.isCancel(nameInput)) { p.cancel('Cancelled.'); return null; }

    const hexInput = await p.text({
      message: `Ramp ${i + 1} (${String(nameInput)}) hex color:`,
      placeholder: '#000000',
      validate(value) {
        if (!validateHex(value)) return 'Enter a valid hex color (e.g. #2563eb or 2563eb)';
      },
    });
    if (p.isCancel(hexInput)) { p.cancel('Cancelled.'); return null; }

    ramps.push({ name: String(nameInput).trim(), sourceHex: validateHex(String(hexInput))! });
  }

  const modesInput = await p.multiselect<string>({
    message: 'Select display modes:',
    options: [
      { value: 'light', label: 'Light', hint: 'default' },
      { value: 'dark', label: 'Dark' },
      { value: 'light-high-contrast', label: 'Light high-contrast' },
      { value: 'dark-high-contrast', label: 'Dark high-contrast' },
    ],
    initialValues: ['light', 'dark'],
    required: true,
  });
  if (p.isCancel(modesInput)) { p.cancel('Cancelled.'); return null; }

  const complianceInput = await p.select<'wcag21' | 'apca'>({
    message: 'Compliance standard:',
    options: [
      { value: 'wcag21', label: 'WCAG 2.1', hint: 'recommended' },
      { value: 'apca', label: 'APCA' },
    ],
  });
  if (p.isCancel(complianceInput)) { p.cancel('Cancelled.'); return null; }
  const compliance = complianceInput as 'wcag21' | 'apca';

  let target: 'AA' | 'AAA' = 'AA';
  if (compliance === 'wcag21') {
    const targetInput = await p.select<'AA' | 'AAA'>({
      message: 'Compliance target:',
      options: [
        { value: 'AA', label: 'AA', hint: 'minimum standard' },
        { value: 'AAA', label: 'AAA', hint: 'enhanced' },
      ],
    });
    if (p.isCancel(targetInput)) { p.cancel('Cancelled.'); return null; }
    target = targetInput as 'AA' | 'AAA';
  }

  const resolverInput = await p.select<'stepped' | 'continuous'>({
    message: 'Resolver mode:',
    options: [
      { value: 'stepped', label: 'Stepped', hint: 'picks from named ramp steps (default)' },
      { value: 'continuous', label: 'Continuous', hint: 'interpolates between steps for tighter contrast fits' },
    ],
  });
  if (p.isCancel(resolverInput)) { p.cancel('Cancelled.'); return null; }
  const resolver = resolverInput as 'stepped' | 'continuous';

  const adapterInput = await p.multiselect<string>({
    message: 'Framework adapters (optional):',
    options: [
      { value: 'tailwind', label: 'Tailwind CSS' },
      { value: 'mui', label: 'Material UI (MUI)' },
    ],
    required: false,
  });
  if (p.isCancel(adapterInput)) { p.cancel('Cancelled.'); return null; }
  const selectedAdapters = adapterInput as string[];

  const adapters: AdapterDef[] = [];
  for (const adapterName of selectedAdapters) {
    if (adapterName === 'tailwind') {
      const presetInput = await p.select<string>({
        message: 'Tailwind preset:',
        options: [
          { value: 'generic', label: 'Generic', hint: 'dot-separated CSS variables' },
          { value: 'shadcn', label: 'shadcn/ui', hint: 'shadcn compatible variable names' },
        ],
      });
      if (p.isCancel(presetInput)) { p.cancel('Cancelled.'); return null; }
      adapters.push({ name: 'tailwind', preset: String(presetInput) });
    } else {
      adapters.push({ name: adapterName });
    }
  }

  const cvdInput = await p.multiselect<string>({
    message: 'CVD simulation profiles (optional):',
    options: [
      { value: 'deuteranopia', label: 'Deuteranopia', hint: 'red-green (most common)' },
      { value: 'protanopia', label: 'Protanopia', hint: 'red-green' },
      { value: 'tritanopia', label: 'Tritanopia', hint: 'blue-yellow' },
      { value: 'achromatopsia', label: 'Achromatopsia', hint: 'full grayscale' },
    ],
    required: false,
  });
  if (p.isCancel(cvdInput)) { p.cancel('Cancelled.'); return null; }

  const outInput = await p.text({
    message: 'Output directory:',
    placeholder: '.',
    defaultValue: '.',
  });
  if (p.isCancel(outInput)) { p.cancel('Cancelled.'); return null; }

  return {
    ramps,
    modes: modesInput as string[],
    compliance,
    target,
    resolver: resolver !== 'stepped' ? resolver : undefined,
    cvd: (cvdInput as string[]).length > 0 ? (cvdInput as string[]) : undefined,
    adapters: adapters.length > 0 ? adapters : undefined,
    out: String(outInput) || '.',
  };
}

function parseScaffoldFlags(args: string[]): ScaffoldOptions | null {
  const ramps: RampDef[] = [];
  const modes: string[] = [];
  const cvd: string[] = [];
  const adapters: AdapterDef[] = [];
  let compliance: 'wcag21' | 'apca' = 'wcag21';
  let target: 'AA' | 'AAA' = 'AA';
  let resolver: 'stepped' | 'continuous' | undefined;
  let fallbackSteps: number | undefined;
  let out = '.';
  let force = false;

  // Collect brand/neutral ramps: --brand "#hex" [name] and --neutral "#hex" [name]
  // Or generic: --ramp name hex
  let i = 0;
  const pendingRamps: Array<{ role: string; hex: string; name?: string }> = [];

  while (i < args.length) {
    const arg = args[i]!;

    if (arg === '--brand' || arg === '--neutral' || arg === '--accent') {
      const role = arg.slice(2);
      // Collect one or more hex values
      const hexValues: string[] = [];
      while (i + 1 < args.length && !args[i + 1]!.startsWith('--')) {
        i++;
        hexValues.push(args[i]!);
      }
      for (const hex of hexValues) {
        pendingRamps.push({ role, hex });
      }
    } else if (arg === '--ramp') {
      // --ramp <name> <hex>
      const name = args[++i];
      const hex = args[++i];
      if (name && hex) pendingRamps.push({ role: 'ramp', hex, name });
    } else if (arg === '--modes') {
      while (i + 1 < args.length && !args[i + 1]!.startsWith('--')) {
        i++;
        modes.push(args[i]!);
      }
    } else if (arg === '--compliance') {
      const val = args[++i];
      if (val === 'wcag21' || val === 'apca') compliance = val;
    } else if (arg === '--target') {
      const val = args[++i];
      if (val === 'AA' || val === 'AAA') target = val;
    } else if (arg === '--resolver') {
      const val = args[++i];
      if (val === 'stepped' || val === 'continuous') resolver = val;
    } else if (arg === '--fallback-steps') {
      fallbackSteps = parseInt(args[++i] ?? '', 10);
    } else if (arg === '--adapter') {
      // --adapter <name> [--preset <preset>]
      const name = args[++i];
      if (name) adapters.push({ name });
    } else if (arg === '--preset') {
      // attaches to the last adapter
      const preset = args[++i];
      if (preset && adapters.length > 0) {
        adapters[adapters.length - 1]!.preset = preset;
      }
    } else if (arg === '--cvd') {
      while (i + 1 < args.length && !args[i + 1]!.startsWith('--')) {
        i++;
        cvd.push(args[i]!);
      }
    } else if (arg === '--out' || arg === '-o') {
      out = args[++i] ?? '.';
    } else if (arg === '--force' || arg === '-f') {
      force = true;
    }
    i++;
  }

  if (pendingRamps.length === 0) return null;

  // Build ramp list: brand first, then neutral, then others
  const brandRamps = pendingRamps.filter((r) => r.role === 'brand' || r.role === 'ramp');
  const neutralRamps = pendingRamps.filter((r) => r.role === 'neutral');
  const accentRamps = pendingRamps.filter((r) => r.role === 'accent');
  const ordered = [...brandRamps, ...neutralRamps, ...accentRamps];

  for (const pr of ordered) {
    const validHex = validateHex(pr.hex);
    if (!validHex) {
      process.stderr.write(`error: invalid hex color "${pr.hex}"\n`);
      return null;
    }
    const name = pr.name ?? pr.role;
    const finalName = ramps.some((r) => r.name === name) ? `${name}${ramps.length + 1}` : name;
    ramps.push({ name: finalName, sourceHex: validHex });
  }

  if (modes.length === 0) modes.push('light', 'dark');

  return {
    ramps,
    modes,
    compliance,
    target,
    resolver: resolver !== 'stepped' ? resolver : undefined,
    fallbackSteps,
    cvd: cvd.length > 0 ? cvd : undefined,
    adapters: adapters.length > 0 ? adapters : undefined,
    out,
    force,
  };
}

export async function scaffold(args: string[]): Promise<number> {
  const hasFlags = args.some((a) => a.startsWith('--') || a.startsWith('-'));

  let opts: ScaffoldOptions | null;
  if (hasFlags) {
    opts = parseScaffoldFlags(args);
    if (!opts) {
      process.stderr.write(
        'Usage: pigmint scaffold --brand <hex> [--neutral <hex>] [--modes light dark] [options]\n' +
        '\nOptions:\n' +
        '  --brand <hex...>          Brand hex color(s)\n' +
        '  --neutral <hex...>        Neutral/gray hex color(s)\n' +
        '  --accent <hex...>         Additional accent hex color(s)\n' +
        '  --ramp <name> <hex>       Named ramp (alternative to --brand/--neutral)\n' +
        '  --modes <mode...>         Display modes (default: light dark)\n' +
        '  --compliance wcag21|apca  Compliance standard (default: wcag21)\n' +
        '  --target AA|AAA           Compliance target (default: AA)\n' +
        '  --resolver stepped|continuous  Resolver mode (default: stepped)\n' +
        '  --fallback-steps <n>      Continuous resolver density\n' +
        '  --adapter <name>          Framework adapter (tailwind, mui; repeatable)\n' +
        '  --preset <name>           Adapter preset (follows --adapter)\n' +
        '  --cvd <profile...>        CVD profiles to simulate\n' +
        '  --out <dir>               Output directory (default: .)\n' +
        '  --force                   Overwrite existing files\n',
      );
      return 1;
    }
  } else {
    opts = await scaffoldInteractive();
    if (!opts) return 1;
  }

  const outDir = resolve(opts.out);
  const configPath = join(outDir, 'pigmint.yaml');
  const vocabPath = join(outDir, 'tokens.yaml');

  // Overwrite guard
  const [configExists, vocabExists] = await Promise.all([
    fileExists(configPath),
    fileExists(vocabPath),
  ]);

  if ((configExists || vocabExists) && !opts.force) {
    if (hasFlags) {
      const names = [configExists && 'pigmint.yaml', vocabExists && 'tokens.yaml']
        .filter(Boolean)
        .join(', ');
      process.stderr.write(
        `error: ${names} already exist in ${outDir}. Use --force to overwrite.\n`,
      );
      return 1;
    } else {
      const existing = [configExists && 'pigmint.yaml', vocabExists && 'tokens.yaml']
        .filter(Boolean)
        .join(' and ');
      const overwrite = await p.confirm({
        message: `${existing} already exist in ${outDir}. Overwrite?`,
        initialValue: false,
      });
      if (p.isCancel(overwrite) || !overwrite) {
        p.cancel('Aborted.');
        return 1;
      }
    }
  }

  const configYaml = buildConfigYaml(opts);
  const vocabYaml = buildVocabularyYaml(opts);

  await Promise.all([
    writeFile(configPath, configYaml, 'utf8'),
    writeFile(vocabPath, vocabYaml, 'utf8'),
  ]);

  if (hasFlags) {
    process.stdout.write(`created pigmint.yaml and tokens.yaml in ${outDir}\n`);
    process.stdout.write(`run: pigmint build --config ${configPath}\n`);
  } else {
    p.outro(`Created pigmint.yaml and tokens.yaml in ${outDir}\nRun: pigmint build --config ${configPath}`);
  }

  return 0;
}
