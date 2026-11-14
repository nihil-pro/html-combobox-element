import { test, expect } from '@playwright/test';
import { format, layoutDir, tsc, writeTsconfig, type TsVersion } from './harness';

/**
 * preact/compat: code imports 'react', the build aliases it to preact/compat, package.json has
 * react, preact and @types/react. The setups people use:
 *   - tsconfig `paths` alias (Preact's docs), JSX from preact or from the aliased react runtime
 *   - no alias: 'react' types are the real @types/react, JSX from preact
 */

const PATHS = {
  react: ['./node_modules/preact/compat/'],
  'react/jsx-runtime': ['./node_modules/preact/jsx-runtime'],
  'react-dom': ['./node_modules/preact/compat/'],
  'react-dom/*': ['./node_modules/preact/compat/*'],
};

const SETUPS = [
  { name: 'paths alias, jsxImportSource preact', jsxImportSource: 'preact', paths: PATHS },
  { name: 'paths alias, jsxImportSource react', jsxImportSource: 'react', paths: PATHS },
  { name: 'no alias, jsxImportSource preact', jsxImportSource: 'preact' },
];

for (const ts of ['ts5.9', 'ts6.0', 'ts7.0'] as TsVersion[]) {
  for (const setup of SETUPS) {
    for (const skipLibCheck of [false, true]) {
      test(`preact/compat · ${ts} · ${setup.name} · skipLibCheck ${skipLibCheck}`, () => {
        const dir = layoutDir('consumer-preact-compat');
        const project = writeTsconfig(dir, `${ts}.compat.${setup.name}.${skipLibCheck}`, {
          compilerOptions: {
            strict: true,
            target: 'es2022',
            lib: ['es2022', 'dom', 'dom.iterable'],
            module: 'esnext',
            moduleResolution: 'bundler',
            jsx: 'react-jsx',
            jsxImportSource: setup.jsxImportSource,
            ...(setup.paths ? { paths: setup.paths } : {}),
            noEmit: true,
            skipLibCheck,
            types: [],
          },
          files: ['src/dom.ts', 'src/globals.ts', 'src/compat.tsx'],
        });
        const r = tsc(dir, ['-p', project], ts);
        expect(r.diagnostics, format(r)).toEqual([]);
      });
    }
  }
}
