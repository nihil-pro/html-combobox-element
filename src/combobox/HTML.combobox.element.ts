import { ComboboxMarkup } from './Combobox.markup.js'
import { HTMLComboboxOptionElement } from './HTML.combobox.option.element.js';
import { toBoolean } from './Boolean.attribute.value.normalizer.js';
import { HTMLComboboxTagElement } from './HTML.combobox.tag.element.js';


export class HTMLComboboxElement extends HTMLElement {
  static OWN_IDL = new Set(['required', 'disabled', 'clearable', 'multiple', 'filterable', 'searchable', 'value', 'placeholder', 'query'])
  static observerOptions = { childList: true };
  static styleSheet = [new CSSStyleSheet];
  static formAssociated = true;

  shadowRoot: ShadowRoot;
  #internals: ElementInternals & { states: Set<string> };

  #observer: MutationObserver;
  #markup: ComboboxMarkup;
  #values: Set<string> = new Set;
  #prevValue = '';
  #changed = false;


  constructor() {
    super();

    this.#internals = this.attachInternals() as ElementInternals & { states: Set<string> };
    this.#internals.role = "combobox";
    this.#internals.ariaHasPopup = "dialog";
    this.shadowRoot = this.attachShadow({ mode: 'open', delegatesFocus: true }); //delegatesFocus: true
    this.#markup = new ComboboxMarkup(this.shadowRoot, this.#internals);
    this.shadowRoot.appendChild(ComboboxMarkup.markup.content.cloneNode(true));
    this.shadowRoot.adoptedStyleSheets = HTMLComboboxElement.styleSheet;
    this.#observer = new MutationObserver(this.#onOptionsChanges);
    this.#markup.connect();

  }


