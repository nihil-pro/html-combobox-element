// Type-only, side-effect-free imports.
// These exist purely so TypeScript accepts the
// `declare module '...'` augmentations below while *building this package* (an ambient
// module augmentation must resolve to a real module in the current compilation). They
// carry no exported bindings, so they're always elided from the emitted JS and, since
// nothing below re-exports anything from them, from the emitted .d.ts as well - meaning
// consumers who don't have react/preact/solid-js/vue installed never need them.
import type {} from 'react';
import type {} from 'preact';
import type {} from 'preact/jsx-runtime';
import type {} from 'solid-js';
import type {} from 'solid-js/jsx-runtime';
import type {} from 'vue';

import { HTMLComboboxElement as ComboboxElementClass } from './combobox/HTML.combobox.element.js';
import type { HTMLComboboxOptionsCollection } from './combobox/HTML.combobox.options.collection.js';

export * from './combobox/index.js';

/**
 * The `<combo-box>` constructor, typed the way lib.dom types built-in elements
 * (`interface HTMLSelectElement` + `declare var HTMLSelectElement: { prototype; new() }`):
 * the same `HTMLComboboxElement` type is what `document.createElement('combo-box')`,
 * `querySelector('combo-box')`, `event.target`, refs and `instanceof HTMLComboboxElement` give.
 *
 * Runtime-wise this is the very same class object that `export *` exported before.
 */
export const HTMLComboboxElement: Omit<typeof ComboboxElementClass, 'prototype'> & {
  prototype: HTMLComboboxElement;
  new (): HTMLComboboxElement;
} = ComboboxElementClass as any;

interface HTMLComboboxTagElement extends HTMLElement {}

interface HTMLComboboxOptionElement extends HTMLOptionElement {
  value: string
  label: string
}

export interface HTMLComboboxElement extends HTMLSelectElement {
  /** List of selected options value attribute */
  valueAsArray: string[];

  /** Whether the value differs from when the picker opened (read it in a `close` listener). */
  readonly changed: boolean;

  /** A live `HTMLOptionsCollection`-compatible collection (not `instanceof HTMLOptionsCollection`). */
  readonly options: HTMLOptionsCollection & HTMLComboboxOptionsCollection;

  multiple: boolean;

  /** The value of internal input
   *
   * Internal input is visible when either "searchable" or "filterable" attribute is presented */
  query: string;

  /** The placeholder of internal input
   *
   * Internal input is visible when either "searchable" or "filterable" attribute is presented
   *
   * When <combo-box> is empty, this value is also shown as <combo-box> placeholder itself
   * */
  placeholder: string;

  /** When is true, the clear-all-button is shown in the <combo-box> itself,
   * and the clear-button is shown for each selected tag.
   *
   * If multiple attribute is set to "true", this is also enabled.
   *
   * If multiple attribute is set to "false", i.e. the <combo-box> is used as a <select>,
   * then setting this attribute to "true" will make the clear-button of selected tag visible
   * */
  clearable: boolean;

  /** When is true, the internal input is shown.
   *
   * When user type something, available options are not filtered by this query.
   * You have to set an "input" listener to the <combo-box> and filter options by yourself
   *
   * Setting both "searchable" and "filterable" make no sense, the "searchable" will have priority
   * */
  searchable: boolean;

  /** When is true, the internal input is shown.
   *
   * When user type something, available options are filtered by this query.
   *
   * Setting both "filterable" and "searchable" make no sense, the "searchable" will have priority
   * */
  filterable: boolean;

  selectedOptions: HTMLCollectionOf<HTMLComboboxOptionElement>;


