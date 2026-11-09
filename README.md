# html-combobox-element

The `<combo-box>` is a web component that provides dropdown/combobox functionality through `<select>` fully compatible API. 

## Install
```sh
npm install html-combobox-element
```

```ts
// app entry point
import 'html-combobox-element';
```
This registers the `<combo-box>`, `<box-option>` and `<box-tag>` custom elements with full TS support for plain DOM/vanilla-JS usage.

## Accessibility

`<combo-box>` is exposed to assistive technology like a native `<select>`. In Chrome's accessibility tree:

```
combobox "Fruit"  value="Banana"  expanded=true  hasPopup=listbox  controls=…
  listbox                         (multiselectable with `multiple`)
    option "Apple"   selected=false
    option "Banana"  selected=true
    option "Cherry"  disabled=true
```

- Roles and states are set through `ElementInternals`, and mirrored as `role`/`aria-selected`/`aria-disabled`
  attributes on `<box-option>` and `role="combobox"` on `<combo-box>`, so tools that read the DOM can see them too.
- The host itself takes focus, so screen readers announce the combobox with its label and value.
  The arrow keys, Home/End, PageUp/PageDown, Enter, Space, Escape and type-ahead work as in the
  [select-only combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-select-only/).
- Name it with a `<label>`, `aria-label` or `aria-labelledby`.
- With `searchable`/`filterable` the popup is a `dialog` holding the search field and the listbox.
- With `clearable`/`multiple` the selected values are a list, each with a "Remove …" button.
  Those texts can be localized:

```ts
import { HTMLComboboxElement } from 'html-combobox-element';

HTMLComboboxElement.strings.removeTag = 'Удалить';        // "Удалить Банан"
HTMLComboboxElement.strings.clearAll = 'Очистить выбор';
```

A disabled `<combo-box>` matches `:state(disabled)` (also when disabled by a `<fieldset>`).

Known Chrome limitation: Chrome does not expose the value of a disabled `<combo-box>`, because it
computes the value of an ARIA combobox only while it is focusable.

Playwright's `getByRole()` / `ariaSnapshot()` and Testing Library's `*ByRole` work:

```ts
await page.getByRole('combobox').focus();
await page.getByRole('option', { name: 'Cherry' }).click();
await expect(page.getByRole('option', { selected: true })).toHaveText('Cherry');
```

One difference with screen readers: Playwright names a custom element from `<label for>` only for
native controls, so query `getByRole('combobox', { name })` with `aria-label`/`aria-labelledby` on
the `<combo-box>`, or without a name.

## Events

| Event | When |
|---|---|
| `change` | The user changed the selection: click, Enter/Space, a tag's remove button, clear-all. Once per action, only when the value changed |
| `input` | The user typed in the search field (`searchable`/`filterable`). It is the field's own `InputEvent`: read the text from `combobox.query` (`event.target.value` is the selection) |
| `close` | The dropdown closed. `combobox.changed` tells whether the value differs from when it opened |
| `search` | Enter in the search field of a `searchable` combobox |
| `reset` | The form was reset |

Like native form controls, changes made by script (`value`, `selectedIndex`, `option.selected`,
attributes, the `options` collection, `form.reset()`) dispatch no `change`, so a framework that
sets the value and listens for `change` doesn't loop.

Framework bindings that assume `input` means "the value changed" (Vue's `v-model`, Angular's
`ngDefaultControl`) need the `change` event instead: `v-model.lazy`, `@change`, `(change)`, `onChange`.

## Options API

Like `select.options`, `combobox.options` is a live `HTMLOptionsCollection`-like list, and the
`<select>` methods that use it are available on `<combo-box>`:

```ts
combobox.options[0];                 // also options.item(0), combobox.item(0)
combobox.options.length = 0;         // removes all options (a higher value appends blank ones)
combobox.options[3] = option;        // replaces / appends / pads, `= null` removes
combobox.add(option, 1);             // before index 1 (or before an element), or at the end
combobox.remove(0);                  // removes the first option; remove() removes the combobox
combobox.namedItem('id-or-name');
combobox.selectedIndex = 2;          // -1 clears the selection
for (const option of combobox.options) { … }
```

`HTMLOptionsCollection` can't be constructed or subclassed, so it is an `HTMLComboboxOptionsCollection`
(`instanceof HTMLOptionsCollection` is false, its string tag is the same).

## Testing with Playwright

Playwright's `selectOption()`, `toHaveValue()`, `toHaveValues()` and `getByLabel()` work on
`<combo-box>` like on `<select>` once you register the helper from `html-combobox-element/playwright`
in your fixtures:

```ts
// fixtures.ts
import { test as base } from '@playwright/test';
import { registerCombobox } from 'html-combobox-element/playwright';

export const test = base.extend<{}, { combobox: void }>({
  combobox: [async ({ playwright }, use) => {
    await registerCombobox(playwright.selectors);
    await use();
  }, { scope: 'worker', auto: true }],
});
export { expect } from '@playwright/test';
```

