import { HTMLComboboxTagElement } from './HTML.combobox.tag.element.js';
import { HTMLComboboxOptionElement } from './HTML.combobox.option.element.js';

export class ComboboxMarkup {
  /** Texts used only by assistive technology. Override them to localize, e.g. `HTMLComboboxElement.strings.clearAll = 'Очистить'` */
  static strings = {
    /** Accessible name of the clear-all button */
    clearAll: 'Clear selection',
    /** Accessible name prefix of a tag's clear button: "Remove Banana" */
    removeTag: 'Remove',
  };

  #shadowRoot: ShadowRoot;
  #internals: ElementInternals;
  tagsContainer: HTMLDivElement | null = null;
  optionsContainer: HTMLDivElement | null = null;
  clearAllButton: HTMLButtonElement | null = null;
  dropdown: HTMLDivElement | null = null;
  placeholder: HTMLDivElement | null = null;
  searchInput: HTMLInputElement | null = null;
  tagTemplate: HTMLComboboxTagElement | null = null;
  internal: HTMLDivElement | null = null;
  valueText: HTMLSpanElement | null = null;

  #rso: ResizeObserver;
  #tagsObserver: MutationObserver;
  #hostWidth = 0;
  #hostHeight = 0;
  #hostTop = 0;
  /** Set while focus is moved back to the host programmatically, so that focusin doesn't reopen the popup. */
  #suppressOpen = false;
  /** Set by the host when it (or its fieldset) is disabled. */
  disabled = false;

  constructor(shadowRoot: ShadowRoot, internals: ElementInternals) {
    this.#shadowRoot = shadowRoot;
    this.#internals = internals;
    this.#internals.ariaExpanded = 'false';
    this.#rso = new ResizeObserver(this.#onDimensionsChanges);
    this.#tagsObserver = new MutationObserver(this.syncValueText);
  }


  connect() {
    const placeholder = this.#shadowRoot.host.getAttribute('placeholder') || `Выбрать`;
    this.tagsContainer = this.#shadowRoot.querySelector('#tags')!;
    this.internal = this.#shadowRoot.querySelector('#internal');
    this.valueText = this.#shadowRoot.querySelector('#value');

    this.optionsContainer = this.#shadowRoot.querySelector('[part*="options"]');
    this.clearAllButton = this.#shadowRoot.querySelector('[part*="clear-all"]');
    this.clearAllButton?.setAttribute('aria-label', ComboboxMarkup.strings.clearAll);

    this.dropdown = this.#shadowRoot.querySelector('#dropdown');
    this.placeholder = this.#shadowRoot.querySelector('#placeholder');
    this.placeholder!.innerText = placeholder;

    this.searchInput = this.#shadowRoot.querySelector('[part*="search-input"]');
    this.searchInput!.value = this.#shadowRoot.host.getAttribute('query') ?? '';

    this.searchInput!.style.setProperty('--search-input-placeholder-color', this.placeholder!.style.color);
    const innerTemplate: HTMLTemplateElement = this.#shadowRoot.querySelector('#tag-template')!;
    const doc = document.importNode(innerTemplate.content, true);
    this.tagTemplate = doc.querySelector<HTMLComboboxTagElement>('box-tag') as HTMLComboboxTagElement;
  }

  onHostConnected() {
    const host = this.#shadowRoot.host;
    const clearable = host.hasAttribute('clearable') || host.hasAttribute('multiple');
    this.tagTemplate!.toggleAttribute('visible', clearable);
    window.addEventListener('click', this.onClickOutside);
    host.addEventListener('focusin', this.onFocusIn);
    host.addEventListener('focusout', this.onFocusOut);
    this.#rso.observe(host, { box: 'border-box' });
    this.#tagsObserver.observe(this.tagsContainer!, { childList: true });
    this.syncValueText();
  }

  disconnect() {
    const host = this.#shadowRoot.host;
    host.removeEventListener('focusin', this.onFocusIn);
    host.removeEventListener('focusout', this.onFocusOut);
    window.removeEventListener('click', this.onClickOutside);
    this.#rso.unobserve(host);
    this.#tagsObserver.disconnect();
  }

  setPlaceholder(value: string) {
    if (this.placeholder) {
      this.placeholder.innerText = value.trim() || `Выбрать`;
    }
  }

  setInputValue(value: string) {
    // Typing writes the query attribute, which comes back here: don't reset the caret
    if (this.searchInput && this.searchInput.value !== value) {
      this.searchInput.value = value;
    }
  }