  // The combobox's own event map first: it extends HTMLElementEventMap and overrides some of
  // its keys ('change', 'input', 'focus', ...). Declared after the HTMLElementEventMap overload,
  // it was unreachable - overload resolution always stopped at the first one.
  addEventListener<K extends keyof ComboboxEventMap>(
    type: K,
    listener: (this: HTMLComboboxElement, ev: ComboboxEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions
  ): void;

  addEventListener<K extends keyof HTMLElementEventMap>(
    type: K,
    listener: (this: HTMLComboboxElement, ev: HTMLElementEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions
  ): void;

  // Fallback
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void;

  // Similar for removeEventListener
  removeEventListener<K extends keyof ComboboxEventMap>(
    type: K,
    listener: (this: HTMLComboboxElement, ev: ComboboxEventMap[K]) => any,
    options?: boolean | EventListenerOptions
  ): void;

  removeEventListener<K extends keyof HTMLElementEventMap>(
    type: K,
    listener: (this: HTMLComboboxElement, ev: HTMLElementEventMap[K]) => any,
    options?: boolean | EventListenerOptions
  ): void;

  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions
  ): void;
}

interface ComboboxEventMap extends HTMLElementEventMap {
  "change": ComboboxEvent;
  "blur": ComboboxFocusEvent;
  "focus": ComboboxFocusEvent;
  "focusin": ComboboxFocusEvent;
  "focusout": ComboboxFocusEvent;
  "input": ComboboxInputEvent;
  "invalid": ComboboxEvent;
  // "select": ComboboxEvent;
  "selectionchange": ComboboxEvent;
  "selectstart": ComboboxEvent;
  /** The picker closed (read `event.target.changed`) */
  "close": ComboboxEvent;
  /** Enter was pressed in the search field */
  "search": ComboboxEvent;
  /** The owner form was reset */
  "reset": ComboboxEvent;
}

/** Own attributes/properties of `<combo-box>`, shared by every JSX integration below. */
export interface ComboboxJsxAttributes {
  /** The value of the internal input.
   *
   * The internal input is visible when either the `searchable` or `filterable` attribute is present.
   *
   * Setting ""
   * */
  query?: string;

  /** A comma-separated list of descendant `<box-option>` value attributes to be selected by default.
   *
   * When the `multiple` attribute is present, only the first option will be selected.
   *
   * Alternatively, you can set default selections by adding the `selected` attribute directly to individual `<box-option>` elements. */
  value?: string;

  /** This Boolean attribute indicates that multiple options can be selected.
   *
   * When present, users can select multiple options. When absent, only one option can be selected at a time (the `<combo-box>` behaves like a `<select>`). */
  multiple?: boolean;

  /** The placeholder for the internal input.
   *
   * The internal input is visible when either the `searchable` or `filterable` attribute is present.
   *
   * When the `<combo-box>` is empty, this value is also shown as the `<combo-box>` placeholder itself. */
  placeholder?: string;

  /** When present, the clear-all button is shown in the `<combo-box>` itself, and the clear button is shown for each selected tag.
   *
   * This attribute is automatically enabled when the `multiple` attribute is present.
   *
   * When the `multiple` attribute is absent (single-select mode), setting `clearable` makes the clear button visible on the selected tag. */
  clearable?: boolean;

  /** When present, the internal input is shown.
   *
   * As the user types, available options are **not** filtered by the query. You must attach an `input` listener to the `<combo-box>` and filter options manually.
   *
   * Setting both `searchable` and `filterable` is not recommended—`searchable` takes precedence. */
  searchable?: boolean;

  /** When present, the internal input is shown.
   *
   * As the user types, available options are filtered by the query automatically.
   *
   * Setting both `filterable` and `searchable` is not recommended—`searchable` takes precedence. */
  filterable?: boolean;

  /** A Boolean attribute indicating that at least one option must be selected. */
  required?: boolean;

  disabled?: boolean;

  /** The name the value is submitted under (`<combo-box>` is form-associated). */
  name?: string;