```ts
// any.spec.ts
import { test, expect } from './fixtures';

test('pick a fruit', async ({ page }) => {
  await page.getByLabel('Fruit').selectOption('banana');          // by value or label
  await page.getByLabel('Fruits').selectOption(['apple', 'cherry']);
  await expect(page.getByLabel('Fruit')).toHaveValue('banana');
  await expect(page.getByLabel('Fruits')).toHaveValues(['apple', 'cherry']);
});
```

Why it's needed: Playwright runs its own page-side code in an isolated JavaScript world, which shares
the DOM with your page but not its JavaScript, so the `<combo-box>` class doesn't exist there. The
helper registers a selector engine with `contentScript: true` (Playwright's public way to run code in
that world) that teaches it the `<select>` API of `<combo-box>` through the DOM only. Your page's own
JavaScript is not touched. Verified with Chromium.

Differences from `<select>`: in multiple mode `combobox.value` lists every selected value
(`"apple,cherry"`) where `select.value` gives only the first; and a single `<combo-box>` without a
selected option stays empty, where a `<select>` selects its first option.

## Tests

```sh
npx playwright install chromium   # once
npm test
```

The Playwright suite (`tests/`) covers the accessibility tree (compared with a native `<select>`),
keyboard and pointer interaction, the `<select>`-like API, forms and dynamic options.

### TypeScript + JSX
Using `<combo-box>` in JSX or a Vue template needs one extra step, due to a TypeScript limitation: JSX/template type-checking only picks up custom element typings from a
file in your own project - not from a package's shipped `.d.ts`. 

This isn't specific to this package; it affects any library adding custom elements to `JSX.IntrinsicElements` under the modern automatic JSX runtime.

So, in addition to `import 'html-combobox-element'`, create and include one small file tsconfig.json, with the snippet for your framework: 

<details>
<summary><strong>React</strong> (<code>jsx: "react-jsx"</code>)</summary>

```ts
// combo-box.d.ts
declare module 'react/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements {
      'combo-box': ComboboxElementAttributes;
      'box-option': ComboboxOptionElementAttributes;
      'box-tag': ComboboxTagElementAttributes;
    }
  }
}
declare module 'react/jsx-dev-runtime' {
  namespace JSX {
    interface IntrinsicElements {
      'combo-box': ComboboxElementAttributes;
      'box-option': ComboboxOptionElementAttributes;
      'box-tag': ComboboxTagElementAttributes;
    }
  }
}
```

</details>

<details>
<summary><strong>Preact</strong> (<code>jsx: "react-jsx"</code>, <code>jsxImportSource: "preact"</code>)</summary>

```ts
// combo-box.d.ts
declare module 'preact/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements {
      'combo-box': ComboboxElementAttributes;
      'box-option': ComboboxOptionElementAttributes;
      'box-tag': ComboboxTagElementAttributes;
    }
  }
}
```

</details>

<details>
<summary><strong>Solid</strong> (<code>jsx: "preserve"</code>, <code>jsxImportSource: "solid-js"</code>)</summary>

```ts
// combo-box.d.ts
declare module 'solid-js/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements {
      'combo-box': ComboboxElementAttributes;
      'box-option': ComboboxOptionElementAttributes;
      'box-tag': ComboboxTagElementAttributes;
    }
  }
}
```

</details>

<details>
<summary><strong>Vue</strong> (SFC <code>&lt;template&gt;</code>, checked via <code>vue-tsc</code>)</summary>

Vue templates aren't JSX, so they're type-checked through `GlobalComponents` instead:

```ts
// combo-box.d.ts
declare module 'vue' {
  export interface GlobalComponents {
    'combo-box': new () => { $props: ComboboxElementAttributes };
    'box-option': new () => { $props: ComboboxOptionElementAttributes };
  }
}

```

This checks required props and value types for props you pass; like any native custom
element, Vue still allows extra/unrecognized attributes through (that's expected Vue
behavior for custom elements, not a gap in this typing). The trailing `export {};` may be 
required here (without it the file is treated as a script, not a module, and the
augmentation breaks Vue's own types).

</details>

### Exported types

- `HTMLComboboxElement`, `HTMLComboboxOptionElement`, `HTMLComboboxTagElement` - element
  interfaces, also usable via `document.querySelector('combo-box')` etc.
- `ComboboxEvent`, `ComboboxInputEvent`, `ComboboxFocusEvent` - typed event objects
  (`event.target` is a properly typed `HTMLComboboxElement`).
- `ComboboxJsxAttributes`, `ComboboxOptionJsxAttributes` - the component's own props
  (`value`, `multiple`, `placeholder`, `clearable`, `searchable`, `filterable`,
  `required`, `disabled`, etc.), framework-independent.
- `ComboboxElementAttributes`, `ComboboxOptionElementAttributes`,
  `ComboboxTagElementAttributes` - the above plus common passthrough attributes
  (`class`/`className`, `style`, `ref`, `children`, `data-*`, `aria-*`, `on*`). These
  are what the snippets above use for `'combo-box'` / `'box-option'` / `'box-tag'`.
