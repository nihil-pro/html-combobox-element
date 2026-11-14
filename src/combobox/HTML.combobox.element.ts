import { ComboboxMarkup } from './Combobox.markup.js'
import { HTMLComboboxOptionElement } from './HTML.combobox.option.element.js';
import { propertyToBoolean, toBoolean } from './Boolean.attribute.value.normalizer.js';
import { HTMLComboboxTagElement } from './HTML.combobox.tag.element.js';
import { HTMLComboboxOptionsCollection } from './HTML.combobox.options.collection.js';


export class HTMLComboboxElement extends HTMLElement {
  static OWN_IDL = new Set(['required', 'disabled', 'clearable', 'multiple', 'filterable', 'searchable', 'value', 'placeholder', 'query'])
  // Setters (and the setAttribute/removeAttribute overrides routed to them) only normalize and write
  // the attribute; attributeChangedCallback applies the side effects, whatever changed the attribute
  // (setters, native Element.prototype methods, DevTools, other JavaScript worlds).
  static observedAttributes = [...HTMLComboboxElement.OWN_IDL];
  static #BOOLEAN_ATTRIBUTES = new Set(['required', 'disabled', 'clearable', 'multiple', 'filterable', 'searchable']);
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
  /** Disabled by an ancestor <fieldset disabled> (see formDisabledCallback) */
  #formDisabled = false;
  /** Whether aria-disabled on the host was set by the component (see #applyDisabledState) */
  #ariaDisabledMirrored = false;
  #options: HTMLComboboxOptionsCollection | null = null;
  #typeahead = '';
  #typeaheadTimer: any = undefined;


  constructor() {
    super();

    this.#internals = this.attachInternals() as ElementInternals & { states: Set<string> };
    this.#internals.role = "combobox";
    // The host itself takes focus (like a native <select>), so assistive technology reports the
    // focused combobox with its name and value. Inner controls (tag buttons, search field, options)
    // are focused explicitly. With delegatesFocus the focus would land on an inner element instead.
    this.shadowRoot = this.attachShadow({ mode: 'open' });
    this.#markup = new ComboboxMarkup(this.shadowRoot, this.#internals);
    this.shadowRoot.appendChild(ComboboxMarkup.markup.content.cloneNode(true));
    this.shadowRoot.adoptedStyleSheets = HTMLComboboxElement.styleSheet;
    this.#observer = new MutationObserver(this.#onOptionsChanges);
    this.#markup.connect();
    this.#syncPopupSemantics();
  }

  /** Texts used only by assistive technology, override them to localize. */
  static get strings() {
    return ComboboxMarkup.strings;
  }


