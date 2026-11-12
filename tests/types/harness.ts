/**
 * Type-level test harness.
 *
 * Type tests must see the package exactly the way a consumer does: the built `dist/`, resolved
 * through `package.json` `exports`/`types` from inside `node_modules`, under the consumer's own
 * `moduleResolution`. So `setup.ts` builds and `npm pack`s the package once, then installs every
 * fixture "layout" (a standalone app, monorepos with npm/pnpm) into `<os tmpdir>/html-combobox-element-type-tests/<layout>`
 * from that tarball. Each test then runs a real `tsc` over a fixture and asserts on its diagnostics.
 *
 * Fixture files carry their own assertions:
 *   - `Expect<Equal<A, B>>` for exact types,
 *   - `// @ts-expect-error` for code that must NOT compile (an unused one is itself an error, TS2578),
 * so "tsc reports zero diagnostics" means every assertion in the files held.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TYPES_DIR = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(TYPES_DIR, '../..');
export const FIXTURES = path.join(TYPES_DIR, 'fixtures');
/**
 * Outside the repository on purpose: TypeScript resolves packages by walking up parent
 * directories, so fixtures installed inside the repo would also see the repo's own node_modules
 * (react, preact, solid-js, vue are dev dependencies) - a "no framework installed" fixture
 * wouldn't be one. TYPES_WORK_DIR overrides the location; it must not be inside a project.
 */
export const WORK = process.env.TYPES_WORK_DIR ?? path.join(os.tmpdir(), 'html-combobox-element-type-tests');
export const TARBALL = path.join(WORK, 'html-combobox-element.tgz');

/** TypeScript versions installed side by side (npm aliases) in the standalone consumer layouts. */
export const TS_VERSIONS = {
  'ts5.9': 'ts59', // the version this repo builds with
  'ts6.0': 'ts60',
  'ts7.0': 'ts70', // the native compiler
} as const;
export type TsVersion = keyof typeof TS_VERSIONS;

export interface Layout {
  /** Directory under fixtures/ with the layout's own files (package.json, workspace config, sources). */
  name: string;
  /** Extra fixture directories copied into the layout first (shared assertion sources). */
  shared?: { from: string; to: string }[];
  install: 'npm' | 'pnpm';
}

export const LAYOUTS: Layout[] = [
  { name: 'consumer-react19', install: 'npm', shared: [{ from: 'shared', to: '.' }, { from: 'shared', to: 'cjs' }] },
  { name: 'consumer-react18', install: 'npm', shared: [{ from: 'shared', to: '.' }] },
  // No React/Preact/Solid/Vue installed: the framework augmentations must stay inert.
  { name: 'consumer-vanilla', install: 'npm', shared: [{ from: 'shared', to: '.' }] },
  { name: 'consumer-preact', install: 'npm', shared: [{ from: 'shared', to: '.' }] },
  // react aliased to preact/compat, react + preact + @types/react all installed
  { name: 'consumer-preact-compat', install: 'npm', shared: [{ from: 'shared', to: '.' }] },
  { name: 'monorepo-npm', install: 'npm', shared: [{ from: 'monorepo', to: '.' }] },
  { name: 'monorepo-pnpm', install: 'pnpm', shared: [{ from: 'monorepo', to: '.' }] },
  { name: 'monorepo-pnpm-strict', install: 'pnpm', shared: [{ from: 'monorepo', to: '.' }] },
];

export const layoutDir = (name: string) => path.join(WORK, name);

// ---------------------------------------------------------------------------------------------
// Running tsc

export interface Diagnostic {
  file: string;
  line: number;
  code: number;
  message: string;
}

export interface TscResult {
  exitCode: number;
  diagnostics: Diagnostic[];
  output: string;
}

const DIAGNOSTIC = /^(.+?)\((\d+),\d+\): error TS(\d+): (.*)$/;
const GLOBAL_DIAGNOSTIC = /^error TS(\d+): (.*)$/;

export function tsc(cwd: string, args: string[], ts: TsVersion | 'workspace' = 'ts5.9'): TscResult {
  const bin =
    ts === 'workspace'
      ? path.join(cwd, 'node_modules', 'typescript', 'bin', 'tsc')
      : path.join(cwd, 'node_modules', TS_VERSIONS[ts], 'bin', 'tsc');
  // `-b` must come first on the command line
  const argv = args[0] === '-b' ? [args[0], args[1], '--pretty', 'false', ...args.slice(2)] : ['--pretty', 'false', ...args];
  const res = spawnSync(process.execPath, [bin, ...argv], { cwd, encoding: 'utf8' });
  const output = `${res.stdout}${res.stderr}`;
  const diagnostics: Diagnostic[] = [];
  for (const raw of output.split('\n')) {
    const line = raw.trim();
    const m = DIAGNOSTIC.exec(line);
    if (m) {
      diagnostics.push({ file: m[1].replaceAll('\\', '/'), line: +m[2], code: +m[3], message: m[4] });
      continue;
    }
    const g = GLOBAL_DIAGNOSTIC.exec(line);
    if (g) diagnostics.push({ file: '', line: 0, code: +g[1], message: g[2] });
  }
  return { exitCode: res.status ?? -1, diagnostics, output };
}

/** Readable failure message: every diagnostic on its own line. */
export const format = (r: TscResult) =>
  r.diagnostics.length ? r.diagnostics.map((d) => `${d.file}:${d.line} TS${d.code} ${d.message}`).join('\n') : r.output;

/** Writes a throwaway tsconfig into `dir` and returns its file name. */
export function writeTsconfig(dir: string, name: string, config: object): string {
  const file = `tsconfig.${name.replace(/[^\w.-]+/g, '_')}.json`;
  fs.writeFileSync(path.join(dir, file), JSON.stringify(config, null, 2));
  return file;
}

// ---------------------------------------------------------------------------------------------
// Setup helpers (used by setup.ts)

export function run(cmd: string, args: string[], cwd: string) {
  execFileSync(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, npm_config_loglevel: 'error' } });
}

export function copyDir(from: string, to: string) {
  fs.mkdirSync(to, { recursive: true });
  fs.cpSync(from, to, { recursive: true });
}
