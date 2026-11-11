import { toBoolean } from './Boolean.attribute.value.normalizer.js';

/**
 * The `<option>` of `<combo-box>`.
 *
 * The browser only knows what `selected`/`disabled` mean on a native `<option>`, so the role and
 * both states are set through ElementInternals, and mirrored as `role`, `aria-selected` and
 * `aria-disabled` attributes. Internals are invisible from outside the element, so the attributes
 * are what tools reading the DOM (Playwright's getByRole, Testing Library, axe) can see.
 * Both say the same thing; for the browser an attribute takes precedence over internals.
 *
 * Attributes and properties:
 * - Setters (and the setAttribute/removeAttribute overrides that route to them) only normalize
 *   the value and write the attribute.
 * - attributeChangedCallback applies the side effects (state, ARIA, notifying the combobox).
 *   It's the one hook the browser calls for every way an attribute can change: the setters,
 *   the native Element.prototype methods, setAttributeNS/setAttributeNode, DevTools, and other
 *   JavaScript worlds (test runners, extensions) that can't see this class at all.
 */
export class HTMLComboboxOptionElement extends HTMLElement {
  static OWN_IDL = new Set(['value', 'label', 'selected', 'disabled']);
  static observedAttributes = ['selected', 'disabled'];
  static EventInit = { bubbles: true, cancelable: true, composed: true };

  #internals: ElementInternals;
  /** The states the side effects were last applied for (compared in attributeChangedCallback) */
  #applied = { selected: false, disabled: false };

  constructor() {
    super();
    this.#internals = this.attachInternals();
    this.#internals.role = 'option';
  }

  connectedCallback() {
    this.#initialAttributesSynchronization();
    this.part.add('option');
    // Focusable on click and from script (arrow keys), but not a tab stop: like native options,
    // the list is entered with the arrow keys from the combobox, not with Tab.
    if (!this.hasAttribute('tabindex')) super.setAttribute('tabindex', '-1');
    if (!this.hasAttribute('role')) super.setAttribute('role', 'option');
    this.#syncSelected(this.selected);
    this.#syncDisabled(this.disabled);

    // No label → value copy: like <option>, the value is the value attribute or the text.
    // (<box-option label="Plum"></box-option> displays its label through CSS, see the markup styles.)
    if (!this.textContent) this.textContent = this.getAttribute('value') ?? '';
    this.dispatchEvent(new Event('optionselectedstatechange', HTMLComboboxOptionElement.EventInit));
  }

  /** Like <option>: the value attribute, or the text when there is none */
  get value(): string {
    return this.getAttribute('value') ?? this.text;
  }
  set value(value) {
    if (value == null) return;
    super.setAttribute('value', String(value));
  }

  /** Like <option>: the label attribute when present, otherwise the text */
  get label(): string {
    return this.getAttribute('label') ?? this.text;
  }
  set label(value) {
    if (value == null) return;
    super.setAttribute('label', String(value));
  }

  /** Like <option>: the text content with whitespace stripped and collapsed */
  get text(): string {
    return (this.textContent ?? '').replace(/[\t\n\f\r ]+/g, ' ').trim();
  }
  set text(value: string) {
    this.textContent = value;
  }

  get selected() {
    return this.hasAttribute('selected')
  }
  // Normalization only: the side effects run in attributeChangedCallback
  set selected(value) {
    super.toggleAttribute('selected', toBoolean(value));
  }

  get disabled() {
    return this.hasAttribute('disabled')
  }
  set disabled(value) {
    super.toggleAttribute('disabled', toBoolean(value));
  }

  attributeChangedCallback(name: 'selected' | 'disabled', _oldValue: string | null, newValue: string | null) {
    // A path that skipped the setters can leave a value they'd never write, e.g. selected="false".
    // Fix it once: the removal calls back again with a valid value (which applies the change);
    // that removal is valid, so it isn't fixed again: no loop.
    if (newValue !== null && !toBoolean(newValue)) {
      super.removeAttribute(name);
      return;
    }
    const now = newValue !== null;
    // Compared with the state last applied, not with the old attribute value: after a fix-up
    // the old value is "false", which says nothing about what was applied before it.
    if (this.#applied[name] === now) return;
    if (name === 'selected') {
      this.#syncSelected(now);
      if (this.isConnected) {
        this.dispatchEvent(new Event('optionselectedstatechange', HTMLComboboxOptionElement.EventInit));
      }
    } else {
      this.#syncDisabled(now);
    }
  }

  #syncSelected(selected: boolean) {
    this.#applied.selected = selected;
    this.part.toggle('selected', selected);
    this.#syncAriaSelected();
  }

  // A disabled option stays in the accessibility tree (like a native disabled <option>), it is
  // only marked as disabled. `inert` would remove it from the tree altogether.
  #syncDisabled(disabled: boolean) {
    this.#applied.disabled = disabled;
    this.part.toggle('disabled', disabled);
    this.#internals.ariaDisabled = disabled ? 'true' : null;
    if (disabled) super.setAttribute('aria-disabled', 'true');
    else super.removeAttribute('aria-disabled');
    this.#syncAriaSelected();
  }

  // Like a native <option>: a disabled option that isn't selected isn't selectable, so it reports
  // no selected state at all (rather than selected=false).
  #syncAriaSelected() {
    const selected = this.selected;
    const ariaSelected = this.disabled && !selected ? null : String(selected);
    this.#internals.ariaSelected = ariaSelected;
    if (ariaSelected === null) super.removeAttribute('aria-selected');
    else super.setAttribute('aria-selected', ariaSelected);
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
    // value/label setters ignore null (like option.value = null they'd need a string), so remove directly
    if (name === 'selected' || name === 'disabled') {
      this[name] = false;
    } else {
      super.removeAttribute(name);
    }
  }
}

if (!window.customElements.get('box-option')) {
  window.customElements.define('box-option', HTMLComboboxOptionElement);
}