  /** The combobox value exposed to assistive technology is the text of the selected tags. */
  syncValueText = () => {
    if (!this.valueText || !this.tagsContainer) return;
    const labels = Array.from(this.tagsContainer.querySelectorAll<HTMLComboboxTagElement>('box-tag'), (tag) => this.tagLabel(tag));
    const text = labels.filter(Boolean).join(', ');
    if (this.valueText.textContent !== text) this.valueText.textContent = text;
    this.clearAllButton?.toggleAttribute('disabled', labels.length === 0);
  }

  tagLabel(tag: HTMLComboboxTagElement) {
    const option = tag.value ? this.getOptionByValue(tag.value) : null;
    if (option) return ComboboxMarkup.optionLabel(option);
    const label = tag.querySelector('[part*="tag-label"]') ?? tag;
    return label.textContent?.trim() ?? '';
  }

  static optionLabel(option: HTMLComboboxOptionElement) {
    return (option.label || option.textContent || option.value || '').trim();
  }

  onClickOutside = (ev: MouseEvent) => {
    if (this.#internals.ariaExpanded !== 'true') return;
    if (ev.target === this.#shadowRoot.host) return;
    this.closeDropdown()
  }

  #timer: any = undefined;

  sort(query: string) {
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      const regex = new RegExp(query.trim(), 'i');
      this.options!.forEach((option) => {
        if (!regex.test(option.textContent!)) {
          option.style.display = "none";
        }  else {
          option.style.display = "flex";
        }
      })
      this.dropdown!.scrollTo({ top: 0, behavior: 'smooth' });
    },400)
  }


  get options() {
    return this.optionsContainer!.querySelectorAll<HTMLComboboxOptionElement>('box-option');
  }

  /** Options reachable with the keyboard: not disabled (itself or by its optgroup) and not filtered out. */
  get navigableOptions() {
    return Array.from(this.options).filter((option) => !ComboboxMarkup.isOptionDisabled(option) && option.style.display !== 'none' && !option.hidden);
  }

  static isOptionDisabled(option: HTMLComboboxOptionElement) {
    return option.disabled || Boolean(option.closest('optgroup')?.disabled);
  }

  get hasSearch() {
    const host = this.#shadowRoot.host;
    return host.hasAttribute('searchable') || host.hasAttribute('filterable');
  }

  get expanded() {
    return this.#internals.ariaExpanded === 'true';
  }

  /** Moves focus to the host without reopening the popup. */
  focusHost() {
    this.#suppressOpen = true;
    try {
      (this.#shadowRoot.host as HTMLElement).focus();
    } finally {
      this.#suppressOpen = false;
    }
  }

  getTagControl(tag: HTMLComboboxTagElement) {
    return tag.querySelector<HTMLButtonElement>('[part*="clear-tag"]');
  }

  #onDimensionsChanges = (entries: ResizeObserverEntry[]) => {
    const entry = entries[0];
    if (entry) {
      this.#hostWidth = entry.borderBoxSize[0].inlineSize;
      this.#hostHeight = entry.borderBoxSize[0].blockSize;
    }
    this.setDropdownPosition();
  }


  setDropdownPosition() {
    const dropdown = this.dropdown!;
    const vh = window.innerHeight;
    const sh = this.#hostHeight;
    const sy = this.#hostTop;

    // Calculate available space below and above
    const spaceBelow = vh - (sy + sh);
    const spaceAbove = sy;

    // Determine if dropdown should go below or above
    const shouldGoBelow = spaceBelow >= spaceAbove;

    // Set dropdown to max 50vh or available space, whichever is smaller
    const maxHeight = Math.min(50 * vh / 100, shouldGoBelow ? spaceBelow - 10 : spaceAbove - 10);

    dropdown.style.width = this.#hostWidth + 'px';
    dropdown.style.maxHeight = `${Math.max(100, maxHeight)}px`;

  }

  showDropdown() {
    this.#open();
  }

  onFocusIn = () => {
    if (this.#suppressOpen) return;
    this.#open();
  }

  #open() {
    if (this.disabled || this.expanded) return;
    this.#hostTop = this.#shadowRoot.host.getBoundingClientRect().top;
    try {
      this.dropdown!.showPopover();
      this.#internals.ariaExpanded = "true";
    } catch (e) {
      this.#internals.ariaExpanded = "false";
      return;
    }
    // When the combobox has focus and the dialog opens, move into the search field (if it asks
    // for autofocus). The popover's own autofocus doesn't apply when the host is the focus target,
    // and focusing synchronously from focusin would be undone by the host's own focus, so defer.
    if (this.hasSearch && this.searchInput?.hasAttribute('autofocus')) {
      setTimeout(() => {
        const host = this.#shadowRoot.host;
        const hostFocused = document.activeElement === host && !this.#shadowRoot.activeElement;
        if (hostFocused && this.expanded && this.searchInput?.hasAttribute('autofocus')) this.searchInput.focus();
      });
    }
  }

