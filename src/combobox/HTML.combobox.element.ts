import { ComboboxMarkup } from './Combobox.markup.js'
import { HTMLComboboxOptionElement } from './HTML.combobox.option.element.js';
import { toBoolean } from './Boolean.attribute.value.normalizer.js';
import { HTMLComboboxTagElement } from './HTML.combobox.tag.element';

export class HTMLComboboxElement extends HTMLElement {
  static OWN_IDL = new Set(['required', 'disabled', 'clearable', 'multiple', 'filterable', 'searchable', 'value', 'placeholder', 'query'])
  static observerOptions = { childList: true, attributes: false, subtree: false };
  static styleSheet = [new CSSStyleSheet];
  static formAssociated = true;

  shadowRoot: ShadowRoot;
  #internals: ElementInternals;

  #observer: MutationObserver;
  #markup: ComboboxMarkup;
  #values: Set<string> = new Set;

  constructor() {
    super();
    this.#internals = this.attachInternals();
    this.#internals.role = "combobox";
    this.#internals.ariaHasPopup = "dialog";
    this.shadowRoot = this.attachShadow({ mode: 'closed', delegatesFocus: true });
    this.#markup = new ComboboxMarkup(this.shadowRoot, this.#internals);
    this.shadowRoot.innerHTML = ComboboxMarkup.template;
    this.shadowRoot.adoptedStyleSheets = HTMLComboboxElement.styleSheet;
    this.#observer = new MutationObserver(this.#onOptionsChanges);
  }

  // Lifecycle callbacks
  connectedCallback() {
    this.#markup.connect();
    this.#initialAttributesSynchronization();
    this.#onOptionsChanges([{ addedNodes: Array.from(this.children) }] as unknown as MutationRecord[]);
    this.#observer.observe(this, HTMLComboboxElement.observerOptions);
    this.#markup.clearAllButton.addEventListener('click', this.#onClear);
    this.#markup.searchInput.addEventListener('input', this.#onInput);
  }

  disconnectedCallback() {
    this.#observer.disconnect();
    this.#markup.disconnect();
    this.#markup.clearAllButton.removeEventListener('click', this.#onClear);
    this.#markup.searchInput.removeEventListener('input', this.#onInput);
  }

  formResetCallback() {
    this.#values = new Set;
    this.selectedOptions.forEach(option => option.selected = false);
    this.#markup.tagsContainer.replaceChildren();
    this.#setValidityAndFormValue();
    this.dispatchEvent(new Event('change'));
  }

  formDisabledCallback(isDisabled: boolean) {
    this.disabled = isDisabled;
  }

  // Instance properties

