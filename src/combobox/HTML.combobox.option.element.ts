import { toBoolean } from './Boolean.attribute.value.normalizer.js';

export class HTMLComboboxOptionElement extends HTMLElement {
  static OWN_IDL = new Set(['value', 'label', 'selected']);

  connectedCallback() {
    this.#initialAttributesSynchronization();
    this.part.add('option');
    super.setAttribute('tabindex', "0");
    super.setAttribute('role', "option");

    if (!this.value) {
      this.value = this.textContent;
    }
  }

  get value() {
    return this.getAttribute('value');
  }
  set value(value) {
    if (value == null) return;
    super.setAttribute('value', String(value));
  }

  get label() {
    return this.getAttribute('label');
  }
  set label(value) {
    if (value == null) return;
    super.setAttribute('label', String(value));
  }

  get selected() {
    return this.hasAttribute('selected')
  }
  set selected(value) {
    super.toggleAttribute('selected', toBoolean(value));
  }

  #initialAttributesSynchronization() {
    for (const key of HTMLComboboxOptionElement.OWN_IDL) {
      this[key] = this.getAttribute(key);
    }
  }

  setAttribute(name: string, value: string) {
    if (HTMLComboboxOptionElement.OWN_IDL.has(name)) {
      this[name] = value;
    } else {
      super.setAttribute(name, value);
    }
  }

  removeAttribute(name: string) {
    if (HTMLComboboxOptionElement.OWN_IDL.has(name)) {
      this[name] = null;
    } else {
      super.removeAttribute(name);
    }
  }
}

if (!window.customElements.get('box-option')) {
  window.customElements.define('box-option', HTMLComboboxOptionElement);
}