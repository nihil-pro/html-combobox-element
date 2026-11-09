import { HTMLComboboxOptionElement } from './HTML.combobox.option.element.js';

interface CollectionSource {
  /** The listbox the options live in (inside the combobox shadow root) */
  container: () => HTMLElement;
  /** Live list of the options, in tree order (optgroup children included) */
  options: () => NodeListOf<HTMLComboboxOptionElement>;
}

// Kept outside the instance: the collection is used through a Proxy, and private (#) fields
// can't be read through a Proxy receiver.
const sources = new WeakMap<object, CollectionSource>();
const source = (collection: object) => sources.get(collection)!;

const isIndex = (prop: PropertyKey): prop is string => typeof prop === 'string' && /^(0|[1-9]\d*)$/.test(prop);

/**
 * The `options` of a `<combo-box>`: an implementation of `HTMLOptionsCollection`, whose constructor
 * is not exposed (it can't be constructed or subclassed). Same behaviour as `select.options`:
 * it is live, supports `options[i]` (also as an assignment target), `length` (also settable),
 * `item()`, `namedItem()`, `add()`, `remove()`, `selectedIndex` and iteration.
 */
export class HTMLComboboxOptionsCollection {
  [index: number]: HTMLComboboxOptionElement;

  constructor(source: CollectionSource) {
    sources.set(this, source);
    const proxy = new Proxy(this, {
      get(target, prop, receiver) {
        if (isIndex(prop)) return target.item(Number(prop)) ?? undefined;
        if (typeof prop === 'symbol' || prop in target) return Reflect.get(target, prop, receiver);
        return target.namedItem(prop) ?? undefined;
      },
      set(target, prop, value, receiver) {
        if (isIndex(prop)) {
          target.#setIndexed(Number(prop), value);
          return true;
        }
        return Reflect.set(target, prop, value, receiver);
      },
      has(target, prop) {
        if (isIndex(prop)) return Number(prop) < target.length;
        if (typeof prop === 'symbol' || prop in target) return Reflect.has(target, prop);
        return target.namedItem(prop) !== null;
      },
      ownKeys(target) {
        const names = new Set<string>();
        for (const option of target) {
          if (option.id) names.add(option.id);
          const name = option.getAttribute('name');
          if (name) names.add(name);
        }
        const indices = Array.from({ length: target.length }, (_, i) => String(i));
        return [...indices, ...Array.from(names).filter((name) => !isIndex(name)), ...Reflect.ownKeys(target)];
      },
      getOwnPropertyDescriptor(target, prop) {
        if (isIndex(prop)) {
          const value = target.item(Number(prop));
          return value ? { value, enumerable: true, configurable: true, writable: true } : undefined;
        }
        if (typeof prop === 'string' && !(prop in target)) {
          const value = target.namedItem(prop);
          return value ? { value, enumerable: true, configurable: true, writable: false } : undefined;
        }
        return Reflect.getOwnPropertyDescriptor(target, prop);
      },
      deleteProperty(target, prop) {
        // Like the native collection, indexed and named properties can't be deleted
        if (isIndex(prop) || (typeof prop === 'string' && !(prop in target))) return false;
        return Reflect.deleteProperty(target, prop);
      },
    });
    sources.set(proxy, source);
    return proxy;
  }

  get [Symbol.toStringTag]() {
    return 'HTMLOptionsCollection';
  }

  *[Symbol.iterator](): IterableIterator<HTMLComboboxOptionElement> {
    yield* Array.from(source(this).options());
  }

  get length() {
    return source(this).options().length;
  }

  /** Like `select.options.length = n`: appends blank options, or removes the last ones. */
  set length(value: number) {
    const length = Number(value) >>> 0;
    const options = Array.from(source(this).options());
    if (length > options.length) {
      source(this).container().append(...HTMLComboboxOptionsCollection.#blankOptions(length - options.length));
    } else {
      options.slice(length).forEach((option) => option.remove());
    }
  }

  item(index: number): HTMLComboboxOptionElement | null {
    return source(this).options().item(Number(index) >>> 0) ?? null;
  }

  /** The first option whose `id` or `name` attribute is `name` */
  namedItem(name: string): HTMLComboboxOptionElement | null {
    if (name === '') return null;
    for (const option of this) {
      if (option.id === name || option.getAttribute('name') === name) return option;
    }
    return null;
  }

  /**
   * Inserts an option (or optgroup) before `before` (an option/optgroup of this list, or an index),
   * or at the end. Throws like `select.options.add()`.
   */
  add(element: HTMLComboboxOptionElement | HTMLOptGroupElement, before?: HTMLElement | number | null) {
    const isOption = element instanceof HTMLComboboxOptionElement || (element instanceof Element && element.localName === 'box-option');
    if (!isOption && !(element instanceof HTMLOptGroupElement)) {
      throw new TypeError(`Failed to execute 'add' on 'HTMLOptionsCollection': The provided value is not a <box-option> or an <optgroup>.`);
    }
    const container = source(this).container();
    let reference: Node | null = null;
    if (typeof before === 'number') {
      reference = this.item(before);
    } else if (before != null) {
      if (!container.contains(before)) {
        throw new DOMException(`Failed to execute 'add' on 'HTMLOptionsCollection': The node before which the new node is to be inserted is not a child of this node.`, 'NotFoundError');
      }
      reference = before;
    }
    if (element === reference) return;
    const parent = reference?.parentNode ?? container;
    parent.insertBefore(element, reference);
  }

  /** Removes the option at `index` (does nothing when out of range) */
  remove(index: number) {
    this.item(index)?.remove();
  }

  /** Index of the first selected option, or -1. Setting it selects only that option. */
  get selectedIndex() {
    return Array.from(this).findIndex((option) => option.selected);
  }
  set selectedIndex(value: number) {
    const index = Number(value);
    const options = Array.from(this);
    // Deselect first, so a single-select combobox doesn't see two selections at once
    options.forEach((option, i) => { if (i !== index) option.selected = false; });
    if (options[index]) options[index].selected = true;
  }

  // `options[i] = option`, as specified for HTMLOptionsCollection: null removes the option at i;
  // past the end, pads with blank options; otherwise replaces the option at i in place (inside its
  // optgroup, if any). Chrome's native implementation diverges there: it moves the new option out
  // of the optgroup, or throws when the next option is in one.
  #setIndexed(index: number, value: unknown) {
    if (value == null) {
      this.remove(index);
      return;
    }
    if (!(value instanceof HTMLComboboxOptionElement) && !(value instanceof Element && value.localName === 'box-option')) {
      throw new TypeError(`Failed to set an indexed property on 'HTMLOptionsCollection': The provided value is not a <box-option>.`);
    }
    const length = this.length;
    if (index >= length) {
      source(this).container().append(...HTMLComboboxOptionsCollection.#blankOptions(index - length), value);
      return;
    }
    const current = this.item(index)!;
    if (current !== value) current.parentNode!.replaceChild(value as HTMLComboboxOptionElement, current);
  }

  static #blankOptions(count: number) {
    return Array.from({ length: count }, () => document.createElement('box-option'));
  }
}
