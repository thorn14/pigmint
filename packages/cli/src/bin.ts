#!/usr/bin/env node
import { build } from './commands/build.js';
import { scaffold } from './commands/scaffold.js';
import { ConfigError } from './config.js';
import { PortableVocabularyError } from '@pigmint/core';

interface ParsedArgs {
  command: string | undefined;
  configPath: string;
  jsonOutput: boolean;
  rest: string[];
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;
  let configPath = 'pigmint.yaml';
  let jsonOutput = false;
  const remaining: string[] = [];

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]!;
    if ((arg === '--config' || arg === '-c') && rest[i + 1]) {
      configPath = rest[i + 1] ?? configPath;
      i++;
    } else if (arg === '--json') {
      jsonOutput = true;
    } else {
      remaining.push(arg);
    }
  }
  return { command, configPath, jsonOutput, rest: remaining };
}

function printUsage(): void {
  process.stderr.write(
    [
      'Usage: pigmint <command> [options]',
      '',
      'Commands:',
      '  build     Generate output files described in pigmint.yaml',
      '  scaffold  Create a starter pigmint.yaml and tokens.yaml',
      '',
      'build options:',
      '  -c, --config <path>   Path to pigmint.yaml (default: ./pigmint.yaml)',
      '  --json                Emit machine-readable JSON summary to stdout',
      '',
      'scaffold options:',
      '  --brand <hex...>      Brand hex color(s)',
      '  --neutral <hex...>    Neutral/gray hex color(s)',
      '  --modes <mode...>     Display modes (default: light dark)',
      '  --compliance wcag21|apca',
      '  --target AA|AAA',
      '  --adapter <name>      Framework adapter (tailwind, mui)',
      '  --preset <name>       Adapter preset (follows --adapter)',
      '  --cvd <profile...>    CVD simulation profiles',
      '  --out <dir>           Output directory (default: .)',
      '  --force               Overwrite existing files',
      '',
      'Run without flags for interactive wizard:',
      '  pigmint scaffold',
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
    ].join('\n'),
  );
}

async function runBuild(configPath: string, jsonOutput: boolean): Promise<number> {
  if (jsonOutput) {
    try {
      const result = await build({ configPath });
      const output = {
        success: true,
        artifacts: {
          ...(result.primitivesPath ? { primitives: result.primitivesPath } : {}),
          ...(result.outputPath ? { dtcg: result.outputPath } : {}),
          adapters: result.adapters.map((a) => ({ name: a.name, files: a.files })),
        },
        warnings: result.adapters.flatMap((a) => a.warnings.map((w) => `${a.name}: ${w}`)),
        stats: {
          ramps: result.rampCount,
          modes: result.modes,
          tokenCount: result.tokenCount,
          failedTokens: result.failedTokens,
        },
      };
      process.stdout.write(JSON.stringify(output, null, 2) + '\n');
      return 0;
    } catch (err) {
      const message =
        err instanceof ConfigError
          ? `${err.path}: ${err.message}`
          : err instanceof PortableVocabularyError
          ? `${err.path}: ${err.message}`
          : (err as Error).message;
      process.stdout.write(JSON.stringify({ success: false, errors: [message] }, null, 2) + '\n');
      return 1;
    }
  }

  try {
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
    return 0;
  } catch (err) {
    if (err instanceof ConfigError) {
      process.stderr.write(`config error (${err.path}): ${err.message}\n`);
    } else if (err instanceof PortableVocabularyError) {
      process.stderr.write(`vocabulary error (${err.path}): ${err.message}\n`);
    } else {
      process.stderr.write(`error: ${(err as Error).message}\n`);
    }
    return 1;
  }
}

async function main(): Promise<number> {
  const { command, configPath, jsonOutput, rest } = parseArgs(process.argv.slice(2));

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printUsage();
    return command ? 0 : 1;
  }

  if (command === 'build') {
    return runBuild(configPath, jsonOutput);
  }

  if (command === 'scaffold') {
    return scaffold(rest);
  }

  process.stderr.write(`unknown command: ${command}\n`);
  printUsage();
  return 1;
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
