#!/usr/bin/env node
import { audit } from './commands/audit.js';
import { build } from './commands/build.js';
import { ConfigError } from './config.js';

function parseArgs(argv: string[]): {
  command: string | undefined;
  configPath: string;
} {
  const [command, ...rest] = argv;
  let configPath = 'pigmint.yaml';
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if ((arg === '--config' || arg === '-c') && rest[i + 1]) {
      configPath = rest[i + 1] ?? configPath;
      i++;
    }
  }
  return { command, configPath };
}

function printUsage(): void {
  process.stderr.write(
    [
      'Usage: pigmint <command> [options]',
      '',
      'Commands:',
      '  build   Generate output files described in pigmint.yaml',
      '  audit   Audit the emitted tokens file for contract violations',
      '',
      'Options:',
      '  -c, --config <path>   Path to pigmint.yaml (default: ./pigmint.yaml)',
      '',
      'Output modes (set in pigmint.yaml):',
      '',
      '  Primitives only (no vocabulary required):',
      '    output:',
      '      primitives: ./primitives.json',
      '',
      '  Full build (vocabulary required):',
      '    defaults:',
      '      vocabulary: ./tokens.yaml',
      '    output:',
      '      primitives: ./primitives.json  # optional — inspect ramp steps',
      '      dtcg: ./tokens.json',
      '',
      'Ramp sources (set in pigmint.yaml):',
      '    ramps:',
      '      - name: stone',
      '        source: "#78716c"           # derive default curves from hex',
      '      - name: stone',
      '        fromFile: ./primitives.json  # load pre-computed steps',
      '',
    ].join('\n'),
  );
}

async function main(): Promise<number> {
  const { command, configPath } = parseArgs(process.argv.slice(2));

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printUsage();
    return command ? 0 : 1;
  }

  if (command !== 'build' && command !== 'audit') {
    process.stderr.write(`unknown command: ${command}\n`);
    printUsage();
    return 1;
  }

  try {
    if (command === 'audit') {
      const result = await audit({ configPath });
      const { error, warning, info } = result.report.summary.violations;
      process.stdout.write(
        `audit → ${result.reportPath} (${error} error(s), ${warning} warning(s), ${info} info)\n`,
      );
      return error > 0 ? 1 : 0;
    }

    const result = await build({ configPath });
    if (result.primitivesPath) {
      process.stdout.write(`emitted primitives → ${result.primitivesPath} (${result.rampCount} ramps)\n`);
    }
    if (result.outputPath) {
      process.stdout.write(
        `emitted tokens → ${result.outputPath} (${result.modeCount} mode(s), ${result.tokenCount} token-mode resolutions)\n`,
      );
    }
    for (const adapter of result.adapters) {
      for (const file of adapter.files) {
        process.stdout.write(`emitted ${adapter.name} → ${file}\n`);
      }
      for (const warning of adapter.warnings) {
        process.stderr.write(`${adapter.name} warning: ${warning}\n`);
      }
    }
    if (result.priorAudit && result.priorAudit.suggestions.length > 0) {
      process.stdout.write(
        `\nPrior audit (${result.priorAudit.runId}) — ${result.priorAudit.suggestions.length} suggestion(s):\n`,
      );
      for (const s of result.priorAudit.suggestions) {
        process.stdout.write(`  · [${s.channel}] ${s.target} — ${s.rationale}\n`);
      }
    }
    return 0;
  } catch (err) {
    if (err instanceof ConfigError) {
      process.stderr.write(`config error (${err.path}): ${err.message}\n`);
    } else {
      process.stderr.write(`error: ${(err as Error).message}\n`);
    }
    return 1;
  }
}

main().then(
  (code) => {
    process.exit(code);
  },
  (err) => {
    process.stderr.write(`fatal: ${(err as Error).message}\n`);
    process.exit(2);
  },
);
