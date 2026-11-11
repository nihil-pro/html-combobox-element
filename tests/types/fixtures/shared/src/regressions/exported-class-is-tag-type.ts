/**
 * Was broken: two unrelated types share the name HTMLComboboxElement.
 *
 * `import { HTMLComboboxElement } from 'html-combobox-element'` is the class (with #private
 * members, so it's nominal), while `HTMLElementTagNameMap['combo-box']`, `event.target` etc. use
 * a module-private interface of the same name in index.d.ts. Values from the DOM can't be stored
 * in variables annotated with the exported type.
 * Fixed by: export the interface, plus a constructor value typed like lib.dom does it
 * (`{ prototype: HTMLComboboxElement; new(): HTMLComboboxElement }`) - same runtime class.
 */
import 'html-combobox-element';
import { HTMLComboboxElement } from 'html-combobox-element';
import type { Equal, Expect } from '../assert.js';

const fromDom: HTMLComboboxElement = document.createElement('combo-box');
const fromQuery: HTMLComboboxElement | null = document.querySelector('combo-box');
declare const event: ComboboxEvent;
const fromEvent: HTMLComboboxElement = event.target;

// The value is still the class: statics, instanceof narrowing, subclassing.
HTMLComboboxElement.loadCssFromUrls(['/combobox.css']);
const associated: boolean = HTMLComboboxElement.formAssociated;
const observed: string[] = HTMLComboboxElement.observedAttributes;
declare const node: Node;
if (node instanceof HTMLComboboxElement) {
  type _ = Expect<Equal<typeof node, HTMLElementTagNameMap['combo-box']>>;
}
class FancyCombobox extends HTMLComboboxElement {
  fancy() {
    return this.valueAsArray.length;
  }
}
const created: HTMLComboboxElement = new HTMLComboboxElement();
// @ts-expect-error private implementation details are not part of the public type
HTMLComboboxElement.prototype.connectedCallback;

export { fromDom, fromQuery, fromEvent, associated, observed, FancyCombobox, created };
