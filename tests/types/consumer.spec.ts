import { test, expect } from '@playwright/test';
import { format, layoutDir, tsc, writeTsconfig, type TsVersion } from './harness';

/**
 * A standalone app that installed html-combobox-element from npm.
 *
 * Matrix: TypeScript 5.9 / 6.0 / 7.0 × moduleResolution (node16, nodenext, bundler) ×
 * JSX runtime (react-jsx, react-jsxdev, classic), for an ESM ("type": "module") and a CommonJS
 * consumer. Every combination must compile the shared assertion files with zero diagnostics.
 *
 * moduleResolution "node"/"node10" is not supported (ignores package.json `exports`; deprecated
 * in TS 6.0, removed in TS 7.0).
 */

interface Resolution {
  name: string;
  module: string;
  moduleResolution: string;
}

const RESOLUTIONS: Resolution[] = [
  { name: 'node16', module: 'node16', moduleResolution: 'node16' },
  { name: 'nodenext', module: 'nodenext', moduleResolution: 'nodenext' },
  { name: 'bundler', module: 'esnext', moduleResolution: 'bundler' },
  { name: 'bundler+preserve', module: 'preserve', moduleResolution: 'bundler' },
];

const CJS_RESOLUTIONS: Resolution[] = [
  { name: 'node16', module: 'node16', moduleResolution: 'node16' },
  { name: 'nodenext', module: 'nodenext', moduleResolution: 'nodenext' },
];

/** react-jsx → react/jsx-runtime, react-jsxdev → react/jsx-dev-runtime, react → React.JSX via React.createElement */
const JSX_MODES = ['react-jsx', 'react-jsxdev', 'react'] as const;

const ALL_TS: TsVersion[] = ['ts5.9', 'ts6.0', 'ts7.0'];

function compilerOptions(ts: TsVersion, res: Resolution, jsx: string, extra: object = {}) {
  return {
    strict: true,
    target: 'es2022',
    lib: ['es2022', 'dom', 'dom.iterable'],
    module: res.module,
    moduleResolution: res.moduleResolution,
    jsx,
    noEmit: true,
    // Strictest consumer: the package's own .d.ts files are type-checked too.
    skipLibCheck: false,
    // Only what the sources import (no ambient @types/* auto-inclusion).
    types: [],
    ...extra,
  };
}

function check(layout: string, ts: TsVersion, name: string, config: object, args: string[] = []) {
  const dir = layoutDir(layout);
  const project = writeTsconfig(dir, `${ts}.${name}`, config);
  return tsc(dir, ['-p', project, ...args], ts);
}

const sources = (root: string) => [`${root}/src/dom.ts`, `${root}/src/globals.ts`, `${root}/src/react.tsx`, `${root}/src/playwright-subpath.ts`];

// ---------------------------------------------------------------------------------------------

test.describe('ESM consumer, React 19', () => {
  for (const ts of ALL_TS) {
    for (const res of RESOLUTIONS) {
      for (const jsx of JSX_MODES) {
        test(`${ts} · ${res.name} · jsx ${jsx}`, () => {
          const r = check('consumer-react19', ts, `esm.${res.name}.${jsx}`, {
            compilerOptions: compilerOptions(ts, res, jsx),
            files: sources('.'),
          });
          expect(r.diagnostics, format(r)).toEqual([]);
          expect(r.exitCode, r.output).toBe(0);
        });
      }
    }
  }
});

test.describe('CommonJS consumer ("type": "commonjs"), React 19', () => {
  for (const ts of ALL_TS) {
    for (const res of CJS_RESOLUTIONS) {
      for (const jsx of ['react-jsx', 'react'] as const) {
        test(`${ts} · ${res.name} · jsx ${jsx}`, () => {
          const r = check('consumer-react19', ts, `cjs.${res.name}.${jsx}`, {
            compilerOptions: compilerOptions(ts, res, jsx),
            files: sources('cjs'),
          });
          expect(r.diagnostics, format(r)).toEqual([]);
          expect(r.exitCode, r.output).toBe(0);
        });
      }
    }
  }
});

test.describe('which declaration file each mode resolves', () => {
  // The `import` condition must get dist/types (ESM), `require` must get dist/cjs (CJS, with its
  // own package.json {"type":"commonjs"}).
  const cases: { ts: TsVersion; root: '.' | 'cjs'; res: Resolution; expected: string; not: string }[] = [];
  for (const ts of ALL_TS) {
    for (const res of RESOLUTIONS) {
      cases.push({ ts, root: '.', res, expected: 'dist/types/index.d.ts', not: 'dist/cjs/index.d.ts' });
    }
    for (const res of CJS_RESOLUTIONS) {
      cases.push({ ts, root: 'cjs', res, expected: 'dist/cjs/index.d.ts', not: 'dist/types/index.d.ts' });
    }
  }
  for (const c of cases) {
    test(`${c.ts} · ${c.root === '.' ? 'esm' : 'cjs'} · ${c.res.name} → ${c.expected}`, () => {
      // --listFiles prints every file of the program after the diagnostics
      const r = check('consumer-react19', c.ts, `files.${c.root === '.' ? 'esm' : 'cjs'}.${c.res.name}`, {
        compilerOptions: compilerOptions(c.ts, c.res, 'react-jsx'),
        files: [`${c.root}/src/dom.ts`],
      }, ['--listFiles']);
      const files = r.output.split('\n').map((l) => l.trim().replaceAll('\\', '/')).filter((l) => l.includes('/html-combobox-element/'));
      expect(r.diagnostics, format(r)).toEqual([]);
      expect(files.some((f) => f.endsWith(`html-combobox-element/${c.expected}`)), files.join('\n')).toBe(true);
      expect(files.some((f) => f.endsWith(`html-combobox-element/${c.not}`)), files.join('\n')).toBe(false);
    });
  }
});

