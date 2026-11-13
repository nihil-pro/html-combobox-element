/**
 * The element types are global, like lib.dom's (`HTMLSelectElement`): usable without importing.
 * Note: no type import below - only the side-effect import that registers the elements.
 */
import 'html-combobox-element';
import type { Equal, Expect } from './assert.js';

const combobox: HTMLComboboxElement = document.createElement('combo-box');
const option: HTMLComboboxOptionElement = document.createElement('box-option');
const tag: HTMLComboboxTagElement = document.createElement('box-tag');
const found: HTMLComboboxElement | null = document.querySelector('combo-box');
const eventType: keyof ComboboxEventMap = 'search';

type _ = [
  // one type under every name
  Expect<Equal<HTMLComboboxElement, HTMLElementTagNameMap['combo-box']>>,
  Expect<Equal<HTMLComboboxElement, import('html-combobox-element').HTMLComboboxElement>>,
  Expect<Equal<HTMLComboboxOptionElement, HTMLElementTagNameMap['box-option']>>,
  Expect<Equal<HTMLComboboxTagElement, HTMLElementTagNameMap['box-tag']>>,
  Expect<Equal<ComboboxEventMap['change'], ComboboxEvent>>,
  Expect<Equal<typeof option.disabled, boolean>>,
  Expect<Equal<typeof option.selected, boolean>>,
];

combobox.addEventListener(eventType, (event) => event.target.query);

export { combobox, option, tag, found };
