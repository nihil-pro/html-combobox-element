// Type-only, side-effect-free imports. These exist purely so TypeScript accepts the
// `declare module '...'` augmentations below while *building this package* (an ambient
// module augmentation must resolve to a real module in the current compilation). They
// carry no exported bindings, so they're always elided from the emitted JS and, since
// nothing below re-exports anything from them, from the emitted .d.ts as well - meaning
// consumers who don't have react/preact/solid-js/vue installed never need them.
import type {} from 'react';
import type {} from 'react/jsx-runtime';
import type {} from 'react/jsx-dev-runtime';
import type {} from 'preact';
import type {} from 'preact/jsx-runtime';
import type {} from 'solid-js';
import type {} from 'solid-js/jsx-runtime';
import type {} from 'vue';

export * from './combobox/index.js';

interface HTMLComboboxTagElement extends HTMLElement {}

interface HTMLComboboxOptionElement extends HTMLOptionElement {
  value: string
  label: string
}

interface HTMLComboboxElement extends HTMLSelectElement {
  /** List of selected options value attribute */
  valueAsArray: string[];

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


  // For standard events - let TypeScript infer correctly
  addEventListener<K extends keyof HTMLElementEventMap>(
    type: K,
    listener: (this: HTMLComboboxElement, ev: HTMLElementEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions
  ): void;

  // For your custom events
  addEventListener<K extends keyof ComboboxEventMap>(
    type: K,
    listener: (this: HTMLComboboxElement, ev: ComboboxEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions
  ): void;

  // Fallback
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void;

  // Similar for removeEventListener
  removeEventListener<K extends keyof HTMLElementEventMap>(
    type: K,
    listener: (this: HTMLComboboxElement, ev: HTMLElementEventMap[K]) => any,
    options?: boolean | EventListenerOptions
  ): void;

  removeEventListener<K extends keyof ComboboxEventMap>(
    type: K,
    listener: (this: HTMLComboboxElement, ev: ComboboxEventMap[K]) => any,
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

  // Classic global JSX namespace (React <19 without `jsxImportSource`, older Preact/Solid
  // setups that never opt into module-scoped JSX). Safe because it only uses our own
  // framework-agnostic attribute types above.
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
export type {
  ComboboxEvent,
  ComboboxInputEvent,
  ComboboxFocusEvent,
  ComboboxElementAttributes,
  ComboboxOptionElementAttributes,
  ComboboxTagElementAttributes,
};

// --- Framework JSX augmentations below ------------------------------------
//
// KNOWN LIMITATION: under the automatic JSX runtime (`jsx: "react-jsx"`, or
// `jsx: "preserve"` + `jsxImportSource`), TypeScript resolves `JSX.IntrinsicElements`
// through `<jsxImportSource>/jsx-runtime`, and it only honors declaration-merging
// augmentations of that module when they live in a project-local file - NOT when
// they ship from a `node_modules` package (verified against real React/Preact/Solid
// projects; this holds for every augmentation shape/target, it's not specific to how
// these are written below). These declarations are kept because they're harmless and
// may still help in toolchains that don't hit that limitation, but the augmentation
// that actually activates for you needs to be copied into your own project - see the
// per-framework snippets in the README.

// React
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'combo-box': ComboboxElementAttributes;
      'box-option': ComboboxOptionElementAttributes;
      'box-tag': ComboboxTagElementAttributes;
    }
  }
}
declare module 'react/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements {
      'combo-box': ComboboxElementAttributes;
      'box-option': ComboboxOptionElementAttributes;
      'box-tag': ComboboxTagElementAttributes;
    }
  }
}
declare module 'react/jsx-dev-runtime' {
  namespace JSX {
    interface IntrinsicElements {
      'combo-box': ComboboxElementAttributes;
      'box-option': ComboboxOptionElementAttributes;
      'box-tag': ComboboxTagElementAttributes;
    }
  }
}

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