  /** The id of the `<form>` this combobox belongs to, when it isn't inside it. */
  form?: string;
}

export interface ComboboxOptionJsxAttributes {
  value: string;
  label?: string;
  selected?: boolean;
}

/**
 * Generic HTML/JSX passthrough attributes (class, style, event handlers, `data-*`, `aria-*`, ...).
 *
 * These are intentionally framework-agnostic: they don't reference React's, Preact's, Vue's
 * or Solid's own type packages, so this file never requires any of them to be installed just
 * to be imported. Every framework below layers `ComboboxJsxAttributes`/`ComboboxOptionJsxAttributes`
 * on top of this instead of that framework's own `HTMLAttributes` type.
 */
export interface ComboboxCommonAttributes {
  id?: string;
  class?: string;
  className?: string;
  style?: unknown;
  slot?: string;
  title?: string;
  tabIndex?: number;
  hidden?: boolean;
  children?: unknown;
  ref?: unknown;
  key?: string | number;

  onChange?: (event: ComboboxEvent) => void;
  onInput?: (event: ComboboxInputEvent) => void;
  onFocus?: (event: ComboboxFocusEvent) => void;
  onBlur?: (event: ComboboxFocusEvent) => void;
  onInvalid?: (event: ComboboxEvent) => void;

  [key: `data-${string}`]: unknown;
  [key: `aria-${string}`]: unknown;
  [key: `on${string}`]: ((event: any) => void) | undefined;
}

declare global {
  interface HTMLElementTagNameMap {
    'combo-box': HTMLComboboxElement;
    'box-option': HTMLComboboxOptionElement;
    'box-tag': HTMLComboboxTagElement;
  }

  // Declared globally (not just exported) so the `declare module '.../jsx-runtime'`
  // snippet a consumer copies into their own project (see README) can reference these
  // by name with no import - just `import 'html-combobox-element'` anywhere in their
  // program (already required to register the custom elements) is enough to make
  // these visible everywhere, including in that local snippet file.
  interface ComboboxEvent extends Event {
    readonly target: HTMLComboboxElement;
    readonly currentTarget: HTMLComboboxElement;
  }

  interface ComboboxInputEvent extends InputEvent {
    readonly target: HTMLComboboxElement;
    readonly currentTarget: HTMLComboboxElement;
  }

  interface ComboboxFocusEvent extends FocusEvent {
    readonly target: HTMLComboboxElement;
  }

  type ComboboxElementAttributes = ComboboxCommonAttributes & ComboboxJsxAttributes;
  type ComboboxOptionElementAttributes = ComboboxCommonAttributes & ComboboxOptionJsxAttributes;
  type ComboboxTagElementAttributes = ComboboxCommonAttributes;

  // Classic global JSX namespace (frameworks that never opted into module-scoped JSX; with
  // @types/react 18 also the base React.JSX is built on). Framework-agnostic attribute types.
  namespace JSX {
    interface IntrinsicElements {
      'combo-box': ComboboxElementAttributes;
      'box-option': ComboboxOptionElementAttributes;
      'box-tag': ComboboxTagElementAttributes;
    }
  }

}

// Also importable explicitly (`import type { ComboboxElementAttributes } from
// 'html-combobox-element'`), for anyone who prefers that over the ambient global above.
// export type {
//   ComboboxEvent,
//   ComboboxInputEvent,
//   ComboboxFocusEvent,
//   ComboboxElementAttributes,
//   ComboboxOptionElementAttributes,
//   ComboboxTagElementAttributes,
// };

// --- Framework JSX augmentations below ------------------------------------
//
// The augmentations below ship with the package and apply from node_modules for every JSX mode:
// classic `React.JSX`, `react/jsx-runtime`, `react/jsx-dev-runtime` (see tests/types). They only
// exist in a TypeScript program that includes this package's .d.ts: a workspace package that
// renders <combo-box> but never imports this package needs `import type {} from 'html-combobox-element'`.

// React. Built on React's own attribute and event types: React passes SyntheticEvents to the
// handlers it knows (onChange, onInput, onFocus, onClick, ...), not DOM events. Events React
// doesn't know ("close", "search") are attached by React 19 as native listeners under the exact,
// case-sensitive prop name, so only the lowercase `onclose`/`onsearch` are declared.
// #region react-type-fallbacks
/*
 * Module-private stand-ins for the React types the augmentation below uses. Inside
 * `declare module 'react'` React's own HTMLAttributes/Key/Ref take precedence; these only resolve
 * when React's types aren't in the program (React not installed, or - on TypeScript 7 - not
 * imported by any checked file). Then the augmentation is inert, and without them a project with
 * `skipLibCheck: false` would get "Cannot find name"/"Cannot find module 'react'" errors from it.
 * (`import('react').X` can't be used for the same reason.)
 * The declaration emitter drops them as unused (React is installed here), so
 * scripts/fix-dual-package.mjs copies this region into the emitted index.d.ts files.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type HTMLAttributes<T> = object;
type Key = string | number | bigint;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type Ref<T> = unknown;
// #endregion react-type-fallbacks

declare module 'react' {
  // Only names that both @types/react and preact/compat export are used here (HTMLAttributes, Key,
  // Ref): with `paths: { "react": ["preact/compat"] }` this augmentation lands on preact/compat,
  // which has no SyntheticEvent / ClassAttributes.

  /**
   * The event React passes to the handlers it manages: React's SyntheticEvent (same members), with
   * `target` being the element (events from the shadow DOM are retargeted to it).
   */
  interface ComboboxSyntheticEvent<T, E extends globalThis.Event = globalThis.Event> {
    nativeEvent: E;
    currentTarget: EventTarget & T;
    target: EventTarget & T;
    bubbles: boolean;
    cancelable: boolean;
    defaultPrevented: boolean;
    eventPhase: number;
    isTrusted: boolean;
    timeStamp: number;
    type: string;
    preventDefault(): void;
    isDefaultPrevented(): boolean;
    stopPropagation(): void;
    isPropagationStopped(): boolean;
    persist(): void;
  }