  // <combo-box> specific properties
  get valueAsArray() {
    return Array.from(this.#values);
  }

  get query() {
    return this.getAttribute('query');
  }
  set query(value: string) {
    if (value === this.query) return;
    if (value == null) value = '';
    value = String(value);
    super.setAttribute('query', value);
    if (this.#markup.connected) {
      this.#markup.searchInput.value = value;
    }
  }

  get placeholder() {
    return this.getAttribute('placeholder');
  }
  set placeholder(value) {
    if (value == null) value = ' ';
    value = String(value);
    super.setAttribute('placeholder', value);
    if (this.#markup.connected) {
      this.#markup.placeholder.innerText = value;
      this.#markup.searchInput.placeholder = value;
    }
  }

  get clearable() {
    return this.hasAttribute('clearable');
  }
  set clearable(value) {
    super.toggleAttribute('clearable', toBoolean(value));
  }

  get filterable() {
    return this.hasAttribute('filterable');
  }
  set filterable(value) {
    super.toggleAttribute('filterable', toBoolean(value));
  }

  get searchable() {
    return this.hasAttribute('searchable');
  }
  set searchable(value) {
    super.toggleAttribute('searchable', toBoolean(value));
  }

  // <select> specific properties (implements HTMLSelectElement)
  get disabled() {
    return this.hasAttribute('disabled');
  }
  set disabled(value) {
    this.#internals.ariaDisabled = String(value);
    super.toggleAttribute('disabled', toBoolean(value));
  }

  get form() {
    return this.#internals.form;
  }

  get labels() {
    return this.#internals.labels;
  }

  get length() {
    return this.#markup.options.length;
  }

  get multiple() {
    return this.hasAttribute('multiple');
  }
  set multiple(value) {
    super.toggleAttribute('multiple', toBoolean(value));
  }

  // get options
  // (there is no constructor of HTMLOptionsCollection, need to implement)

  get required() {
    return this.hasAttribute('required');
  }
  set required(value) {
    this.#internals.ariaRequired = String(value);
    super.toggleAttribute('required', toBoolean(value));
  }

  // selected index is part of HTMLOptionsCollection, see option above

  get selectedOptions() {
    return this.#markup.selectedOptions;
  }

  // get/set size
  // for the original select, this is the same as rowsCount of textarea
  // probably, there are no reasons to this one, but it should be implemented for interface compatibility

  get type() {
    return this.multiple ? "select-multiple" : "select-one";
  }

  get validationMessage() {
    return this.#internals.validationMessage;
  }

  get validity() {
    return this.#internals.validity;
  }

  get willValidate() {
    return this.#internals.willValidate;
  }

  get value() {
    return this.valueAsArray.join(',');
  }
  set value(value: string) {
    if (this.value === value || typeof value !== 'string') return;
    const prevValue: Set<string> = new Set(this.#values);
    this.#values = new Set;

    const values = value.split(',').filter(Boolean);

    Promise.resolve(values)
      .then(values => {
        if (values.length) {
          if (!this.multiple) {
            if (this.#values.size === 0) {
              values.length = 1;
            } else {
              values.length = 0;
            }
          }

          for (const key of values) {
            const option = this.#markup.getOptionByValue(key);
            if (option) this.#selectOption(option);
          }
        }

        for (const key of prevValue) {
          if (this.#values.has(key)) continue;
          const option = this.#markup.getOptionByValue(key);
          const tag = this.#markup.getTagByValue(key);
          tag?.remove();
          option?.toggleAttribute('selected', false);
        }
      })
  }

  // Instance methods

  // <select> specific methods (implements HTMLSelectElement)

  // add()

  checkValidity() {
    this.#internals.checkValidity();
  }

  item(index: number) {
    return this.#markup.options.item(index);
  }

  // namedItem()

  // !!! Conflicts with node.remove()
  // remove(index: number)

  reportValidity() {
    this.#internals.reportValidity();
  }

  setCustomValidity(message: string) {
    if (message === '') {
      this.#internals.setValidity({});
    } else {
      this.#internals.setValidity({ customError: true }, message);
    }
  }

  showPicker() {
    this.#markup.showDropdown();
  }

  // Overwritten methods
  setAttribute(name: string, value: any) {
    if (HTMLComboboxElement.OWN_IDL.has(name)) {
      Reflect.set(this, name, value);
    } else {
      super.setAttribute(name, value);
    }
  }

  removeAttribute(name: string) {
    if (HTMLComboboxElement.OWN_IDL.has(name)) {
      Reflect.set(this, name, false);
    } else {
      super.removeAttribute(name);
    }
  }

  // Internal
  #onInput = (event: InputEvent) => {
    if (!this.searchable && this.filterable) {
      if (event.target && event.target instanceof HTMLInputElement) {
        this.#markup.sort(event.target.value);
      }
    }
  }

  #onOptionsChanges = (records: MutationRecord[]) => {
    records.forEach(record => {
      record.addedNodes.forEach(node => {
        if (node instanceof HTMLComboboxOptionElement) {
          node.addEventListener('click', this.#onSelectOption);
          if (node.selected) {
            if (this.multiple) {
              this.#selectOption(node);
            } else if (this.#values.size === 0) {
              this.#selectOption(node);
            }
          }
        }
        if (node instanceof HTMLComboboxOptionElement || node instanceof HTMLOptGroupElement) {
          this.#markup.optionsContainer.append(node);
        }
      })
    });
    this.#markup.invalidateOptionsCache();
    this.#setValidityAndFormValue();
  }

  #selectOption(option: HTMLComboboxOptionElement) {
    if (this.#values.has(option.value)) return;
    const value = option.value;
    this.#values.add(value);
    option.toggleAttribute('selected', true);
    const control = this.#markup.createAndAppendTag(option);
    control?.addEventListener('click', this.#onClearTag);
    if (!this.multiple) {
      this.#markup.closeDropdown()
    }
  }

  #onSelectOption = (event: PointerEvent) => {
    const target = event.target as HTMLElement | null;
    if (target) {
      const option = target.closest<HTMLComboboxOptionElement>('box-option');
      if (option) {
        if (this.#values.has(option.value)) return;
        if (!this.multiple) {
          event.stopPropagation();
          this.#values.forEach(value => {
            this.#markup.getTagByValue(value)?.remove();
            this.#markup.getOptionByValue(value)?.toggleAttribute('selected', false);
          })
          this.#values.clear();
          this.#markup.tagsContainer.replaceChildren();
        }
        this.#selectOption(option);
        this.#setValidityAndFormValue();
        this.dispatchEvent(new Event('change'));
      }
    }
  }

  #onClearTag = (event: PointerEvent) => {
    const target = event.target as HTMLElement | null;
    if (target) {
      const tag = target.closest<HTMLComboboxTagElement>('box-tag');
      if (tag) {
        const value = tag.getAttribute('value');
        const option = this.#markup.getOptionByValue(value);
        option.removeAttribute('selected');
        this.#values.delete(value);
        tag.remove();
        this.#setValidityAndFormValue();
        this.dispatchEvent(new Event('change'));
      }
    }
  }

  #onClear = () => {
    this.formResetCallback();
  }

  #setValidityAndFormValue() {
    this.#internals.setFormValue(this.value);
    if (this.required && this.value === '') {
      this.#internals.setValidity({ valueMissing: true });
    } else {
      this.#internals.setValidity({ });
    }
  }

  #initialAttributesSynchronization() {
    for (const key of HTMLComboboxElement.OWN_IDL) {
      this[key] = this.getAttribute(key);
    }
  }

  static loadCssFromUrls(urls: string[]) {
    ComboboxMarkup.importCSS(urls);
  }

  static loadCssFromDocumentStyleSheets() {
    if (document.readyState === 'complete') {
      HTMLComboboxElement.#loadDocumentStyleSheets();
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', HTMLComboboxElement.#loadDocumentStyleSheets)
    }
    if (document.readyState === 'interactive') {
      queueMicrotask(HTMLComboboxElement.#loadDocumentStyleSheets);
    }
  }

  static #loadDocumentStyleSheets() {
    const [innerSheet] = HTMLComboboxElement.styleSheet;
    for (const outerSheet of document.styleSheets) {
      for (const rule of outerSheet.cssRules) {
        innerSheet.insertRule(rule.cssText, innerSheet.cssRules.length)
      }
    }
  }
}

document.addEventListener('keypress', (event) => {
  if (document.activeElement instanceof HTMLComboboxElement) {
    const maybeHost = document.activeElement.shadowRoot.activeElement;
    if (maybeHost instanceof HTMLComboboxOptionElement) {
      maybeHost.click();
    }
  }
})

if (!window.customElements.get('combo-box')) {
  window.customElements.define('combo-box', HTMLComboboxElement);
}
