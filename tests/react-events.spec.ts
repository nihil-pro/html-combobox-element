import { test as base, expect, type Page } from '@playwright/test';
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Call } from './react/app';

/**
 * <combo-box> rendered by React 19: what handlers really receive.
 *
 * React 19 treats props on custom elements in two ways:
 *  - props React knows as events (onChange, onInput, onFocus, onBlur, onClick, ...) go through its
 *    delegated event system: the handler gets a SyntheticEvent, not the DOM event;
 *  - other `on*` props are added as native listeners for the exact, case-sensitive name after
 *    "on": `onclose` listens to "close", `onClose` to "Close" (which is never dispatched).
 *
 * The JSX typings (index.ts) type onChange & co. as DOM events (ComboboxEvent ...). These tests pin
 * the runtime facts; tests/types/fixtures/shared/src/gaps/react-*.tsx are the matching type gaps.
 */

const root = path.dirname(fileURLToPath(import.meta.url));
const BUNDLE = path.join(root, '.build', 'react-app.js');
const ORIGIN = 'http://react.combobox.test';

const test = base.extend<{ app: Page }>({
  app: async ({ page }, use) => {
    const script = fs.readFileSync(BUNDLE, 'utf8');
    await page.route(`${ORIGIN}/**`, (route) =>
      route.request().url().endsWith('/app.js')
        ? route.fulfill({ body: script, contentType: 'text/javascript' })
        : route.fulfill({ body: '<!doctype html><html><body><script type="module" src="/app.js"></script></body></html>', contentType: 'text/html' }),
    );
    const errors: Error[] = [];
    page.on('pageerror', (e) => errors.push(e));
    await page.goto(`${ORIGIN}/`);
    await page.waitForFunction(() => (window as any).__react);
    await use(page);
    expect(errors).toEqual([]);
  },
});

test.beforeAll(async () => {
  await build({
    entryPoints: [path.join(root, 'react', 'app.tsx')],
    bundle: true,
    format: 'esm',
    target: 'es2022',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"development"' },
    outfile: BUNDLE,
    logLevel: 'warning',
  });
});

const calls = (page: Page, prop?: string): Promise<Call[]> =>
  page.evaluate((p) => (window as any).__react.calls.filter((c: Call) => !p || c.prop === p), prop);

async function pick(page: Page, value: string) {
  await page.locator('combo-box').click();
  await page.locator(`combo-box box-option[value=${value}]`).click();
}

test('onChange gets a SyntheticEvent wrapping the native change Event, not a DOM Event', async ({ app }) => {
  await pick(app, 'banana');
  const [call, ...rest] = await calls(app, 'onChange');
  expect(rest).toEqual([]); // once per user change
  expect(call).toMatchObject({
    type: 'change',
    synthetic: true,
    instanceOfEvent: false, // ← typed as ComboboxEvent (extends Event)
    nativeEventType: 'Event',
    hasComposedPath: false, // ← type-checks as an Event method, throws if called
    targetIsCombobox: true,
    currentTargetIsCombobox: true,
    value: 'banana', // event.target.value is already the new value
  });
});

test('onInput gets a SyntheticEvent wrapping the search field InputEvent, retargeted to <combo-box>', async ({ app }) => {
  await app.locator('combo-box').click();
  await app.keyboard.type('ch');
  const inputs = await calls(app, 'onInput');
  expect(inputs).toHaveLength(2);
  expect(inputs[1]).toMatchObject({
    type: 'input',
    synthetic: true,
    nativeEventType: 'InputEvent',
    targetIsCombobox: true, // the shadow <input> is retargeted to the host
    query: 'ch',
  });
});

test('onFocus, onBlur and onClick get SyntheticEvents too', async ({ app }) => {
  await app.locator('combo-box').click();
  await app.keyboard.press('Escape');
  await app.locator('#out').focus();
  const byProp = Object.fromEntries((await calls(app)).map((c) => [c.prop, c]));
  expect(byProp.onFocus).toMatchObject({ type: 'focus', synthetic: true, nativeEventType: 'FocusEvent', targetIsCombobox: true });
  expect(byProp.onBlur).toMatchObject({ type: 'blur', synthetic: true, nativeEventType: 'FocusEvent', targetIsCombobox: true });
  expect(byProp.onClick).toMatchObject({ type: 'click', synthetic: true, nativeEventType: 'PointerEvent', targetIsCombobox: true });
});

test('component events React does not know: only exact lowercase props fire, with the native Event', async ({ app }) => {
  await pick(app, 'apple'); // selecting closes the picker → "close"
  await app.locator('combo-box').click();
  await app.keyboard.type('x');
  await app.keyboard.press('Enter'); // → "search"
  const props = (await calls(app)).map((c) => c.prop);

  const [close] = await calls(app, 'onclose');
  expect(close).toMatchObject({ type: 'close', synthetic: false, instanceOfEvent: true, hasComposedPath: true, targetIsCombobox: true });
  const [search] = await calls(app, 'onsearch');
  expect(search).toMatchObject({ type: 'search', synthetic: false, instanceOfEvent: true, query: 'x' });

  // accepted by the typings, never called
  expect(props).not.toContain('onClose');
  expect(props).not.toContain('onSearch');
});

test('ref receives the upgraded <combo-box> instance', async ({ app }) => {
  expect(await app.evaluate(() => (window as any).__react.refCalls())).toEqual(['combo-box']);
  expect(await app.evaluate(() => (window as any).__react.refIsUpgraded())).toBe(true);
});

test('props typed as boolean/string are applied as element properties', async ({ app }) => {
  const combobox = app.locator('combo-box');
  await app.evaluate(() => (window as any).__react.setProps({ multiple: true, clearable: true, placeholder: 'Fruits' }));
  expect(await combobox.evaluate((el: any) => [el.multiple, el.clearable, el.placeholder])).toEqual([true, true, 'Fruits']);
  await expect(combobox).toHaveAttribute('multiple', '');

  await app.evaluate(() => (window as any).__react.setProps({ multiple: false, clearable: false }));
  expect(await combobox.evaluate((el: any) => [el.multiple, el.clearable])).toEqual([false, false]);
  await expect(combobox).not.toHaveAttribute('multiple');

  await app.evaluate(() => (window as any).__react.setProps({ value: 'cherry' }));
  expect(await combobox.evaluate((el: any) => el.value)).toBe('cherry');
});
