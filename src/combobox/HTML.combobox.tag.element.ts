/**
 * A selected value shown inside `<combo-box>`. The tags are exposed as a list of items,
 * each with a "Remove …" button when the combobox is `clearable` or `multiple`.
 */
export class HTMLComboboxTagElement extends HTMLElement {
  static EventInit = { bubbles: true, cancelable: true, composed: true };

  #internals: ElementInternals;

  constructor() {
    super();
    this.#internals = this.attachInternals();
    this.#internals.role = 'listitem';
  }

  get value() {
    return this.getAttribute('value') || '';
  }

  get #control() {
    return this.querySelector('[part*="clear-tag"]') as HTMLElement | null;
  }

  connectedCallback() {
    this.part.add('tag');

    const control = this.#control;
    if (control && !(control instanceof HTMLButtonElement)) {
      // A non-native button (e.g. <div part="clear-tag">) needs the button semantics and focusability added
      if (!control.hasAttribute('role')) control.setAttribute('role', 'button');
      if (!control.hasAttribute('tabindex')) control.setAttribute('tabindex', '0');
    }
    control?.addEventListener('click', HTMLComboboxTagElement.onClearTag);
    control?.addEventListener('keydown', HTMLComboboxTagElement.onControlKeyDown);
    const root = this.getRootNode() as ShadowRoot | undefined;
    if (root?.host?.hasAttribute('multiple')) {
      if (!control) {
        throw new Error(`A <button> with part="clear-tag" is required for <combo-box> with multiple attribute`);
      }
    }
  }

  disconnectedCallback() {
    const control = this.#control;
    control?.removeEventListener('click', HTMLComboboxTagElement.onClearTag);
    control?.removeEventListener('keydown', HTMLComboboxTagElement.onControlKeyDown);
  }

  static onClearTag(event: Event) {
    const control = event.currentTarget as Element | null;
    control?.closest('box-tag')?.dispatchEvent(new Event('tagcleared', HTMLComboboxTagElement.EventInit))
  }

  // role="button" on a non-<button> doesn't give it keyboard activation, add it.
  static onControlKeyDown(event: KeyboardEvent) {
    const control = event.currentTarget as HTMLElement;
    if (control instanceof HTMLButtonElement) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      control.click();
    }
  }
}

if (!window.customElements.get('box-tag')) {
  window.customElements.define('box-tag', HTMLComboboxTagElement);
}