  closeDropdown() {
    if (!this.dropdown!.matches(':popover-open')) {
      this.#internals.ariaExpanded = "false";
      return;
    }
    try {
      this.dropdown!.hidePopover();
      this.#internals.ariaExpanded = "false";
    } catch(e) {
      this.#internals.ariaExpanded = "true";
    }
  }

  // Focus moving between the host and its own shadow content is not "leaving" the combobox.
  // Wait for the focus to settle, then close only if it is really gone.
  onFocusOut = () => {
    if (!this.expanded) return;
    setTimeout(() => {
      const host = this.#shadowRoot.host;
      if (document.activeElement === host || host.matches(':focus-within')) return;
      this.closeDropdown();
    });
  }


  createAndAppendTag(option: HTMLComboboxOptionElement) {
    const value = option.value!;
    const userTagTemplate = this.#shadowRoot.host.firstElementChild;
    let tag: HTMLComboboxTagElement;
    let button: HTMLButtonElement;

    if (userTagTemplate && userTagTemplate instanceof HTMLComboboxTagElement) {
      tag = userTagTemplate.cloneNode(true) as HTMLComboboxTagElement;
      tag.querySelectorAll('slot')
        .forEach(node => {
          const relatedNode = option.querySelector(`[slot="${node.name}"]`);
          if (relatedNode) {
            const clone = relatedNode.cloneNode(true) as HTMLElement;
            clone.part.remove(...clone.part.values());
            clone.part.add(...node.part.values());
            clone.classList.add(...node.classList.values());
            tag.replaceChild(clone, node);
          }
        });

      tag.part.add(...option.part.values());
      tag.part.remove('option');
      button = tag.querySelector<HTMLButtonElement>('[part*="clear-tag"]')!;
    } else {
      const template = this.tagTemplate;
      tag = template!.cloneNode(true) as HTMLComboboxTagElement;
      const label = tag.querySelector('[part="tag-label"]')!;
      label.textContent = option.label || option.textContent;
      button = tag.querySelector<HTMLButtonElement>('[part="clear-tag"]')!;
    }

    button?.setAttribute('value', value);
    if (button && !button.hasAttribute('aria-label') && !button.hasAttribute('aria-labelledby')) {
      button.setAttribute('aria-label', `${ComboboxMarkup.strings.removeTag} ${ComboboxMarkup.optionLabel(option)}`);
    }
    tag.setAttribute('value', value);
    this.tagsContainer!.appendChild(tag);
    this.syncValueText();
    return button;
  }

  getTagByValue(value: string) {
    return this.tagsContainer!.querySelector<HTMLComboboxTagElement>(`box-tag[value="${CSS.escape(value)}"]`)!;
  }

  // Compared through the property, not a [value] selector: an option without a value attribute
  // takes its text as value, like <option>
  getOptionByValue(value: string) {
    return Array.from(this.options).find((option) => option.value === value) ?? null;
  }

  get selectedOptions() {
    return this.optionsContainer!.querySelectorAll<HTMLComboboxOptionElement>('box-option[selected]')!;
  }

  static importCSS(urls: string[]) {
    ComboboxMarkup.template = ComboboxMarkup.template.replace(':host {', `
${urls.map(url => `@import "${url}";`)}  

:host {
    `)
  }