  // Lifecycle callbacks
  connectedCallback() {
    for (const child of Array.from(this.children)) {
      if (HTMLComboboxElement.#isOptionLike(child)) {
        this.#markup.optionsContainer?.appendChild(child);
      }
    }
    this.#markup.onHostConnected();
    this.shadowRoot.addEventListener('optionselectedstatechange', this.#onOptionSelectedStateChanges);
    this.shadowRoot.addEventListener('tagcleared', this.#onClearTag);
    this.#initialAttributesSynchronization();
    this.#observer.observe(this.#markup.optionsContainer!, HTMLComboboxElement.observerOptions);
    this.addEventListener('keydown', this.#onKeyDown);
    this.#markup.clearAllButton!.addEventListener('click', this.#onClearAll);
    this.#markup.searchInput!.addEventListener('input', this.#onInput);
    this.#markup.dropdown!.addEventListener('toggle', this.#onPickerToggle);
    this.#setValidityAndFormValue();

    // Options/optgroups can end up as direct light-DOM children of <combo-box> without ever
    // going through insertBefore/appendChild below: parsed straight from static HTML markup,
    // or - notably - Solid's compiler, which renders static JSX subtrees via a single
    // <template> + cloneNode(true), never calling any child-mutation method at all. Sweep
    // whatever is already here once on connect and move it into the real options container.
  }

  static #isOptionLike(node: Node): node is HTMLComboboxOptionElement | HTMLOptGroupElement {
    return node instanceof HTMLComboboxOptionElement || node instanceof HTMLOptGroupElement;
  }

  // Overwritten child-mutation methods.
  //
  // <box-option>/<optgroup> children don't actually live under <combo-box> itself - they're
  // redirected into #markup.optionsContainer inside the shadow root, which is what the
  // dropdown renders from and what #observer watches. Every native method a framework's
  // renderer or plain user code might use to add/move/remove children needs to funnel through
  // the same redirect, since browsers implement each of these independently (overriding one,
  // e.g. insertBefore, does not make the others call it under the hood):
  //   - React calls appendChild for a plain append and insertBefore only when reordering.
  //   - Vue and Preact always call insertBefore, with a null reference for a plain append.
  //   - Solid mostly bypasses all of them for static subtrees (see connectedCallback above),
  //     but dynamic option lists still go through insert()/insertBefore().

  insertBefore = <T extends Node>(node: T, referenceNode: Node | null): T => {
    if (HTMLComboboxElement.#isOptionLike(node)) {
      this.#markup.optionsContainer?.insertBefore(node, referenceNode);
    } else {
      super.insertBefore(node, referenceNode);
    }
    return node;
  }

  appendChild = <T extends Node>(node: T): T => {
    if (HTMLComboboxElement.#isOptionLike(node)) {
      this.#markup.optionsContainer?.appendChild(node);
    } else {
      super.appendChild(node);
    }
    return node;
  }

  append = (...nodes: (Node | string)[]) => {
    nodes.forEach(node => this.appendChild(typeof node === 'string' ? new Text(node) : node));
  }

  prepend = (...nodes: (Node | string)[]) => {
    [...nodes].reverse().forEach(node => {
      const n = typeof node === 'string' ? new Text(node) : node;
      if (HTMLComboboxElement.#isOptionLike(n)) {
        this.#markup.optionsContainer?.insertBefore(n, this.#markup.optionsContainer.firstChild);
      } else {
        super.insertBefore(n, this.firstChild);
      }
    });
  }

  replaceChildren = (...nodes: (Node | string)[]) => {
    this.#markup.optionsContainer?.replaceChildren();
    super.replaceChildren();
    this.append(...nodes);
  }

  removeChild = <T extends Node>(child: T): T => {
    if (child.parentNode === this.#markup.optionsContainer) {
      this.#markup.optionsContainer!.removeChild(child);
    } else if (child.parentNode === this) {
      super.removeChild(child);
    }
    return child;
  }

  replaceChild = <T extends Node>(newChild: Node, oldChild: T): T => {
    if (oldChild.parentNode === this.#markup.optionsContainer) {
      this.#markup.optionsContainer!.replaceChild(newChild, oldChild);
    } else {
      super.replaceChild(newChild, oldChild);
    }
    return oldChild;
  }

  get changed() {
    return this.#changed;
  }

  disconnectedCallback() {
    this.#observer.disconnect();
    this.#markup.disconnect();
    this.removeEventListener('keydown', this.#onKeyDown);
    this.#markup.clearAllButton!.removeEventListener('click', this.#onClearAll);
    this.#markup.searchInput!.removeEventListener('input', this.#onInput);
    this.#markup.dropdown!.removeEventListener('toggle', this.#onPickerToggle);
    this.shadowRoot.removeEventListener('optionselectedstatechange', this.#onOptionSelectedStateChanges);
    this.shadowRoot.removeEventListener('tagcleared', this.#onClearTag);
  }

  formResetCallback() {
    this.selectedOptions.forEach(option => option.selected = false);
    this.#markup.tagsContainer?.replaceChildren();
    this.dispatchEvent(new Event('reset'));
    requestAnimationFrame(() => this.#markup.searchInput?.focus());
  }

  formDisabledCallback() {
    // toDo
    // when inside fieldset, this callback is only invoked for the first time
    // isDisabled: boolean
  }

  // Instance properties

  // <combo-box> specific properties
  get valueAsArray() {
    return Array.from(this.#values);
  }

  get query() {
    return this.getAttribute('query')!;
  }
  set query(value: string) {
    if (value === this.query) return;
    if (value == null) value = '';
    value = String(value);
    super.setAttribute('query', value);
    this.#markup?.setInputValue(value);
  }

  get placeholder() {
    return this.getAttribute('placeholder');
  }
  set placeholder(value) {
    if (value == null) value = ' ';
    value = String(value);
    super.setAttribute('placeholder', value);
    this.#markup?.setPlaceholder(value);
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
    value = toBoolean(value);
    super.toggleAttribute('disabled', value);
    super.toggleAttribute('inert', value);
  }

  get form() {
    return this.#internals.form;
  }

  get labels() {
    return this.#internals.labels;
  }

  get length() {
    return this.#markup.options!.length;
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
    const nextValues = new Set(value.split(',').filter(Boolean));
    this.#markup.options.forEach(option => {
      const optionValue = option.value!;
      // toggling `selected` drives #onOptionSelectedStateChanges, which is the
      // single source of truth for #values and tags - don't pre-assign #values
      // here, or the dedup logic there ends up deselecting the option it's in
      // the middle of selecting (see: stale tag left behind on next selection)
      option.selected = nextValues.has(optionValue);
    })
  }

  // Instance methods

  // <select> specific methods (implements HTMLSelectElement)

  // add()

  checkValidity() {
    this.#internals.checkValidity();
  }

  item(index: number) {
    return this.#markup.options!.item(index);
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


  #onOptionsChanges = (records: MutationRecord[]) => {
    records.forEach(record => {
      record.removedNodes.forEach(option => {
        if (option instanceof HTMLComboboxOptionElement) {

          const value = option.value!;



          // mode is searchable,
          // user type "a", select a result,
          // then types "b". Here previous options will be replaced with new ones,
          // this.#values may contain "a", but there is no relevant option yet,
          // so just wait
          if (this.searchable && this.#internals.ariaExpanded === 'true') {
            return;
          }
          // options was removed, but values still include this value,
          // just clear, this is like a reset was called
          if (this.#values.has(value) && !this.#markup.optionsContainer?.querySelector(`[value="${value}"]`)) {
            this.#values.delete(value);
            const control = this.#markup.getTagByValue(value);
            control?.remove();
          }
        }
      })
    });
  }


  #onOptionSelectedStateChanges = (event: Event) => {
    const option = event.target as HTMLComboboxOptionElement;
    const value = option.value!;

    if (option.selected) {
      if (!this.multiple) {
        this.#values.forEach(value => {
          const prevOption = this.#markup.getOptionByValue(value);
          if (prevOption) {
            prevOption.selected = false;
          } else {
            const tag = this.#markup.getTagByValue(value);
            this.#values.delete(value);
            tag?.remove()
          }
        })
      }

      if (!this.#values.has(value) || !this.#markup.getTagByValue(value)) {
        this.#values.add(value);
        this.#markup.createAndAppendTag(option);
        this.#setValidityAndFormValue();
        this.dispatchEvent(new Event('change'));
      }
    } else {
      if (this.#values.has(value)) {
        this.#values.delete(value);
        const control = this.#markup.getTagByValue(value);
        control?.remove();
        this.#setValidityAndFormValue();
        this.dispatchEvent(new Event('change'));
      } else {
        const tag = this.#markup.getTagByValue(value);
        tag?.remove()
      }
    }

  }


  #onClearTag = (event: Event) => {
    const target = event.target as HTMLComboboxTagElement | null;
    if (target) {
      const option = this.#markup.getOptionByValue(target.value);
      if (option) {
        option.selected = false;
      } else {
        const tag = this.#markup.getTagByValue(target.value);
        this.#values.delete(target.value);
        tag?.remove()
      }
      requestAnimationFrame(() => {
        if (this.#values.size) {
          this.focus();
        } else if (this.searchable || this.filterable) {
          this.#markup.searchInput?.focus()
        } else {
          this.focus()
        }
      })
    }
  }


  #onClearAll = () => {
    this.formResetCallback();
  }

