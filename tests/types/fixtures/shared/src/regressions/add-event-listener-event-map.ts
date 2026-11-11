/**
 * Was broken: `ComboboxEventMap` is unreachable from addEventListener.
 *
 * The HTMLElementEventMap overload is declared first, and every key of ComboboxEventMap
 * ('change', 'input', 'focus', ...) is also a key of HTMLElementEventMap, so overload resolution
 * always stops at the first overload and the listener gets a plain `Event` (target: EventTarget | null).
 * Fixed by: declare the ComboboxEventMap overload first (it already extends HTMLElementEventMap).
 */
import 'html-combobox-element';
import type { Equal, Expect } from '../assert.js';

const combobox = document.createElement('combo-box');

combobox.addEventListener('change', (event) => {
  type _ = Expect<Equal<typeof event.target.valueAsArray, string[]>>;
});
combobox.addEventListener('input', (event) => {
  type _ = [Expect<Equal<typeof event, ComboboxInputEvent>>, Expect<Equal<typeof event.target.query, string>>];
});
combobox.addEventListener('focus', (event) => {
  type _ = Expect<Equal<typeof event, ComboboxFocusEvent>>;
});