  /** Bivariant like React's EventHandler, so React's own handler types (ChangeEventHandler...) fit. */
  type ComboboxEventHandler<E> = { bivarianceHack(event: E): void }['bivarianceHack'];

  /** React's ClassAttributes: `key` and a typed `ref`. */
  interface ComboboxClassAttributes<T> {
    key?: Key | null | undefined;
    ref?: Ref<T> | undefined;
  }

  // Type aliases rather than `interface extends`: React's attributes are replaced, not checked
  // for compatibility, which also keeps these valid against preact/compat's HTMLAttributes.
  type ComboboxBaseHTMLAttributes<T extends EventTarget, Own> = Omit<HTMLAttributes<T>, keyof Own | 'class'> & Own & {
    class?: string | undefined;
  };

  type ComboboxHTMLAttributes<T extends EventTarget> = ComboboxBaseHTMLAttributes<T, ComboboxJsxAttributes & {
    /** The user changed the selection (`event.target.value` is the new value). */
    onChange?: ComboboxEventHandler<ComboboxSyntheticEvent<T>> | undefined;
    /** The user typed in the search field (`event.target.query`); `nativeEvent` is its InputEvent. */
    onInput?: ComboboxEventHandler<ComboboxSyntheticEvent<T, globalThis.InputEvent>> | undefined;
    onInvalid?: ComboboxEventHandler<ComboboxSyntheticEvent<T>> | undefined;

    /** Native listener: the picker closed (`event.target.changed`). Lowercase - `onClose` never fires. */
    onclose?: ((event: ComboboxEvent) => void) | undefined;
    /** Native listener: Enter in the search field. Lowercase - `onSearch` never fires. */
    onsearch?: ((event: ComboboxEvent) => void) | undefined;
  }>;

  type ComboboxOptionHTMLAttributes<T extends EventTarget> = ComboboxBaseHTMLAttributes<T, ComboboxOptionJsxAttributes>;

