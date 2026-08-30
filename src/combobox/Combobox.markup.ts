import { HTMLComboboxTagElement } from './HTML.combobox.tag.element.js';
import { HTMLComboboxOptionElement } from './HTML.combobox.option.element.js';

export class ComboboxMarkup {
  #shadowRoot: ShadowRoot;
  #internals: ElementInternals;
  tagsContainer: HTMLDivElement | null = null;
  optionsContainer: HTMLDivElement | null = null;
  clearAllButton: HTMLButtonElement | null = null;
  dropdown: HTMLDivElement | null = null;
  placeholder: HTMLDivElement | null = null;
  searchInput: HTMLInputElement | null = null;
  tagTemplate: HTMLComboboxTagElement | null = null;

  #rso: ResizeObserver;
  #hostWidth = 0;
  #hostHeight = 0;
  #hostTop = 0;

  constructor(shadowRoot: ShadowRoot, internals: ElementInternals) {
    this.#shadowRoot = shadowRoot;
    this.#internals = internals;
    window.addEventListener('click', this.onClickOutside);
    this.#shadowRoot.host.addEventListener('focusin', this.onFocusIn);
    this.#shadowRoot.host.addEventListener('focusout', this.onFocusOut)
    this.#rso = new ResizeObserver(this.#onDimensionsChanges);
  }


  connect() {
    const placeholder = this.#shadowRoot.host.getAttribute('placeholder') || `Выбрать`;
    this.tagsContainer = this.#shadowRoot.querySelector('#tags')!;

    this.#rso.observe(this.#shadowRoot.host, { box: 'border-box' });

    this.optionsContainer = this.#shadowRoot.querySelector('[part*="options"]');
    this.clearAllButton = this.#shadowRoot.querySelector('[part*="clear-all"]');
    this.clearAllButton?.addEventListener('focusout', this.onClearAllFocusOut);

    this.dropdown = this.#shadowRoot.querySelector('#dropdown');
    this.placeholder = this.#shadowRoot.querySelector('#placeholder');
    this.placeholder!.innerText = placeholder;

    this.searchInput = this.#shadowRoot.querySelector('[part*="search-input"]');
    this.searchInput!.value = this.#shadowRoot.host.getAttribute('query')!;

    this.searchInput!.style.setProperty('--search-input-placeholder-color', this.placeholder!.style.color);
    const innerTemplate: HTMLTemplateElement = this.#shadowRoot.querySelector('#tag-template')!;
    const doc = document.importNode(innerTemplate.content, true);
    this.tagTemplate = doc.querySelector<HTMLComboboxTagElement>('box-tag') as HTMLComboboxTagElement;
  }

  onHostConnected() {
    const host = this.#shadowRoot.host;
    const clearable = host.hasAttribute('clearable') || host.hasAttribute('multiple');
    this.tagTemplate!.toggleAttribute('visible', clearable);
  }

  disconnect() {
    this.#shadowRoot.host.removeEventListener('focusin', this.onFocusIn);
    this.#shadowRoot.host.removeEventListener('focusout', this.onFocusOut);
    this.clearAllButton?.removeEventListener('focusout', this.onClearAllFocusOut);
    window.removeEventListener('click', this.onClickOutside);
    this.#rso.unobserve(this.#shadowRoot.host);
  }

  setPlaceholder(value: string) {
    if (this.placeholder) {
      this.placeholder.innerText = value.trim() || `Выбрать`;
    }
  }

  setInputValue(value: string) {
    if (this.searchInput) {
      this.searchInput.value = value;
    }
  }

  onClearAllFocusOut = (event: FocusEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.relatedTarget == null) {
      const host = this.#shadowRoot.host;
      if (!host.hasAttribute('searchable') && !host.hasAttribute('filterable')) {
        this.closeDropdown()
      }
    }
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
    this.onFocusIn()
  }

  onFocusIn = () => {
    if (this.#internals.ariaExpanded === "true") return;
    this.#hostTop = this.#shadowRoot.host.getBoundingClientRect().top;
    try {
      this.dropdown!.showPopover();
      this.#internals.ariaExpanded = "true";
    } catch (e) {
      this.#internals.ariaExpanded = "false";
    }
  }

  closeDropdown() {
    try {
      this.dropdown!.hidePopover();
      this.#internals.ariaExpanded = "false";
    } catch(e) {
      this.#internals.ariaExpanded = "true";
    }
  }

  onFocusOut = () => {
    if (this.#internals.ariaExpanded !== "true") return;
    this.closeDropdown();
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
    tag.setAttribute('value', value);
    this.tagsContainer!.appendChild(tag);
    this.clearAllButton?.removeAttribute('disabled');
    return button;
  }

  getTagByValue(value: string) {
    return this.tagsContainer!.querySelector<HTMLComboboxTagElement>(`box-tag[value="${value}"]`)!;
  }

  getOptionByValue(value: string) {
    return this.optionsContainer!.querySelector<HTMLComboboxOptionElement>(`box-option[value="${value}"]`)!;
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
    content-visibility: auto;
    cursor: pointer;
    padding: inherit;
    padding-inline: .5lh;
  }
  
  box-option:hover {
    background-color: color-mix(in srgb, Highlight, transparent 70%);
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
<div id='internal' part='internal'>
  <div id="tags" part='tags'></div>
  <div id="placeholder" part='placeholder' tabindex='0'>Выбрать</div>
  <button part="clear-all">✕</button>
</div>

<div id="dropdown" popover="manual" part='dropdown' >
  <input placeholder='Поиск' name="search-input" part="search-input" inputmode='search' autofocus />
  <div part="options" id='options'></div>
</div>

<template id='tag-template'>
  <box-tag>
    <span part="tag-label"></span>
    <div part="clear-tag" role='button' tabindex='0'>✕</div>
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