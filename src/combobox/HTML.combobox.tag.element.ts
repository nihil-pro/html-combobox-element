export class HTMLComboboxTagElement extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.part.add('tag');
    if (this.parentElement) {
      if (this.parentElement.hasAttribute('multiple')) {
        if (!this.querySelector('[part*="clear-tag"]')) {
          throw new Error(`A <button> with part="clear-tag" is required for <combo-box> with multiple attribute`);
        }
      }
    }
  }
}
if (!window.customElements.get('box-tag')) {
  window.customElements.define('box-tag', HTMLComboboxTagElement);
}