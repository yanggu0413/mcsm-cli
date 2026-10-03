import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const packageRoot = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const buildDirectory = path.resolve(packageRoot, 'build');
if (path.dirname(buildDirectory) !== packageRoot || path.basename(buildDirectory) !== 'build') {
  throw new Error('Unexpected build cleanup target');
}
fs.rmSync(buildDirectory, { recursive: true, force: true });

const require = createRequire(import.meta.url);
const compiler = require.resolve('typescript/bin/tsc');
const result = spawnSync(process.execPath, [compiler, '--project', path.join(packageRoot, 'tsconfig.json')], {
  cwd: packageRoot,
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
