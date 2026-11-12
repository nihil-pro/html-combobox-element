# HTMLComboboxElement
A customizable, and fully `HTMLSelectElement` compatible web component, with both **dropdown** and **combobox** functionality.
In other words – the `<select>` and `<selectedcontent>` polyfill.

## Key features
Like a native `<select>`:
- It is seamlessly exposed to assistive technology;
- Fully participate in HTML forms;
- Is fully controllable by keyboard, including type-ahead;
- Supports the same CSS pseudo-classes: `:disabled`, `:required`, `:invalid` etc.;
- Dispatches same events: `change`, `input`, `reset` etc.;
- Supports `single` and `multiple` modes;
- Supports `<optgroup>` and has the same markup style.

And – its fully customizable. Itself, its options and chips.

## Install
```sh
npm install html-combobox-element
```

### Register – once in app entry point
```ts
import 'html-combobox-element';
```
This registers the `<combo-box>`, `<box-option>` and `<box-tag>` custom elements with full TS support.

### Usage
```html
<combo-box multiple required>
  <box-option value="apple" selected>
    Apple
  </box-option>
  
  <optgroup label="Group">
    <box-option value="banana" selected>
      Banana
    </box-option>
    <box-option value="cherry">
      Cherry
    </box-option>
  </optgroup>
</combo-box>
```

### Differences from `<select>`
- In `multiple` mode, the `combobox.value` lists every selected value, where `select.value` gives only the first;
- In `single`mode, the `<combo-box>` without a selected option stays empty, where a `<select>` selects its first option.

### Events – type: when
- `change`: The user changed the selection. Once per action, only when the value changed.
- `input`: The user typed in the search field. It is the field's own `InputEvent`.
- `close`: The dropdown closed.
- `search`: The user pressed `Enter` in the search field
- `reset`: The form was reset

Read from event:
- `event.target.changed`: tells whether the value differs from when it opened
- `event.target.query`: tells the search field current text
- `event.target.query`: the combobox selection

Like native form controls, changes made by script dispatch no `change`.
Framework bindings that assume `input` means "the value changed" need the `change` event instead.

### Attributes
All `<select>`'s attributes are supported, and few extra:
- `filterable`: Displays search field in picker; options are automatically filtered against input value
- `searchable`: Displays search field in picker; you listen for input events and implement own filter. Usefully for fuzzy search, etc.
- `placeholder`: The combobox own placeholder, shown when there is no selection
- `query`: The search field input value

## Options API
Like `select.options`, `combobox.options` is a live collection too, but a fully compatible polyfill – `HTMLComboboxOptionsCollection`, because `HTMLOptionsCollection` can't be constructed or subclassed.
The only difference between `select.options` and `combobox.options`, is that `combobox.options` will false on `instanceof HTMLOptionsCollection` check.

## Accessibility
- Roles and states are set through `ElementInternals`, and mirrored as `role` and `aria`attributes, so tools that read the DOM can see it too.
- The host itself takes focus, so screen readers announce the combobox with its label and value.
- The arrow keys, Home/End, PageUp/PageDown, Enter, Space, Escape and type-ahead work as in the [select-only combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-select-only/).
- Name it with a `<label>`, `aria-label` or `aria-labelledby`.
- With `searchable` or `filterable` attributes, the popup is a `dialog` holding the search field and the listbox.
- With `clearable` and/or `multiple` attribute, the selected values are a list, each with a "Remove <OptionLabel>" button. Those texts can be localized:
```ts
import { HTMLComboboxElement } from 'html-combobox-element';

HTMLComboboxElement.strings.removeTag = 'Удалить';        // "Удалить Банан"
HTMLComboboxElement.strings.clearAll = 'Очистить выбор';
```

### Example of produced accessibility tree in Chrome
```
combobox "Fruit"  value="Banana"  expanded=true  hasPopup=listbox  controls=…
  listbox                         (multiselectable with `multiple`)
    option "Apple"   selected=false
    option "Banana"  selected=true
    option "Cherry"  disabled=true
```

### Known Chrome limitation 
Chrome does not expose the value of a disabled `<combo-box>`, because it computes the value of an ARIA combobox only while it is focusable.

## Testing with Playwright
Playwright's `getByRole()` / `ariaSnapshot()` and Testing Library's `*ByRole` work:
```ts
await page.getByRole('combobox').focus();
await page.getByRole('option', { name: 'Cherry' }).click();
await expect(page.getByRole('option', { selected: true })).toHaveText('Cherry');
```

Playwright's `selectOption()`, `toHaveValue()`, `toHaveValues()` and `getByLabel()` work on `<combo-box>` like on `<select>` once you register in your fixtures the helper from `html-combobox-element/playwright`:
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
  await page.getByLabel('Fruit').selectOption('banana'); // by value or label
  await page.getByLabel('Fruits').selectOption(['apple', 'cherry']);
  await expect(page.getByLabel('Fruit')).toHaveValue('banana');
  await expect(page.getByLabel('Fruits')).toHaveValues(['apple', 'cherry']);
});
```

### Why helper is needed 
Playwright runs its own page-side code in an **isolated** JavaScript world, 
which shares the DOM with your page _but not its JavaScript_, so the `HTMLComboboxElement` class doesn't exist there. 
The helper registers a selector engine with `contentScript: true`, which is the Playwright's public way to run code in that world. 
That teaches it the `<select>` API of `<combo-box>` through the DOM only. Your page's own JavaScript is **not touched**.

### One difference with screen readers 
Playwright names a custom element from `<label for>` only for native controls, 
so query `getByRole('combobox', { name })` with `aria-label` or `aria-labelledby` on the `<combo-box>`, or without a name.

## TypeScript and JSX
`import 'html-combobox-element'` also brings the typings: `document.createElement('combo-box')`, `querySelector`, `addEventListener` with the combobox's own events (`change`, `input`, `close`, `search`, `reset`, with a typed `event.target`) and `instanceof HTMLComboboxElement` all use the same `HTMLComboboxElement` type.

### React
Nothing to add: `<combo-box>`, `<box-option>` and `<box-tag>` are typed with React's own types (`ref`, `style`, every DOM handler, `aria-*`...), for `jsx: "react-jsx"`, `"react-jsxdev"` and classic `"react"`.

React wraps events in its own SyntheticEvents, so handlers are typed accordingly:
- `onChange`, `onInput`, `onFocus`, `onClick`, ... receive a SyntheticEvent: `event.target` is the `<combo-box>` (`event.target.value`, `event.target.query`), `event.nativeEvent` is the DOM event.
- Events React doesn't know are attached by React 19 as native listeners under the exact, case-sensitive name: use `onclose` and `onsearch` (lowercase). `onClose`/`onSearch` never fire, and are type errors.

```tsx
<combo-box
  name="fruit"
  multiple
  onChange={(event) => setFruits(event.target.valueAsArray)}
  onclose={(event) => event.target.changed && save()}
>
  <box-option value="apple">Apple</box-option>
</combo-box>
```

With `@types/react` 18 the framework-agnostic typings are used, as in previous versions.

If you copied the React `combo-box.d.ts` snippet from the README of a previous version, delete it: it still compiles, but it keeps the old typings.

### Monorepos
The typings are part of a TypeScript program only if the program includes this package. A workspace package that renders `<combo-box>` but leaves the import to the app shell type-checks inside the app, but not on its own (its CI, editor, project references). Add a type-only import there - it's removed from the JS output, nothing is registered twice:
```ts
import type {} from 'html-combobox-element';
```

### Other frameworks
JSX/template type-checking for these needs one small file in your project, with the snippet for your framework:



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