  type ComboboxTagHTMLAttributes<T extends EventTarget> = ComboboxBaseHTMLAttributes<T, {}>;

  /**
   * Which props to use:
   * - @types/react 19: React-typed props (SyntheticEvents, typed ref, React's attributes).
   * - @types/react 18 builds React.JSX.IntrinsicElements on top of the global JSX namespace, so
   *   its entries must stay assignable to the framework-agnostic global ones: those are kept.
   *   (React 18 types declare the HTML elements in the global namespace, React 19 types don't.)
   * - preact/compat aliased as 'react': its JSX is Preact's, and Preact passes native DOM events,
   *   so the framework-agnostic props - the same ones the 'preact' augmentation declares.
   *   (Preact's JSX accepts `class`, React's doesn't.)
   */
  type ComboboxIntrinsicElement<Global, Typed> =
    globalThis.JSX.IntrinsicElements extends { div: unknown } ? Global
    : JSX.IntrinsicElements extends { div: infer Div } ? ('class' extends keyof Div ? Global : Typed)
    : Typed;

  namespace JSX {
    interface IntrinsicElements {
      'combo-box': ComboboxIntrinsicElement<ComboboxElementAttributes, ComboboxClassAttributes<HTMLComboboxElement> & ComboboxHTMLAttributes<HTMLComboboxElement>>;
      'box-option': ComboboxIntrinsicElement<ComboboxOptionElementAttributes, ComboboxClassAttributes<HTMLComboboxOptionElement> & ComboboxOptionHTMLAttributes<HTMLComboboxOptionElement>>;
      'box-tag': ComboboxIntrinsicElement<ComboboxTagElementAttributes, ComboboxClassAttributes<HTMLComboboxTagElement> & ComboboxTagHTMLAttributes<HTMLComboboxTagElement>>;
    }
  }
}
// No separate 'react/jsx-runtime' / 'react/jsx-dev-runtime' augmentations: their JSX namespaces
// extend React.JSX (and before @types/react 18.2.7 they used the global one). Declaring the
// elements there too would clash with the snippet older READMEs told users to copy (TS2717).

// Preact
declare module 'preact' {
  namespace JSX {
    interface IntrinsicElements {
      'combo-box': ComboboxElementAttributes;
      'box-option': ComboboxOptionElementAttributes;
      'box-tag': ComboboxTagElementAttributes;
    }
  }
  namespace JSXInternal {
    interface IntrinsicElements {
      'combo-box': ComboboxElementAttributes;
      'box-option': ComboboxOptionElementAttributes;
      'box-tag': ComboboxTagElementAttributes;
    }
  }
}
// `preact/jsx-runtime` and `preact/jsx-dev-runtime` both resolve to the same
// underlying types file, so augmenting this one covers both.
declare module 'preact/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements {
      'combo-box': ComboboxElementAttributes;
      'box-option': ComboboxOptionElementAttributes;
      'box-tag': ComboboxTagElementAttributes;
    }
  }
}

// Solid. `solid-js` itself re-exports the same `JSX` namespace, but with
// `jsxImportSource: "solid-js"` TS resolves IntrinsicElements through the
// `solid-js/jsx-runtime` subpath, so both need augmenting.
declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicElements {
      'combo-box': ComboboxElementAttributes;
      'box-option': ComboboxOptionElementAttributes;
      'box-tag': ComboboxTagElementAttributes;
    }
  }
}
declare module 'solid-js/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements {
      'combo-box': ComboboxElementAttributes;
      'box-option': ComboboxOptionElementAttributes;
      'box-tag': ComboboxTagElementAttributes;
    }
  }
}

// Vue (JSX/TSX usage via @vue/babel-plugin-jsx or built-in TSX support)
declare module 'vue' {
  namespace JSX {
    interface IntrinsicElements {
      'combo-box': ComboboxElementAttributes;
      'box-option': ComboboxOptionElementAttributes;
      'box-tag': ComboboxTagElementAttributes;
    }
  }
}