  // Lifecycle callbacks
  connectedCallback() {
    // Listen before sweeping the options in: a moved option reconnects and reports its `selected`
    // state, which is how options pre-selected in the markup become the initial value.
    this.shadowRoot.addEventListener('optionselectedstatechange', this.#onOptionSelectedStateChanges);
    this.shadowRoot.addEventListener('tagcleared', this.#onClearTag);
    this.shadowRoot.addEventListener('click', this.#onOptionClick, true);
    for (const child of Array.from(this.children)) {
      if (HTMLComboboxElement.#isOptionLike(child)) {
        this.#markup.optionsContainer?.appendChild(child);
      }
    }
    this.#syncOptgroups();
    this.#markup.onHostConnected();
    if (!this.hasAttribute('tabindex')) super.setAttribute('tabindex', '0');
    // Mirrors the internals role, so tools that only read attributes (Playwright's getByRole,
    // Testing Library) find the combobox too. The states stay in internals only.
    if (!this.hasAttribute('role')) super.setAttribute('role', 'combobox');
    this.#initialAttributesSynchronization();
    this.#observer.observe(this.#markup.optionsContainer!, HTMLComboboxElement.observerOptions);
    this.addEventListener('keydown', this.#onKeyDown);
    this.addEventListener('click', this.#onHostClick);
    this.#markup.clearAllButton!.addEventListener('click', this.#onClearAll);
    this.#markup.searchInput!.addEventListener('input', this.#onInput);
    this.#markup.dropdown!.addEventListener('toggle', this.#onPickerToggle);
    this.#applyDisabledState();
    this.#syncPopupSemantics();
    this.#setValidityAndFormValue();

    // Options/optgroups can end up as direct light-DOM children of <combo-box> without ever
    // going through insertBefore/appendChild below: parsed straight from static HTML markup,
    // or - notably - Solid's compiler, which renders static JSX subtrees via a single
    // <template> + cloneNode(true), never calling any child-mutation method at all. Sweep
    // whatever is already here once on connect and move it into the real options container.
  }

  // Matched by name too: content created with innerHTML connects <combo-box> before its
  // <box-option> children are upgraded, so they aren't instances of the class yet.
  static #isOptionLike(node: Node): node is HTMLComboboxOptionElement | HTMLOptGroupElement {
    return node instanceof HTMLComboboxOptionElement || node instanceof HTMLOptGroupElement
      || (node instanceof Element && node.localName === 'box-option');
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
    this.removeEventListener('click', this.#onHostClick);
    this.#markup.clearAllButton!.removeEventListener('click', this.#onClearAll);
    this.#markup.searchInput!.removeEventListener('input', this.#onInput);
    this.#markup.dropdown!.removeEventListener('toggle', this.#onPickerToggle);
    this.shadowRoot.removeEventListener('optionselectedstatechange', this.#onOptionSelectedStateChanges);
    this.shadowRoot.removeEventListener('tagcleared', this.#onClearTag);
    this.shadowRoot.removeEventListener('click', this.#onOptionClick, true);
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
    if (oldValue === newValue || !this.#markup) return;
    // A path that skipped the setters can leave e.g. multiple="false": fix it once. The removal
    // calls back again with a valid value, which applies the change; that one isn't fixed again,
    // so this can't loop. The side effects below are safe to repeat.
    if (HTMLComboboxElement.#BOOLEAN_ATTRIBUTES.has(name) && newValue !== null && !toBoolean(newValue)) {
      super.removeAttribute(name);
      return;
    }
    switch (name) {
      case 'required':
        this.#internals.ariaRequired = newValue !== null ? 'true' : null;
        if (this.isConnected) this.#setValidityAndFormValue();
        break;
      case 'disabled':
        if (this.isConnected) this.#applyDisabledState();
        break;
      case 'clearable':
      case 'multiple':
      case 'filterable':
      case 'searchable':
        this.#syncPopupSemantics();
        break;
      case 'placeholder':
        this.#markup.setPlaceholder(newValue ?? '');
        break;
      case 'query':
        this.#markup.setInputValue(newValue ?? '');
        break;
      case 'value':
        // The value attribute is an initial value: the value setter doesn't write it back.
        // Changed from outside the setter (natively, DevTools), apply it.
        if (newValue !== null) this.value = newValue;
        break;
    }
  }

  formResetCallback() {
    this.selectedOptions.forEach(option => option.selected = false);
    this.#values.clear();
    this.#markup.tagsContainer?.replaceChildren();
    this.#setValidityAndFormValue();
    this.dispatchEvent(new Event('reset'));
  }

  formDisabledCallback(disabled: boolean) {
    this.#formDisabled = disabled;
    this.#applyDisabledState();
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
  }

  get placeholder() {
    return this.getAttribute('placeholder');
  }
  set placeholder(value) {
    if (value == null) value = ' ';
    value = String(value);
    super.setAttribute('placeholder', value);
  }

  get clearable() {
    return this.hasAttribute('clearable');
  }
  set clearable(value) {
    super.toggleAttribute('clearable', propertyToBoolean(value));
  }

  get filterable() {
    return this.hasAttribute('filterable');
  }
  set filterable(value) {
    super.toggleAttribute('filterable', propertyToBoolean(value));
  }

  get searchable() {
    return this.hasAttribute('searchable');
  }
  set searchable(value) {
    super.toggleAttribute('searchable', propertyToBoolean(value));
  }

  // <select> specific properties (implements HTMLSelectElement)
  get disabled() {
    return this.hasAttribute('disabled');
  }
  set disabled(value) {
    super.toggleAttribute('disabled', propertyToBoolean(value));
  }

  get form() {
    return this.#internals.form;
  }

  get labels() {
    return this.#internals.labels;
  }

  get length() {
    return this.options.length;
  }
  /** Like `select.length = n`: appends blank options, or removes the last ones */
  set length(value: number) {
    this.options.length = value;
  }

  get multiple() {
    return this.hasAttribute('multiple');
  }
  set multiple(value) {
    super.toggleAttribute('multiple', propertyToBoolean(value));
  }

  /** The options, as a live `HTMLOptionsCollection`-like list (like `select.options`) */
  get options(): HTMLComboboxOptionsCollection {
    this.#options ??= new HTMLComboboxOptionsCollection({
      container: () => this.#markup.optionsContainer!,
      options: () => this.#markup.options,
    });
    return this.#options;
  }

  get required() {
    return this.hasAttribute('required');
  }
  set required(value) {
    super.toggleAttribute('required', propertyToBoolean(value));
  }

  /** Index of the first selected option, or -1. Setting it selects only that option. */
  get selectedIndex() {
    return this.options.selectedIndex;
  }
  set selectedIndex(value: number) {
    this.options.selectedIndex = value;
  }

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
  // Like select.value: null/undefined clear the selection, anything else is converted to a string
  // (42 selects the option with value "42"); a value no option has clears the selection.
  // Comma-separated values select several options.
  set value(value: string | null | undefined) {
    const next = value == null ? '' : String(value);
    if (this.value === next) return;
    const nextValues = new Set(next.split(',').filter(Boolean));
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

  /** Like `select.add()`: inserts an option or optgroup before `before` (an element or an index), or at the end */
  add(element: HTMLComboboxOptionElement | HTMLOptGroupElement, before?: HTMLElement | number | null) {
    this.options.add(element, before);
  }

  checkValidity() {
    return this.#internals.checkValidity();
  }

  item(index: number) {
    return this.options.item(index);
  }

  /** The first option whose `id` or `name` attribute is `name` */
  namedItem(name: string) {
    return this.options.namedItem(name);
  }

  /**
   * Overloaded like `select.remove()`: without an argument removes the combobox itself
   * (`Element.remove()`), with an index removes that option.
   */
  remove(): void;
  remove(index: number): void;
  remove(...args: [] | [number]) {
    if (args.length === 0) {
      super.remove();
    } else {
      this.options.remove(args[0]);
    }
  }

  reportValidity() {
    return this.#internals.reportValidity();
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

  /** Closes the dropdown, if open */
  hidePicker() {
    this.#markup.closeDropdown();
  }

  // Overwritten methods
  setAttribute(name: string, value: any) {
    if (HTMLComboboxElement.OWN_IDL.has(name)) {
      // through the setter, with attribute semantics: setAttribute('multiple', '') turns it on
      Reflect.set(this, name, HTMLComboboxElement.#BOOLEAN_ATTRIBUTES.has(name) ? toBoolean(value) : value);
    } else {
      super.setAttribute(name, value);
    }
  }

  removeAttribute(name: string) {
    if (HTMLComboboxElement.#BOOLEAN_ATTRIBUTES.has(name)) {
      Reflect.set(this, name, false);
    } else if (name === 'placeholder' || name === 'query') {
      Reflect.set(this, name, null);
    } else {
      // includes `value`: the attribute is only an initial value, removing it keeps the selection
      super.removeAttribute(name);
    }
  }

  // Internal


  #onOptionsChanges = (records: MutationRecord[]) => {
    this.#syncOptgroups();
    this.#markup.syncValueText();
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
          if (this.#values.has(value) && !this.#markup.getOptionByValue(value)) {
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
          // The same option can report its state more than once (moved, upgraded): never deselect it
          if (value === option.value) return;
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
      }
    } else {
      if (this.#values.has(value)) {
        this.#values.delete(value);
        const control = this.#markup.getTagByValue(value);
        control?.remove();
        this.#setValidityAndFormValue();
      } else {
        const tag = this.#markup.getTagByValue(value);
        tag?.remove()
      }
    }

  }


  #onClearTag = (event: Event) => {
    const target = event.target as HTMLComboboxTagElement | null;
    if (!target) return;
    const tags = Array.from(this.#markup.tagsContainer?.querySelectorAll<HTMLComboboxTagElement>('box-tag') ?? []);
    const index = tags.indexOf(target);
    this.#asUserAction(() => {
      const option = this.#markup.getOptionByValue(target.value);
      if (option) {
        option.selected = false;
      } else {
        const tag = this.#markup.getTagByValue(target.value);
        this.#values.delete(target.value);
        tag?.remove();
        this.#setValidityAndFormValue();
      }
    });
    // Keep the keyboard user where they were: on the next remaining tag's button,
    // otherwise on the search field (when it's shown) or on the combobox itself.
    const remaining = Array.from(this.#markup.tagsContainer?.querySelectorAll<HTMLElement>('[part*="clear-tag"]') ?? [])
      .filter((button) => button.checkVisibility());
    const next = remaining[Math.min(index, remaining.length - 1)];
    if (next) {
      next.focus();
    } else if (this.#markup.hasSearch && this.#markup.expanded) {
      this.#markup.searchInput?.focus();
    } else {
      this.#markup.focusHost();
    }
  }


  #onClearAll = () => {
    this.#asUserAction(() => this.formResetCallback());
    if (this.#markup.hasSearch && this.#markup.expanded) {
      this.#markup.searchInput?.focus();
    } else {
      this.#markup.focusHost();
    }
  }

  // The dropdown opens when focus arrives. A combobox that keeps focus after it closed (an option
  // was picked, Escape) gets no new focus from a click, so the click itself opens it.
  // Not for clicks inside the dropdown (picking an option) or on the tag/clear buttons.
  #onHostClick = (event: MouseEvent) => {
    if (this.#isDisabled || this.#markup.expanded) return;
    const path = event.composedPath();
    if (this.#markup.dropdown && path.includes(this.#markup.dropdown)) return;
    const onButton = path.some((node) => node instanceof Element && /\bclear-(tag|all)\b/.test(node.getAttribute('part') ?? ''));
    if (onButton) return;
    this.#markup.showDropdown();
  }

  // Picking an option with the pointer: toggles it (multiple) or selects it and closes (single),
  // like <select>. The click may land on content inside the option.
  #onOptionClick = (event: Event) => {
    const option = (event.target as Element | null)?.closest?.('box-option') as unknown as HTMLComboboxOptionElement | null;
    if (!option || ComboboxMarkup.isOptionDisabled(option)) return;
    this.#asUserAction(() => {
      option.selected = this.multiple ? !option.selected : true;
    });
    if (!this.multiple) {
      this.#markup.closeDropdown();
      this.#markup.focusHost();
    }
  }

  // Events follow the native rule: `change` reports what the *user* did, once per action, and
  // only when the value actually changed. Changes made by script (value, selectedIndex,
  // option.selected, attributes, the options collection, form reset) dispatch nothing: firing
  // for them makes frameworks that set a value and listen for change loop or handle twice.
  // (`input` is the search field's own event: the user typed.)
  #asUserAction(action: () => void) {
    const before = this.value;
    action();
    if (this.value !== before) this.dispatchEvent(new Event('change', { bubbles: true }));
  }

  #onPickerToggle = (event: Event) => {
    const state = Reflect.get(event, 'newState');
    const oldState = Reflect.get(event, 'oldState');
    if (state === oldState) return;
    if (state === 'open') {
      this.#syncPopupSemantics();
      this.#prevValue = this.value;
      this.#changed = true;
    } else {
      this.#changed = this.#prevValue !== this.value;
      this.dispatchEvent(new Event('close'));
    }
  }

  // Keyboard interaction follows the WAI-ARIA "select-only combobox" pattern:
  // https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-select-only/
  #onKeyDown = (event: KeyboardEvent) => {
    if (this.#isDisabled || event.defaultPrevented) return;
    const active = this.shadowRoot.activeElement;
    const expanded = this.#markup.expanded;
    const { key } = event;

    if (key === 'Escape') {
      if (!expanded) return;
      event.preventDefault();
      event.stopPropagation();
      this.#markup.closeDropdown();
      this.#markup.focusHost();
      return;
    }

    // Focus is on the combobox itself
    if (!active) {
      if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter' || key === ' ' || key === 'Home' || key === 'End') {
        event.preventDefault();
        this.#markup.showDropdown();
        if (this.#markup.hasSearch && key !== 'ArrowUp' && key !== 'End' && key !== 'Home') {
          this.#markup.searchInput?.focus();
        } else if (key === 'ArrowUp' || key === 'End') {
          this.#focusOption(key === 'End' ? this.#lastOption() : this.#selectedNavigableOption() ?? this.#lastOption());
        } else if (key === 'Home') {
          this.#focusOption(this.#firstOption());
        } else {
          this.#focusOption(this.#selectedNavigableOption() ?? this.#firstOption());
        }
        return;
      }
      if (this.#isTypeaheadKey(event) && !this.#markup.hasSearch) {
        event.preventDefault();
        this.#markup.showDropdown();
        this.#typeaheadFocus(key, null);
      }
      return;
    }

    if (active === this.#markup.searchInput) {
      if (key === 'Enter') {
        event.stopPropagation();
        if (!this.searchable && this.filterable) {
          this.#markup.sort(this.#markup.searchInput!.value);
        }
        if (this.searchable) {
          this.dispatchEvent(new Event('search'))
        }
        return;
      }
      if (key === 'ArrowDown') {
        event.preventDefault();
        this.#markup.showDropdown();
        this.#focusOption(this.#firstOption());
      }
      return;
    }

    if (active instanceof HTMLComboboxOptionElement) {
      const options = this.#markup.navigableOptions;
      const index = options.indexOf(active);
      switch (key) {
        case 'ArrowDown':
          event.preventDefault();
          this.#focusOption(options[index + 1] ?? null);
          return;
        case 'ArrowUp':
          event.preventDefault();
          if (index <= 0 && this.#markup.hasSearch) {
            this.#markup.searchInput?.focus();
          } else {
            this.#focusOption(options[index - 1] ?? null);
          }
          return;
        case 'Home':
        case 'PageUp':
          event.preventDefault();
          this.#focusOption(this.#firstOption());
          return;
        case 'End':
        case 'PageDown':
          event.preventDefault();
          this.#focusOption(this.#lastOption());
          return;
        case 'Enter':
        case ' ':
          event.preventDefault();
          event.stopPropagation();
          if (ComboboxMarkup.isOptionDisabled(active)) return;
          this.#asUserAction(() => {
            active.selected = this.multiple ? !active.selected : true;
          });
          if (!this.multiple) {
            this.#markup.closeDropdown();
            this.#markup.focusHost();
          }
          return;
        default:
          if (this.#isTypeaheadKey(event)) {
            event.preventDefault();
            this.#typeaheadFocus(key, active);
          }
      }
    }
  }

  #firstOption() {
    return this.#markup.navigableOptions[0] ?? null;
  }

  #lastOption() {
    return this.#markup.navigableOptions.at(-1) ?? null;
  }

  #selectedNavigableOption() {
    return this.#markup.navigableOptions.find((option) => option.selected) ?? null;
  }

  #focusOption(option: HTMLComboboxOptionElement | null) {
    if (!option) return;
    option.focus();
    option.scrollIntoView?.({ block: 'nearest' });
  }

  #isTypeaheadKey(event: KeyboardEvent) {
    return event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey;
  }

  // Typing characters moves to the next option whose label starts with them, as in <select>
  #typeaheadFocus(char: string, from: HTMLComboboxOptionElement | null) {
    clearTimeout(this.#typeaheadTimer);
    this.#typeaheadTimer = setTimeout(() => this.#typeahead = '', 500);
    const repeated = this.#typeahead.length === 1 && this.#typeahead === char.toLowerCase();
    this.#typeahead = repeated ? this.#typeahead : this.#typeahead + char.toLowerCase();
    const options = this.#markup.navigableOptions;
    const start = from ? options.indexOf(from) + (repeated || this.#typeahead.length === 1 ? 1 : 0) : 0;
    const ordered = [...options.slice(start), ...options.slice(0, start)];
    const match = ordered.find((option) => ComboboxMarkup.optionLabel(option).toLowerCase().startsWith(this.#typeahead));
    this.#focusOption(match ?? null);
  }

  #onInput = () => {
    this.query = this.#markup.searchInput!.value;
    if (!this.searchable && this.filterable) {
      this.#markup.sort(this.#markup.searchInput?.value || '');
    }
  }

  get #isDisabled() {
    return this.disabled || this.#formDisabled;
  }

  // A disabled combobox stays in the accessibility tree, exposed as disabled like a native
  // <select disabled> (`inert` would remove it from the tree). The browser already takes a
  // disabled form-associated element out of the focus order; its inner controls are made inert
  // and it ignores the pointer (:state(disabled)).
  // Known Chrome limitation: the value of a disabled combobox is not exposed, because Chrome
  // computes the value of an ARIA combobox only while it is focusable.
  #applyDisabledState() {
    const disabled = this.#isDisabled;
    this.#markup.disabled = disabled;
    this.#internals.ariaDisabled = disabled ? 'true' : null;
    // Mirrored as an attribute, like role: tools reading the DOM (Playwright's actionability
    // checks and toBeDisabled(), Testing Library) can't see internals. An author's own
    // aria-disabled is left alone.
    if (disabled && !this.hasAttribute('aria-disabled')) {
      super.setAttribute('aria-disabled', 'true');
      this.#ariaDisabledMirrored = true;
    } else if (!disabled && this.#ariaDisabledMirrored) {
      super.removeAttribute('aria-disabled');
      this.#ariaDisabledMirrored = false;
    }
    try {
      if (disabled) this.#internals.states.add('disabled');
      else this.#internals.states.delete('disabled');
    } catch (e) { /* CustomStateSet not supported */ }
    if (this.#markup.internal) this.#markup.internal.inert = disabled;
    if (this.#markup.dropdown) this.#markup.dropdown.inert = disabled;
    if (disabled) {
      this.#markup.closeDropdown();
      if (this.matches(':focus, :focus-within')) this.blur();
    }
  }

  // <optgroup> has its group semantics only inside a <select>; restore them here.
  #syncOptgroups() {
    this.#markup.optionsContainer?.querySelectorAll('optgroup').forEach((group) => {
      group.setAttribute('role', 'group');
      if (group.label) group.setAttribute('aria-label', group.label);
      else group.removeAttribute('aria-label');
      if (group.disabled) group.setAttribute('aria-disabled', 'true');
      else group.removeAttribute('aria-disabled');
    });
  }

  // Without a search field the popup is just the listbox, unnamed like the popup of a native <select>.
  // With one, it is a dialog holding the field and the listbox.
  // Note: any *named* element inside the combobox would be read as part of its value
  // (Chrome computes the value of a non-editable combobox from its content), so the
  // dialog stays unnamed; the listbox inside it is named after the <label>.
  #syncPopupSemantics() {
    const markup = this.#markup;
    if (!markup) return;
    const withSearch = this.searchable || this.filterable;
    this.#internals.ariaHasPopup = withSearch ? 'dialog' : 'listbox';
    // Without a search field the popup has no role of its own: Chrome exposes the bare popover as an
    // unnamed group around the listbox. Keep it: a listbox directly inside the combobox would add
    // its selected option to the combobox value a second time ("Banana Banana").
    if (withSearch) markup.dropdown?.setAttribute('role', 'dialog');
    else markup.dropdown?.removeAttribute('role');
    const popup = withSearch ? markup.dropdown : markup.optionsContainer;
    if (popup) (this.#internals as any).ariaControlsElements = [popup];
    markup.optionsContainer?.setAttribute('aria-multiselectable', String(this.multiple));
    // Shadow content can't point at the outer <label> with aria-labelledby, so it borrows the label's text.
    const name = Array.from(this.#internals.labels ?? [], (label) => label.textContent?.trim()).filter(Boolean).join(' ')
      || this.getAttribute('aria-label') || '';
    if (withSearch && name) markup.optionsContainer?.setAttribute('aria-label', name);
    else markup.optionsContainer?.removeAttribute('aria-label');
    markup.dropdown?.removeAttribute('aria-label');
    // The tags area has interactive content (remove buttons) only when clearable or multiple.
    // Otherwise it only repeats the value, which is already exposed, so hide it.
    if (this.clearable || this.multiple) markup.internal?.removeAttribute('aria-hidden');
    else markup.internal?.setAttribute('aria-hidden', 'true');
  }

  #setValidityAndFormValue() {
    this.#markup.syncValueText();
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
      // Without a value attribute, the selection comes from the options' `selected` attributes:
      // `value = null` would clear it
      if (key === 'value' && !this.hasAttribute('value')) continue;
      const attribute = this.getAttribute(key);
      Reflect.set(this, key, HTMLComboboxElement.#BOOLEAN_ATTRIBUTES.has(key) ? toBoolean(attribute) : attribute);
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

if (!window.customElements.get('combo-box')) {
  window.customElements.define('combo-box', HTMLComboboxElement);
}