test.describe('no framework installed (DOM only, skipLibCheck: false)', () => {
  for (const ts of ALL_TS) {
    for (const res of RESOLUTIONS) {
      test(`${ts} · ${res.name}`, () => {
        const r = check('consumer-vanilla', ts, `vanilla.${res.name}`, {
          compilerOptions: compilerOptions(ts, res, 'preserve'),
          files: ['src/dom.ts', 'src/globals.ts', 'src/regressions/add-event-listener-event-map.ts', 'src/regressions/exported-class-is-tag-type.ts', 'src/playwright-subpath.ts'],
        });
        expect(r.diagnostics, format(r)).toEqual([]);
      });
    }
  }
});

test.describe('skipLibCheck: true behaves the same', () => {
  for (const ts of ALL_TS) {
    test(`${ts} · bundler · react-jsx`, () => {
      const res = RESOLUTIONS.find((r) => r.name === 'bundler')!;
      const r = check('consumer-react19', ts, 'esm.bundler.skiplib', {
        compilerOptions: compilerOptions(ts, res, 'react-jsx', { skipLibCheck: true }),
        files: sources('.'),
      });
      expect(r.diagnostics, format(r)).toEqual([]);
    });
  }
});

test.describe('React 18 types (@types/react@18: global JSX namespace still exists)', () => {
  for (const ts of ['ts5.9', 'ts7.0'] as TsVersion[]) {
    for (const res of RESOLUTIONS.filter((r) => ['node16', 'bundler'].includes(r.name))) {
      for (const jsx of JSX_MODES) {
        test(`${ts} · ${res.name} · jsx ${jsx}`, () => {
          const r = check('consumer-react18', ts, `r18.${res.name}.${jsx}`, {
            compilerOptions: compilerOptions(ts, res, jsx),
            files: sources('.'),
          });
          expect(r.diagnostics, format(r)).toEqual([]);
        });
      }
    }
  }
});

// ---------------------------------------------------------------------------------------------
// Regressions: each file under src/regressions asserts typing that used to be wrong (the header
// of each file says what was broken and how it was fixed).

const REGRESSIONS: { file: string; resolutions: string[] }[] = [
  { file: 'add-event-listener-event-map.ts', resolutions: ['node16', 'bundler'] },
  { file: 'exported-class-is-tag-type.ts', resolutions: ['node16', 'bundler'] },
  { file: 'react-ref-callback.tsx', resolutions: ['node16', 'bundler'] },
  { file: 'react-synthetic-events.tsx', resolutions: ['node16', 'bundler'] },
  { file: 'react-dom-handlers-typed.tsx', resolutions: ['node16', 'bundler'] },
  { file: 'react-dead-handler-props.tsx', resolutions: ['node16', 'bundler'] },
  { file: 'react-form-attributes.tsx', resolutions: ['node16', 'bundler'] },
];

test.describe('regressions', () => {
  for (const reg of REGRESSIONS) {
    for (const ts of ALL_TS) {
      for (const resName of reg.resolutions) {
        const res = RESOLUTIONS.find((r) => r.name === resName)!;
        test(`${reg.file} · ${ts} · ${res.name}`, () => {
          const r = check('consumer-react19', ts, `regression.${res.name}.${reg.file}`, {
            compilerOptions: compilerOptions(ts, res, 'react-jsx'),
            files: [`src/regressions/${reg.file}`],
          });
          expect(r.diagnostics, format(r)).toEqual([]);
        });
      }
    }
  }
});

test.describe('compatibility', () => {
  for (const ts of ALL_TS) {
    for (const skipLibCheck of [false, true]) {
      test(`README React snippet from earlier versions still compiles · ${ts} · skipLibCheck ${skipLibCheck}`, () => {
        const res = RESOLUTIONS.find((r) => r.name === 'bundler')!;
        const r = check('consumer-react19', ts, `compat.readme-snippet.${skipLibCheck}`, {
          compilerOptions: compilerOptions(ts, res, 'react-jsx', { skipLibCheck }),
          files: ['compat/readme-snippet.d.ts', 'compat/app.tsx'],
        });
        expect(r.diagnostics, format(r)).toEqual([]);
      });
    }
  }
});
