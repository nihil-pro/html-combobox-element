import { test as base, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The CommonJS build (what `require('html-combobox-element')` loads).
 *
 * The rest of the suite tests src/ bundled by esbuild, so it can't see problems in what
 * TypeScript emits for configs/tsconfig.cjs.json. Here the CJS build is compiled with that
 * config, bundled the way CommonJS-consuming tools do (esbuild resolves the require() graph, with
 * tsc's export helpers), and loaded in a real browser.
 *
 * Regression: with target ES2022, tsc aliased the class inside its own static initializers to
 * `_a`, assigned only after the class body, so loading the module threw
 * "Cannot read properties of undefined (reading 'OWN_IDL')".
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'combobox-cjs-'));
const ORIGIN = 'http://cjs.combobox.test';
let bundle = '';

base.beforeAll(async () => {
  execFileSync(
    process.execPath,
    [
      path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'),
      '-p', path.join(root, 'configs', 'tsconfig.cjs.json'),
      '--outDir', outDir,
      '--declaration', 'false',
      '--composite', 'false',
      '--incremental', 'false',
      '--tsBuildInfoFile', 'null',
    ],
    { cwd: root, stdio: 'pipe' },
  );
  fs.writeFileSync(path.join(outDir, 'package.json'), JSON.stringify({ type: 'commonjs' }));
  const result = await build({
    stdin: {
      contents: `window.__cjs = require('./index.js');`,
      resolveDir: outDir,
    },
    bundle: true,
    format: 'iife',
    write: false,
    logLevel: 'silent',
  });
  bundle = result.outputFiles[0].text;
});

base.afterAll(() => fs.rmSync(outDir, { recursive: true, force: true }));

const test = base.extend({
  page: async ({ page }, use) => {
    await page.route(`${ORIGIN}/**`, (route) =>
      route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }),
    );
    await page.goto(`${ORIGIN}/`);
    await use(page);
  },
});

test('the CommonJS build loads and registers the elements', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addScriptTag({ content: bundle });
  expect(errors).toEqual([]);

  const state = await page.evaluate(() => {
    const exports = (window as any).__cjs;
    const Combobox = customElements.get('combo-box') as any;
    return {
      exports: Object.keys(exports).sort(),
      sameClass: exports.HTMLComboboxElement === Combobox,
      option: !!customElements.get('box-option'),
      tag: !!customElements.get('box-tag'),
      observedAttributes: Combobox.observedAttributes,
    };
  });
  expect(state).toEqual({
    exports: ['HTMLComboboxElement', 'HTMLComboboxOptionsCollection'],
    sameClass: true,
    option: true,
    tag: true,
    observedAttributes: ['required', 'disabled', 'clearable', 'multiple', 'filterable', 'searchable', 'value', 'placeholder', 'query'],
  });
});

test('elements from the CommonJS build work: attributes, options, value', async ({ page }) => {
  await page.addScriptTag({ content: bundle });
  const result = await page.evaluate(() => {
    document.body.innerHTML = `
      <combo-box multiple>
        <box-option value="apple" selected>Apple</box-option>
        <box-option value="banana">Banana</box-option>
      </combo-box>`;
    const el = document.querySelector('combo-box') as any;
    const before = { multiple: el.multiple, value: el.valueAsArray, options: el.options.length };
    el.removeAttribute('multiple'); // observed attribute → property
    el.value = 'banana';
    return { before, after: { multiple: el.multiple, value: el.value } };
  });
  expect(result).toEqual({
    before: { multiple: true, value: ['apple'], options: 2 },
    after: { multiple: false, value: 'banana' },
  });
});

test('the CommonJS playwright helper loads with require()', () => {
  const require = createRequire(import.meta.url);
  const helper = require(path.join(outDir, 'playwright.js'));
  expect(Object.keys(helper).sort()).toEqual(['COMBOBOX_ENGINE_NAME', 'comboboxSelectorEngine', 'registerCombobox']);
});
