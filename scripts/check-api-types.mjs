#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(import.meta.url), '..', '..');
const swagger = resolve(repoRoot, '..', 'goals-tracker-api', 'swagger.yaml');
const committed = join(repoRoot, 'src/api/generated/schema.d.ts');
const cliBin = process.platform === 'win32' ? 'openapi-typescript.cmd' : 'openapi-typescript';
const cli = join(repoRoot, 'node_modules', '.bin', cliBin);

const strict = process.env.STRICT_API_CHECK === '1';

if (!existsSync(swagger)) {
  const msg = `swagger.yaml not found at ${swagger}`;
  if (strict) {
    console.error(`[check:api-types] ${msg}`);
    process.exit(1);
  }
  console.warn(`[check:api-types] skipping: ${msg} (set STRICT_API_CHECK=1 to fail).`);
  process.exit(0);
}

const tmp = mkdtempSync(join(tmpdir(), 'goals-bot-schema-'));
const out = join(tmp, 'schema.d.ts');
let exitCode = 0;
try {
  const res = spawnSync(cli, [swagger, '-o', out], { stdio: 'inherit' });
  if (res.status !== 0) {
    console.error('[check:api-types] openapi-typescript failed.');
    exitCode = res.status ?? 1;
  } else {
    const expected = readFileSync(out, 'utf8');
    const actual = readFileSync(committed, 'utf8');
    if (expected !== actual) {
      console.error(
        '[check:api-types] Generated OpenAPI types are out of date.\n' +
          '  Run: npm run generate:api-types\n' +
          '  Then commit src/api/generated/schema.d.ts'
      );
      exitCode = 1;
    } else {
      console.log('[check:api-types] OK: generated types match swagger.yaml.');
    }
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
process.exit(exitCode);
