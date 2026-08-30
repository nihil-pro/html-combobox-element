export class HTMLComboboxTagElement extends HTMLElement {
  static EventInit = { bubbles: true, cancelable: true, composed: true };

  get value() {
    return this.getAttribute('value') || '';
  }

  connectedCallback() {
    this.part.add('tag');

    const control = this.querySelector('[part*="clear-tag"]') as Element | null;
    if (!this.hasAttribute('visible')) {
      super.setAttribute('tabindex', '0')
    }
    control?.addEventListener('focusout', HTMLComboboxTagElement.captureFocus);
    control?.addEventListener('click', HTMLComboboxTagElement.onClearTag);
    const root = this.getRootNode() as ShadowRoot | undefined;
    if (root?.host.hasAttribute('multiple')) {
      if (!control) {
        throw new Error(`A <button> with part="clear-tag" is required for <combo-box> with multiple attribute`);
      }
    }
  }

  disconnectedCallback() {
    const control = this.querySelector('[part*="clear-tag"]') as Element | null;
    control?.removeEventListener('focusout', HTMLComboboxTagElement.captureFocus);
    control?.removeEventListener('click', HTMLComboboxTagElement.onClearTag);
  }

  static onClearTag(event: Event) {
    const target = event.target as Element | null;
    target?.parentElement?.dispatchEvent(new Event('tagcleared', HTMLComboboxTagElement.EventInit))
  }

  static captureFocus(event: Event) {
    event.stopPropagation();
    event.preventDefault();
  }
}

if (!window.customElements.get('box-tag')) {
  window.customElements.define('box-tag', HTMLComboboxTagElement);
}