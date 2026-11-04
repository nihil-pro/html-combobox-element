import { toBoolean } from './Boolean.attribute.value.normalizer.js';

export class HTMLComboboxOptionElement extends HTMLElement {
  static OWN_IDL = new Set(['value', 'label', 'selected', 'disabled']);
  static EventInit = { bubbles: true, cancelable: true, composed: true };

  // The browser only knows what `selected` means on a native <option>; here the state reaches assistive tech through internals.
  #internals = this.attachInternals();


  static captureFocus(event: FocusEvent) {
    if (event.relatedTarget && event.relatedTarget instanceof HTMLComboboxOptionElement) {
      event.stopPropagation();
      event.preventDefault();
    }
  }

  static onNavigate(event: KeyboardEvent) {
    if (
      !event.target ||
      !(event.target instanceof HTMLComboboxOptionElement) ||
      event.key === 'Tab' ||
      event.key === 'Enter'
    ) return;
    event.preventDefault();
    if (event.key === 'ArrowDown') {
      const next = event.target.nextElementSibling;
      if (next && next instanceof HTMLComboboxOptionElement) {
        next.focus();
      }
    }

    if (event.key === 'ArrowUp') {
      const prev = event.target.previousElementSibling;
      if (prev && prev instanceof HTMLComboboxOptionElement) {
        prev.focus();
      }
    }
  }


  connectedCallback() {

    this.addEventListener('keydown', HTMLComboboxOptionElement.onNavigate);
    this.addEventListener('focusout', HTMLComboboxOptionElement.captureFocus);
    this.addEventListener('click', this.#toggleSelection);

    this.#initialAttributesSynchronization();
    this.part.add('option');
    super.setAttribute('tabindex', "0");
    super.setAttribute('role', "option");
    this.#internals.ariaSelected = String(this.selected);

    if (!this.value) this.value = this.label;
    if (!this.textContent) this.textContent = this.value;
    this.dispatchEvent(new Event('optionselectedstatechange', HTMLComboboxOptionElement.EventInit));
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.#toggleSelection);
    this.removeEventListener('keydown', HTMLComboboxOptionElement.onNavigate);
    this.removeEventListener('focusout', HTMLComboboxOptionElement.captureFocus);
  }

  #toggleSelection = (event: Event) => {
    event.stopPropagation();
    this.selected = !this.selected;
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
    const prev = this.selected;
    const force = toBoolean(value);
    if (prev === force) {
      return;
    }

    super.toggleAttribute('selected', force);
    this.part.toggle('selected', force);
    this.#internals.ariaSelected = String(force);
    // console.log('this.isConnected', this.isConnected)
    if (this.isConnected) {
      this.dispatchEvent(new Event('optionselectedstatechange', HTMLComboboxOptionElement.EventInit));
    }
  }


  get disabled() {
    return this.hasAttribute('disabled')
  }
  set disabled(value) {
    const force = toBoolean(value);
    super.toggleAttribute('disabled', force);
    this.part.toggle('disabled', force);
    super.toggleAttribute('inert', force)
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

  toggleAttribute(name: string, force?: boolean): boolean {
    const result = super.toggleAttribute(name, force);
    if (name === 'selected') {
      this.part.toggle(name, result);
      this.#internals.ariaSelected = String(result);
    }
    return result;
  }
}

if (!window.customElements.get('box-option')) {
  window.customElements.define('box-option', HTMLComboboxOptionElement);
}