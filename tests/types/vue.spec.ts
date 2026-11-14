import { test, expect } from '@playwright/test';
import { format, layoutDir, tsc, writeTsconfig, type TsVersion } from './harness';

/** A Vue app that installed html-combobox-element: TS 5.9 / 6.0 / 7.0 × moduleResolution. */

const RESOLUTIONS = [
  { name: 'node16', module: 'node16', moduleResolution: 'node16' },
  { name: 'bundler', module: 'esnext', moduleResolution: 'bundler' },
];

for (const ts of ['ts5.9', 'ts6.0', 'ts7.0'] as TsVersion[]) {
  for (const res of RESOLUTIONS) {
    test(`Vue · ${ts} · ${res.name}`, () => {
      const dir = layoutDir('consumer-vue');
      const project = writeTsconfig(dir, `${ts}.vue.${res.name}`, {
        compilerOptions: {
          strict: true,
          target: 'es2022',
          lib: ['es2022', 'dom', 'dom.iterable'],
          module: res.module,
          moduleResolution: res.moduleResolution,
          jsx: 'preserve',
          noEmit: true,
          skipLibCheck: false,
          types: [],
        },
        files: ['src/dom.ts', 'src/App.vue'],
      });
      const r = tsc(dir, ['-p', project], ts, true);
      expect(r.diagnostics, format(r)).toEqual([]);
    });
  }
}
