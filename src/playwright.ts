/**
 * Makes Playwright's `selectOption()`, `toHaveValue()` and `toHaveValues()` work on `<combo-box>`
 * as they do on `<select>`.
 *
 * Why it's needed: Playwright runs its page-side code in an isolated JavaScript world. That world
 * shares the DOM with the page, but not the page's JavaScript: the `<combo-box>` class (its
 * `options`, `value`, `multiple`, …) doesn't exist there, so Playwright sees a plain element and
 * refuses it ("Element is not a <select> element").
 *
 * What it does: Playwright's custom selector engines registered with `contentScript: true` are
 * evaluated in that isolated world. This "engine" selects nothing; evaluating it teaches the
 * isolated world the `<select>` API of `<combo-box>`/`<box-option>`, implemented through the DOM
 * only (attributes, shadow root). `<combo-box>` reacts to `selected` attributes changed from any
 * world, so this drives the real component.
 *
 * It never touches the page's own world, so the application under test sees no difference.
 *
 * @example
 * // fixtures.ts
 * import { test as base } from '@playwright/test';
 * import { registerCombobox } from 'html-combobox-element/playwright';
 *
 * export const test = base.extend<{}, { combobox: void }>({
 *   combobox: [async ({ playwright }, use) => {
 *     await registerCombobox(playwright.selectors);
 *     await use();
 *   }, { scope: 'worker', auto: true }],
 * });
 *
 * // in a test
 * await page.getByLabel('Fruit').selectOption('banana');
 * await expect(page.getByLabel('Fruit')).toHaveValue('banana');
 */

/** The part of Playwright's `Selectors` this module uses (no dependency on Playwright) */
export interface SelectorsLike {
  register(name: string, script: string, options?: { contentScript?: boolean }): Promise<void>;
}

/** Name under which the engine is registered by default */
export const COMBOBOX_ENGINE_NAME = 'combobox-select-api';

// Evaluated inside Playwright's isolated world: must be self-contained (it's sent as source text).
function installComboboxSelectApi() {
  const engine = { query: () => null, queryAll: () => [] };
  // Playwright evaluates engines in the page's own world too: never patch there. Unlike the page,
  // Chrome's isolated worlds have no custom element registry.
  if (globalThis.customElements) return engine;
  const marker = Symbol.for('html-combobox-element/playwright');
  if ((globalThis as any)[marker]) return engine;
  (globalThis as any)[marker] = true;

  const isCombobox = (el: any): el is HTMLElement => !!el && el.localName === 'combo-box';
  const isOption = (el: any): el is HTMLElement => !!el && el.localName === 'box-option';
  const text = (option: Element) => (option.textContent || '').replace(/[\t\n\f\r ]+/g, ' ').trim();
  // Same rules as HTMLComboboxOptionElement (and <option>)
  const optionValue = (option: Element) => option.getAttribute('value') ?? text(option);
  const optionLabel = (option: Element) => option.getAttribute('label') ?? text(option);
  const optionsOf = (combobox: HTMLElement) => Array.from(combobox.shadowRoot?.querySelectorAll('box-option') ?? []);

  // Playwright checks `nodeName === 'SELECT'` before using the <select> API
  const nodeName = Object.getOwnPropertyDescriptor(Node.prototype, 'nodeName')!;
  Object.defineProperty(Node.prototype, 'nodeName', {
    configurable: true,
    get() { return isCombobox(this) ? 'SELECT' : nodeName.get!.call(this); },
  });

  // On HTMLElement.prototype, so elements with their own native property (<select>, <input>,
  // <option>, …) are unaffected; for every other element the getters return undefined as before.
  Object.defineProperties(HTMLElement.prototype, {
    options: {
      configurable: true,
      get() { return isCombobox(this) ? optionsOf(this) : undefined; },
    },
    selectedOptions: {
      configurable: true,
      get() { return isCombobox(this) ? optionsOf(this).filter((o) => o.hasAttribute('selected')) : undefined; },
    },
    multiple: {
      configurable: true,
      get() { return isCombobox(this) ? this.hasAttribute('multiple') : undefined; },
    },
    // For getByLabel(): <label for> / wrapping <label> (label.control is native, so it works here)
    labels: {
      configurable: true,
      get() {
        if (!isCombobox(this)) return undefined;
        return Array.from((this as HTMLElement).ownerDocument.querySelectorAll('label')).filter((label) => label.control === this);
      },
    },
    label: {
      configurable: true,
      get() { return isOption(this) ? optionLabel(this) : undefined; },
    },
    selected: {
      configurable: true,
      get() { return isOption(this) ? this.hasAttribute('selected') : undefined; },
      set(value: unknown) { if (isOption(this)) this.toggleAttribute('selected', !!value); },
    },
    value: {
      configurable: true,
      get() {
        if (isOption(this)) return optionValue(this);
        if (isCombobox(this)) return optionsOf(this).filter((o) => o.hasAttribute('selected')).map(optionValue).join(',');
        return undefined;
      },
      // Like combobox.value = x: null/undefined clear, comma-separated values select several
      set(value: unknown) {
        if (!isCombobox(this)) return;
        const values = value == null ? [] : String(value).split(',');
        for (const option of optionsOf(this)) option.toggleAttribute('selected', values.includes(optionValue(option)));
      },
    },
  });
  return engine;
}

/** Source of the selector engine, for `selectors.register(name, source, { contentScript: true })` */
export const comboboxSelectorEngine = `(${installComboboxSelectApi.toString()})()`;

/**
 * Registers the engine. Call it once per worker, before any page is created
 * (Playwright requires selector engines to be registered before pages exist).
 */
export function registerCombobox(selectors: SelectorsLike, name = COMBOBOX_ENGINE_NAME) {
  return selectors.register(name, comboboxSelectorEngine, { contentScript: true });
}
