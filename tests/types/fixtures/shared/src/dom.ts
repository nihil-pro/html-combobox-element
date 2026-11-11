/**
 * Plain DOM typing: what `import 'html-combobox-element'` adds to the global scope, with no JSX.
 * Everything here must compile under every TypeScript version / moduleResolution in the matrix.
 */
import 'html-combobox-element';
import { HTMLComboboxElement, HTMLComboboxOptionsCollection } from 'html-combobox-element';
import type { Equal, Expect, IsAny } from './assert.js';

// --- Tag name map: createElement / querySelector know the custom elements ----------------------
const combobox = document.createElement('combo-box');
const option = document.createElement('box-option');
const tag = document.createElement('box-tag');
const found = document.querySelector('combo-box');

type _tagMap = [
  Expect<Equal<IsAny<typeof combobox>, false>>,
  Expect<Equal<typeof found, HTMLElementTagNameMap['combo-box'] | null>>,
  Expect<Equal<typeof combobox.valueAsArray, string[]>>,
  Expect<Equal<typeof combobox.multiple, boolean>>,
  Expect<Equal<typeof combobox.query, string>>,
  Expect<Equal<typeof combobox.placeholder, string>>,
  Expect<Equal<typeof combobox.clearable, boolean>>,
  Expect<Equal<typeof combobox.searchable, boolean>>,
  Expect<Equal<typeof combobox.filterable, boolean>>,
  Expect<Equal<typeof combobox.value, string>>,
  Expect<Equal<typeof option.value, string>>,
  Expect<Equal<typeof option.label, string>>,
];

// The HTMLSelectElement surface is inherited
combobox.selectedIndex = 0;
combobox.required = true;
combobox.setCustomValidity('pick one');
const firstSelected = combobox.selectedOptions[0];
type _selectedOptions = Expect<Equal<typeof firstSelected.value, string>>;
tag.part.add('x');

// @ts-expect-error boolean property
combobox.multiple = 'yes';
// @ts-expect-error valueAsArray is string[]
combobox.valueAsArray = 'a,b';

// --- addEventListener: `this` is the combobox for every overload ------------------------------
combobox.addEventListener('change', function () {
  // (read through a value: TS >= 6 doesn't apply the contextual `this` inside `typeof this`)
  const values = this.valueAsArray;
  type _this = Expect<Equal<typeof values, string[]>>;
});
// The component's own events are in ComboboxEventMap
for (const type of ['close', 'search', 'reset'] as const) {
  combobox.addEventListener(type, (event) => {
    type _e = Expect<Equal<typeof event, ComboboxEvent>>;
    const changed: boolean = event.target.changed;
  });
}
combobox.addEventListener('my-own-event', (event) => {
  // unknown names fall back to the string overload
  type _e = Expect<Equal<typeof event, Event>>;
});

// --- Global event interfaces are usable without importing them ---------------------------------
declare const changeEvent: ComboboxEvent;
declare const inputEvent: ComboboxInputEvent;
declare const focusEvent: ComboboxFocusEvent;
type _events = [
  Expect<Equal<typeof changeEvent.target.valueAsArray, string[]>>,
  Expect<Equal<typeof inputEvent.target.query, string>>,
  Expect<Equal<typeof inputEvent.data, string | null>>,
  Expect<Equal<typeof focusEvent.target.multiple, boolean>>,
];

// --- Runtime exports ----------------------------------------------------------------------------
declare const node: Element;
if (node instanceof HTMLComboboxElement) {
  // narrowing via the exported class
  type _narrowed = Expect<Equal<typeof node.valueAsArray, string[]>>;
  const options: HTMLComboboxOptionsCollection = node.options;
  options.add(document.createElement('box-option'));
}
const ctor: CustomElementConstructor | undefined = customElements.get('combo-box');

export { ctor };