  static template = `
<style>
  :host {
    font-size: inherit;
    font-family: inherit;
    display: flow-root;
    position: relative;
    anchor-name: --position;
  }

  :host(:state(disabled)) {
    pointer-events: none;
  }
  
  
  
  /* Carries the accessible value of the combobox (the selected labels), like the
     displayed text of a native <select>. Visually hidden, the tags show it visually. */
  #value {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  #internal {
    min-block-size: 1lh;
    display: grid;
    grid-template-columns: minmax(0, max-content) 1fr;
    align-items: center;
    gap: 1px;
    border-radius: inherit;
  }
  
  :host([multiple]) #internal {
    grid-template-columns: minmax(0, max-content) 1fr auto;
  }

  #dropdown {
    contain: layout style paint;
    inset: unset;
    margin: 0;
    /*position: absolute;*/
    box-sizing: border-box;
    overflow-y: scroll;
    flex-direction: column;
    border-radius: inherit;
    border-color: ButtonFace;
    border-width: inherit;
    background-color: Canvas;
    outline: none;
    display: none;
    top: calc(anchor(bottom) + 2px);
    left: anchor(left);
    position-anchor: --position;
    position-try: normal flip-block;
  }
  
  #dropdown:popover-open {
    display: flex;
  }
  
  #dropdown::-webkit-scrollbar {
    display: none;
  }
  
  #options {
    display: flex;
    flex-direction: column;
    justify-content: start;
    gap: 2px;
    border-radius: inherit;  
  }
  
  :host([filterable]) #options, :host([searchable]) #options {
    padding-top: .5rem;
  }
  
  box-option {
    display: flex;
    border-radius: inherit;
    cursor: pointer;
    padding: inherit;
    padding-inline: .5lh;
  }
  
  box-option:hover {
    background-color: color-mix(in srgb, Highlight, transparent 70%);
  }
  
  /* Like <option label="Plum"></option>: an empty option displays its label, while its text and
     value stay empty. Generated content is part of the option's accessible name. */
  box-option[label]:empty::before {
    content: attr(label);
  }

  box-option[disabled] {
    color: GrayText;
    cursor: not-allowed;
    pointer-events: none;
  }

  box-option:focus-visible {
    outline: 1px solid Highlight;
    outline-offset: -1px;
  }

  box-option[selected] {
    background-color: Highlight;
    cursor: not-allowed;
    pointer-events: none;
  }
  
  #dropdown > [part="search-input"] { 
    display: none;
    position: sticky;
    top: 0;
    z-index: 2;
    font-size: inherit;
    outline: inherit;
  }
  
  :host([searchable]) #dropdown > [part="search-input"],
  :host([filterable]) #dropdown > [part="search-input"] {
    display: flow-root;
  }
  
  #placeholder {
    text-align: left;
    overflow: hidden;
    padding-inline-start: 2px;
    color: dimgrey;
    outline: none;
    user-select: none;
  }

  #tags:not(:empty) + #placeholder {
    display: none;
  }

  #tags:not(:empty) {
    grid-column: 1 / span 2;
    width: 100%;
  }

  #tags {
    display: flex;
    flex-wrap: wrap;
    overflow: hidden;
    gap: 2px;
  }

  box-tag {
    width: 100%;
    justify-self: start;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    padding-inline-start: 0.4lh;
    padding-inline-end: 0.2lh;
    background-color: transparent;
    gap: 5px;
    border-radius: 1lh;
  }
  
  :host([multiple]) box-tag {
    background-color: Highlight;
    width: fit-content;
    max-width: 100%;
  }

  [part*="tag-label"] {
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
    user-select: none;
    flex-grow: 1;
  }
  
  :host([multiple]) [part*="tag-label"] {
    flex-grow: unset;
  }
  
  [part*="clear-tag"], #internal > [part*="clear-all"] {
    border-radius: 100%;
    border: none;
    aspect-ratio: 1;
    padding: 0!important;
    user-select: none;
    background-color: transparent;
  }
  
  [part*="clear-tag"] {
    block-size: 1lh;
    font-size: .7lh;
    text-transform: uppercase;
    display: none;
  }
  
  [part*="clear-tag"]:focus-visible, [part*="clear-tag"]:focus {
    outline-style: solid;
    outline-width: 1px;
  }

  :host([multiple]) #internal > [part*="clear-all"] {
   display: block;
  }
  
  :host([clearable]) [part*="clear-tag"],
  :host([multiple]) [part*="clear-tag"] {
    display: grid;
    place-content: center;
  }

  #internal > [part*="clear-all"] {
    font-size: inherit;
    text-transform: uppercase;
    block-size: 1lh;
    display: none;
  }
  
  #tags:empty + [part*="clear-all"] {
    outline: none;
  }

  #internal > [part*="clear-all"]:hover, 
  [part*="clear-tag"]:hover {
    color: ActiveText;
    cursor: pointer;
  }

  #internal >[part*="clear-all"]:hover {
    background-color: ButtonFace;
  }
  
  #tags:empty + [part*="clear-all"] {
    pointer-events: none;
    outline: none;
  }
 
</style>
<span id="value" part="value"></span>
<div id='internal' part='internal' role="group">
  <div id="tags" part='tags' role="list"></div>
  <div id="placeholder" part='placeholder' aria-hidden="true">Выбрать</div>
  <button part="clear-all" type="button">✕</button>
</div>

<div id="dropdown" popover="manual" part='dropdown' >
  <input placeholder='Поиск' name="search-input" part="search-input" inputmode='search' autocomplete="off" aria-controls="options" aria-autocomplete="list" autofocus />
  <div part="options" id='options' role="listbox"></div>
</div>

<template id='tag-template'>
  <box-tag>
    <span part="tag-label"></span>
    <div part="clear-tag" role='button' tabindex='0'><span aria-hidden="true">✕</span></div>
  </box-tag>
</template>
`
  static markup: HTMLTemplateElement;
  static {
    const template = document.createElement('template');
    template.innerHTML = ComboboxMarkup.template;
    ComboboxMarkup.markup = template;
  }
}