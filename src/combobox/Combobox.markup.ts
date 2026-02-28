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
  options: NodeListOf<HTMLComboboxOptionElement> | null;
  connected = false;

  constructor(shadowRoot: ShadowRoot, internals: ElementInternals) {
    this.#shadowRoot = shadowRoot;
    this.#internals = internals;
    this.#shadowRoot.host.addEventListener('focus', this.showDropdown);
    this.#shadowRoot.host.addEventListener('blur', this.hideDropdown);
    this.#shadowRoot.host.addEventListener('click', this.showDropdown);
    document.addEventListener('click', this.hideDropdown);
    document.addEventListener('scroll', this.onPageScroll);
  }

  connect() {
    const placeholder = this.#shadowRoot.host.getAttribute('placeholder') || '';
    this.tagsContainer = this.#shadowRoot.querySelector('#tags');
    this.optionsContainer = this.#shadowRoot.querySelector('[part*="options"]');
    this.clearAllButton = this.#shadowRoot.querySelector('[part*="clear-all"]');
    this.dropdown = this.#shadowRoot.querySelector('#dropdown');
    this.placeholder = this.#shadowRoot.querySelector('#placeholder');
    this.placeholder.innerText = placeholder;
    this.searchInput = this.#shadowRoot.querySelector('[part*="search-input"]');
    this.searchInput.value = this.#shadowRoot.host.getAttribute('query');
    this.searchInput.placeholder = placeholder;
    const innerTemplate: HTMLTemplateElement = this.#shadowRoot.querySelector('#tag-template');
    const doc = document.importNode(innerTemplate.content, true);
    this.tagTemplate = doc.querySelector<HTMLComboboxTagElement>('box-tag') as HTMLComboboxTagElement;
    this.connected = true;
  }

  invalidateOptionsCache() {
    this.options = this.optionsContainer.querySelectorAll<HTMLComboboxOptionElement>('box-option');
  }

  #timer = undefined;

  sort(query: string) {
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      const regex = new RegExp(query.trim(), 'i');
      this.options.forEach((option) => {
        if (!regex.test(option.textContent)) {
          option.style.display = "none";
        }  else {
          option.style.display = "flex";
        }
      })
      this.dropdown.scrollTo({ top: 0, behavior: 'smooth' });
    },200)
  }

  disconnect() {
    this.#shadowRoot.host.removeEventListener('focus', this.showDropdown);
    this.#shadowRoot.host.removeEventListener('blur', this.hideDropdown);
    this.#shadowRoot.host.removeEventListener('click', this.showDropdown);
    document.removeEventListener('click', this.hideDropdown);
    document.removeEventListener('scroll', this.onPageScroll);
    this.connected = false;
  }

  onPageScroll = () => {
    if (this.dropdown.matches(':popover-open')) {
      this.setDropdownPosition(this.#shadowRoot.host.getBoundingClientRect());
    }
  }

  setDropdownPosition(rect: DOMRect) {
    const dropdown = this.dropdown;
    const vh = window.innerHeight;
    const sh = rect.height;
    const sy = rect.top;
    if (sy < (vh-vh/3)) {
      dropdown.style.top = sh + sy + 'px';
      dropdown.style.bottom = 'unset';
      dropdown.style.transform = `unset`;
    } else {
      dropdown.style.top = sh + sy + 'px';
      dropdown.style.bottom = 'unset';
      dropdown.style.transform = `translateY(calc(-1 * calc(100% + ${sh}px)))`;
    }
    dropdown.style.left = rect.left + 'px';
    dropdown.style.width = rect.width + 'px';
    dropdown.style.maxHeight = '50vh';
  }

  showDropdown = () => {
    try {
      this.setDropdownPosition(this.#shadowRoot.host.getBoundingClientRect())
      this.dropdown.style.display = 'flex';
      this.dropdown.showPopover();
      this.#internals.ariaExpanded = "true";
      if (this.tagsContainer?.children.length === 0) {
        this.searchInput?.focus()
      }
      this.placeholder.innerText = '';
    } catch {
      this.#internals.ariaExpanded = "false";
    }
  }

  closeDropdown() {
    try {
      this.dropdown.hidePopover();
      this.dropdown.style.display = 'none';
      this.#internals.ariaExpanded = "false";
      this.placeholder.innerText = this.#shadowRoot.host.getAttribute('placeholder');
    } catch(e) {
      this.#internals.ariaExpanded = "true";
    }
  }

  hideDropdown = (event: Event) => {
    if (event.composedPath().includes(this.#shadowRoot.host)) return;
    this.closeDropdown();
  }

  createAndAppendTag(option: HTMLComboboxOptionElement) {
    const value = option.value;
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

      button = tag.querySelector<HTMLButtonElement>('[part*="clear-tag"]');
    } else {
      const template = this.tagTemplate;
      tag = template.cloneNode(true) as HTMLComboboxTagElement;
      const label = tag.querySelector('[part="tag-label"]');
      label.textContent = option.textContent;
      button = tag.querySelector<HTMLButtonElement>('[part="clear-tag"]');
    }

    button?.setAttribute('value', value);
    tag.setAttribute('value', value);
    this.tagsContainer.appendChild(tag);
    return button;
  }

  getTagByValue(value: string) {
    return this.tagsContainer.querySelector<HTMLComboboxTagElement>(`box-tag[value="${value}"]`);
  }

  getOptionByValue(value: string) {
    return this.optionsContainer.querySelector<HTMLComboboxOptionElement>(`box-option[value="${value}"]`);
  }

  get selectedOptions() {
    return this.optionsContainer
      .querySelectorAll<HTMLComboboxOptionElement>('box-option[selected]')
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
    display: grid;
    grid-template-columns: minmax(0, max-content) 1fr;
    align-items: center;
    gap: 1px;
    position: relative;
  }
  
  :host([multiple]) {
    grid-template-columns: minmax(0, max-content) 1fr auto;
  }

  #dropdown {
    inset: unset;
    margin: 0;
    box-sizing: border-box;
    overflow-y: scroll;
    flex-direction: column;
    border-radius: inherit;
    border-color: ButtonFace;
    border-width: inherit;
  }
  
  [part="options"] {
    display: flex;
    flex-direction: column;
    justify-content: start;
    gap: 2px;
    padding-block: .5rem;
    border-radius: inherit;
  }
  
  box-option {
    display: flex;
    border-radius: inherit;
    content-visibility: auto;
    cursor: pointer;
    padding-inline: 2px;
    padding-block: 1px;
  }
  
  box-option:hover {
    background-color: color-mix(in srgb, Highlight, transparent 70%);
  }
  
  box-option[selected] {
    background-color: Highlight;
    cursor: not-allowed;
    pointer-events: none;
  }
  
  [part="search-input"] { 
    display: none;
    position: sticky;
    top: 0;
    z-index: 2;
    border-radius: inherit;
    border-style: inherit;
    border-width: inherit;
    border-color: inherit;
    padding: inherit;
  }
  
  :host([searchable]) [part="search-input"],
  :host([filterable]) [part="search-input"] {
    display: flex;
  }
  
  #placeholder {
    text-align: left;
    overflow: hidden;
    padding-inline-start: 2px;
    font-size: smaller;
    color: dimgrey;
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
    border-radius: inherit;
  }

  box-tag {
    width: 100%;
    justify-self: start;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    border-radius: inherit;
    padding-inline-start: 0.2lh;
    padding-inline-end: .2rem;
    background-color: transparent;
    gap: 5px;
    font-size: medium;
    text-transform: uppercase;
  }
  
  :host([multiple]) box-tag {
    background-color: Highlight;
    width: fit-content;
    max-width: 100%;
  }

  box-tag [part*="tag-label"] {
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
    user-select: none;
    font-size: 95%;
    flex-grow: 1;
  }
  
  :host([multiple]) box-tag[part*="tag-label"] {
    flex-grow: unset;
  }
  
  [part*="clear-tag"], [part*="clear-all"] {
    border-radius: 100%;
    border: none;
    aspect-ratio: 1;
    line-height: 0;
    padding: 0!important;
    user-select: none;
    background-color: transparent;
  }
  
  [part*="clear-tag"] {
    inline-size: 1em;
    block-size: 1em;
    font-size: 80%;
    display: none;
  }

  :host([multiple]) [part*="clear-all"] {
   display: block;
  }
  
  :host([clearable]) [part*="clear-tag"],
  :host([multiple]) [part*="clear-tag"] {
    display: block;
  }

  [part*="clear-all"] {
    font-size: inherit;
    inline-size: 1.2em;
    block-size: 1.2em;
    display: none;
  }

  [part*="clear-all"]:hover, 
  [part*="clear-tag"]:hover {
    color: ActiveText;
    cursor: pointer;
  }

  [part*="clear-all"]:hover {
    background-color: ButtonFace;
  }
  
  :host:has(#tags:empty) [part*="clear-all"] {
    pointer-events: none;
    color: darkgrey;
  }
</style>
<div id="tags"></div>
<div id="placeholder">&nbsp;</div>
<button part="clear-all">✕</button>
<div id="dropdown" popover="manual">
  <input name="search-input" part="search-input" />
  <div part="options"></div>
</div>
<template id='tag-template'>
  <box-tag>
    <span part="tag-label"></span>
    <button part="clear-tag">✕</button>
  </box-tag>
</template>
`
}
