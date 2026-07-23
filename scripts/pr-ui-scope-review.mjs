#!/usr/bin/env node
/**
 * Back-compat wrapper — UI scope is part of jaguar policy now.
 * Prefer: node scripts/pr-jaguar-policy.mjs
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(here, 'pr-jaguar-policy.mjs');
const result = spawnSync(process.execPath, [target, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
});
process.exit(result.status ?? 1);
