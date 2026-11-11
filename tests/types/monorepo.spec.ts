import { test, expect } from '@playwright/test';
import { format, layoutDir, tsc, type TscResult } from './harness';

/**
 * Monorepo: html-combobox-element is a dependency of the app shell ONLY, and imported once, in
 * apps/shell/src/register.ts. packages/ui renders <combo-box> but neither depends on nor imports it.
 * packages/ui-typed is the same component with `import type {} from 'html-combobox-element'`.
 *
 * The typings are global augmentations (HTMLElementTagNameMap, React's JSX.IntrinsicElements),
 * so they exist in a TypeScript *program* only if the package's .d.ts is part of it. That's
 * decided per program, not per repo:
 *   - the shell's program includes ui's sources (it imports them)       → typed
 *   - ui checked on its own (its CI job, editor, project references)    → not typed
 *
 * Layouts:
 *   monorepo-npm          npm workspaces, everything hoisted to the root node_modules
 *   monorepo-pnpm         pnpm defaults (isolated, but hidden-hoisted to node_modules/.pnpm/node_modules)
 *   monorepo-pnpm-strict  pnpm with hoist=false: a package resolves only what it declares
 */

const LAYOUTS = ['monorepo-npm', 'monorepo-pnpm', 'monorepo-pnpm-strict'] as const;

const run = (layout: string, args: string[]) => tsc(layoutDir(layout), args, 'workspace');

const NOT_INTRINSIC = (tag: string) => `Property '${tag}' does not exist on type 'JSX.IntrinsicElements'.`;

/** Fails unless the only errors are "<combo-box>/<box-option> is not a JSX element" (and their knock-on implicit any). */
function expectUntypedJsx(r: TscResult, file: string) {
  const codes = new Set(r.diagnostics.map((d) => d.code));
  expect(r.diagnostics.length, format(r)).toBeGreaterThan(0);
  expect([...codes].sort(), format(r)).toEqual([2339, 7006]);
  expect(r.diagnostics.every((d) => d.file.endsWith(file)), format(r)).toBe(true);
  expect(r.diagnostics.map((d) => d.message), format(r)).toContain(NOT_INTRINSIC('combo-box'));
}

for (const layout of LAYOUTS) {
  test.describe(layout, () => {
    test('shell program: typed everywhere, including ui sources that never import the package', () => {
      // pnpm strict: the package's `declare module 'react'` augmentation must resolve 'react'
      // from the package's own location. Without (optional) peerDependencies on react and
      // @types/react it couldn't, and TypeScript silently dropped the augmentation - even in
      // the shell that imports it. The optional peers make pnpm link the app's copies in.
      const r = run(layout, ['-p', 'apps/shell/tsconfig.json']);
      expect(r.diagnostics, format(r)).toEqual([]);
    });

    test('ui package on its own: <combo-box> is unknown (augmentation not in its program)', () => {
      // Not a bug: a package that uses <combo-box> without referencing the package in any way
      // can't see its types. This test documents the constraint (and that it fails loudly).
      const r = run(layout, ['-p', 'packages/ui/tsconfig.json']);
      expectUntypedJsx(r, 'packages/ui/src/index.tsx');
    });

    test('ui-typed on its own: `import type {}` is enough to opt in', () => {
      const r = run(layout, ['-p', 'packages/ui-typed/tsconfig.json']);
      expect(r.diagnostics, format(r)).toEqual([]);
    });

    test('project references: shell → ui fails in ui (ui is built as its own program)', () => {
      const r = run(layout, ['-b', 'apps/shell/tsconfig.refs-ui.json', '--force']);
      expectUntypedJsx(r, 'packages/ui/src/index.tsx');
    });

    test('project references: shell → ui-typed builds', () => {
      const r = run(layout, ['-b', 'apps/shell/tsconfig.refs-ui-typed.json', '--force']);
      expect(r.diagnostics, format(r)).toEqual([]);
      expect(r.exitCode, r.output).toBe(0);
    });
  });
}
