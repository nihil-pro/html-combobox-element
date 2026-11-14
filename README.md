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
- In `multiple` mode, the selected values are displayed as chips;
- In `single`mode, the `<combo-box>` without a selected option stays empty, where a `<select>` selects its first option.

### Events – type: when
- `change`: The user changed the selection. Once per action, only when the value changed.
- `input`: The user typed in the search field. It is the field's own `InputEvent`.
- `close`: The dropdown closed.
- `search`: The user pressed `Enter` in the search field
- `reset`: The form was reset

Read from event:
- `event.target.changed`: tells whether the value differs from when it opened;
- `event.target.query`: tells the search field current text;
- `event.target.value`: the combobox selection;
- `event.target.valueAsArray`: the combobox selection as an array of strings.

Like native form controls, changes made by script dispatch no `change`. Framework bindings that assume `input` means "the value changed" need the `change` event instead.

### Attributes
All `<select>`'s attributes are supported, and few extra:
- `filterable`: Displays search field in picker; options are automatically filtered against input value;
- `searchable`: Displays search field in picker; you listen for input events and implement own filter. Usefully for fuzzy search, etc.;
- `placeholder`: The combobox own placeholder, shown when there is no selection;
- `query`: The search field input value.

## Options API
Like `select.options`, `combobox.options` is a live collection too, but a fully compatible polyfill – `HTMLComboboxOptionsCollection`, because `HTMLOptionsCollection` can't be constructed or subclassed.
The only difference between `select.options` and `combobox.options`, is that `combobox.options` will false on `instanceof HTMLOptionsCollection` check.
The `<box-option>` itself has the same API as native `<option>`. It exists, because the `<option>` can't be styled at all.

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

## TypeScript and JSX frameworks
`import 'html-combobox-element'` also brings the typings for: 
- `document.createElement('combo-box')`;
- `querySelector`;
- `addEventListener` with a typed `event.target`.

### Event listeners attached through the props
The props are the same everywhere, but which handlers get called, and with what, depends on the framework:

| Handler prop | React 19 | React 18 | Vue/Preact/SolidJS |
|--------------|---|---|--------------------|
| `onInput`    | SyntheticEvent | SyntheticEvent | DOM event          |
| `onChange`   | SyntheticEvent | never called | DOM event          |
| `onsearch`   | DOM event | never called | DOM event          |
| `oninvalid`  | DOM event | never called | DOM event          |
| `onreset`    | DOM event | never called | DOM event          |
| `onclose`    | DOM event | never called | DOM event          |
| `onClose`    | never called | never called | DOM event          |
| `onSearch`   | never called | never called | DOM event          |
| `onReset`    | never called | never called | DOM event          |
| `onInvalid`  | never called | never called | DOM event          |

The `combobox.addEventListener(type, cb)` works seamlessly in all frameworks.

### Boolean props
The `multiple`, `clearable`, `disabled`, ... behave like native ones in every framework, except that the string `'false'` is also `false`, i.e. turns the feature off.

### React
Package ships types, for `jsx: "react-jsx"`, `"react-jsxdev"` and classic `"react"`.
Handlers are typed accordingly: `onChange`, `onInput`, `onFocus`, `onClick`, ... receive a SyntheticEvent: `event.target` is the `<combo-box>`, `event.nativeEvent` is the DOM event.

- In React 19, events it doesn't know ("close", "search") are attached as native listeners under the exact, case-sensitive name, so use `onclose` and `onsearch`.
- In React 18, listen to `change`, `close` and `search` on the element itself through the ref.
- In a project written in React, but aliased to _Preact_ at build time – types may confuse. Rely on runtime behaviour, rather than on Typescript errors.

### Preact and SolidJS
Nothing to do, everything just work.

### Vue
Vue template compiler treats unknown tags as Vue components by default. You must tell it to treat `<combo-box>`, `<box-option>` and `<box-tag>` tags as custom elements.

### Monorepos and microservices
The typings are part of a TypeScript program only if the program includes this package. 
A workspace package that renders `<combo-box>` but leaves the import to the app shell type-checks inside the app, 
but not on its own (its CI, editor, project references). 
Add a type-only import there - it's removed from the JS output, nothing is registered twice:
```ts
import type {} from 'html-combobox-element';
```
