import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const BUNDLE_PATH = path.join(root, 'tests', '.build', 'combobox.js');

export default async function globalSetup() {
  await build({
    entryPoints: [path.join(root, 'src', 'index.ts')],
    bundle: true,
    format: 'esm',
    target: 'es2022',
    sourcemap: 'inline',
    outfile: BUNDLE_PATH,
    logLevel: 'warning',
  });
}