  #onPickerToggle = (event: Event) => {
    const state = Reflect.get(event, 'newState');
    const oldState = Reflect.get(event, 'oldState');
    if (state === oldState) return;
    if (state === 'open') {
      this.#prevValue = this.value;
      this.#changed = true;
    } else {
      this.#changed = this.#prevValue !== this.value;
      this.dispatchEvent(new Event('close'));
    }
  }

  #onKeyDown = (event: KeyboardEvent) => {
    if (this.#internals.ariaExpanded !== 'true') return;

    const activeElement = this.shadowRoot.activeElement;
    if (!activeElement) {
      // ??? how we should react ???
      return;
    }

    if (activeElement === this.#markup.searchInput && event.key === 'Enter') {
      event.stopPropagation();
      if (!this.searchable && this.filterable) {
        console.log('sss')
        this.#markup.sort(this.#markup.searchInput!.value);
      }
      if (this.searchable) {
        this.dispatchEvent(new Event('search'))
      }
      return;
    }

    if (event.key === 'Enter' && activeElement instanceof HTMLComboboxOptionElement) {
      if (!activeElement.selected) {
        event.stopPropagation();
        return;
      }

    }

    if (event.key === 'Enter' && activeElement.part.contains('clear-tag')) {
      // @ts-ignore
      // this.#onClearTag(event);
      // event.stopPropagation();
      // event.preventDefault()
      // @ts-ignore
      activeElement.click()
      // event.stopPropagation();
      return;
    }

    if (event.key === 'Escape' || event.key === 'Enter') {
      this.#markup.closeDropdown()
      this.blur()
    }
  }

  #onInput = () => {

    this.query = this.#markup.searchInput!.value;
    if (!this.searchable && this.filterable) {
      this.#markup.sort(this.#markup.searchInput?.value || '');
    }
  }

  #setValidityAndFormValue() {
    this.#markup.clearAllButton?.toggleAttribute('disabled', !Boolean(this.#values.size));
    let empty = false;
    if (this.#values.size === 0) empty = true;

    if (this.#values.size > 0 && !this.clearable && !this.multiple && (this.searchable || this.filterable)) {
      empty = true;
    }
    this.#markup.searchInput?.toggleAttribute('autofocus', empty)
    this.#internals.setFormValue(this.value);
    if (this.required && this.value === '') {
      this.#internals.setValidity({ valueMissing: true }, 'Value missing');
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

document.addEventListener('keypress', () => {
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