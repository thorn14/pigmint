import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { auditContainer, type AuditReport } from '@pigmint/audit';
import type { DtcgContainer } from '@pigmint/core';
import { loadProjectConfig } from '../config.js';

export interface AuditOptions {
  configPath: string;
  cwd?: string;
}

export interface AuditRunResult {
  reportPath: string;
  report: AuditReport;
}

const DEFAULT_REPORT = './pigmint-audit.json';

export async function audit(options: AuditOptions): Promise<AuditRunResult> {
  const cwd = options.cwd ?? process.cwd();
  const configPath = resolve(cwd, options.configPath);
  const config = await loadProjectConfig(configPath);

  if (!config.output.dtcg) {
    throw new Error('audit requires output.dtcg to be set in pigmint.yaml');
  }
  const dtcgPath = resolve(dirname(configPath), config.output.dtcg);
  const dtcgRaw = await readFile(dtcgPath, 'utf8');
  const container = JSON.parse(dtcgRaw) as DtcgContainer;

  const profile =
    config.audit?.profile ?? (config.engine.compliance === 'apca' ? 'apca-srgb' : 'wcag-srgb');

  const report = auditContainer({
    container,
    projectConfig: config,
    dtcgSource: config.output.dtcg,
    target: config.engine.target,
    profile,
    engineVersion: '0.0.0',
  });

  const reportPath = resolve(
    dirname(configPath),
    config.audit?.report ?? DEFAULT_REPORT,
  );
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');

  return { reportPath, report };
}
