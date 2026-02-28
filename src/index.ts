/// <reference types="solid-js" />
/// <reference types="preact" />
/// <reference types="react" />
/// <reference types="vue" />

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

interface HTMLElementTagNameMap {
  'combo-box': HTMLComboboxElement;
  'box-option': HTMLComboboxOptionElement;
  'box-tag': HTMLComboboxTagElement;
}

interface ComboboxJsxAttributes {
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

interface ComboboxOptionJsxAttributes {
  value: string;
  label?: string;
  selected?: boolean
}


declare global {
  // React 17/18 style
  namespace JSX {
    interface IntrinsicElements {
      'combo-box': React.DetailedHTMLProps<React.HTMLAttributes<HTMLComboboxElement> & ComboboxJsxAttributes, HTMLComboboxElement>;
      'box-option': React.DetailedHTMLProps<React.HTMLAttributes<HTMLComboboxOptionElement> & ComboboxOptionJsxAttributes, HTMLComboboxOptionElement>;
      'box-tag': React.DetailedHTMLProps<React.HTMLAttributes<HTMLComboboxTagElement>, HTMLComboboxTagElement>;
    }
  }

  // React 19 style
  namespace React {
    namespace JSX {
      interface IntrinsicElements {
        'combo-box': React.DetailedHTMLProps<React.HTMLAttributes<HTMLComboboxElement> & ComboboxJsxAttributes, HTMLComboboxElement>;
        'box-option': React.DetailedHTMLProps<React.HTMLAttributes<HTMLComboboxOptionElement> & ComboboxOptionJsxAttributes, HTMLComboboxOptionElement>;
        'box-tag': React.DetailedHTMLProps<React.HTMLAttributes<HTMLComboboxTagElement>, HTMLComboboxTagElement>;
      }
    }
  }


  // Solid style
  namespace Solid {
    namespace JSX {
      interface IntrinsicElements {
        'combo-box': any;
        'box-option': any;
        'box-tag': any;
      }
    }
  }

  // Vue style
  namespace Vue {
    namespace JSX {
      interface IntrinsicElements {
        'combo-box': any;
        'box-option': any;
        'box-tag': any;
      }
    }
  }


  // JSXInternal (Preact internal)
  namespace JSXInternal {
    interface IntrinsicElements {
      'combo-box': preact.HTMLAttributes<HTMLComboboxElement> & ComboboxJsxAttributes
      'box-option':  preact.HTMLAttributes<HTMLComboboxElement> & ComboboxOptionJsxAttributes
      'box-tag':  preact.HTMLAttributes<HTMLComboboxTagElement> & {}
    }
  }


}

// Also cover module augmentations for common ones
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'combo-box': React.DetailedHTMLProps<React.HTMLAttributes<HTMLComboboxElement> & ComboboxJsxAttributes, HTMLComboboxElement>;
      'box-option': React.DetailedHTMLProps<React.HTMLAttributes<HTMLComboboxOptionElement> & ComboboxOptionJsxAttributes, HTMLComboboxOptionElement>;
      'box-tag': React.DetailedHTMLProps<React.HTMLAttributes<HTMLComboboxTagElement>, HTMLComboboxTagElement>;
    }
  }
}

declare module 'preact' {
  namespace JSX {
    interface IntrinsicElements {
      'combo-box': any;
      'box-option': any;
      'box-tag': any;
    }
  }
  namespace JSXInternal {
    interface IntrinsicElements {
      'combo-box': any;
      'box-option': any;
      'box-tag': any;
    }
  }
}

declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicElements {
      'combo-box': any;
      'box-option': any;
      'box-tag': any;
    }
  }
}

declare module 'vue' {
  namespace JSX {
    interface IntrinsicElements {
      'combo-box': any;
      'box-option': any;
      'box-tag': any;
    }
  }
}



// declare global {
//   namespace React {
//     namespace JSX {
//       interface IntrinsicElements {
//         'combo-box': React.DetailedHTMLProps<Omit<React.HTMLAttributes<HTMLComboboxElement>, 'defaultValue'>,
//           HTMLComboboxElement
//         > & ComboboxJsxAttributes;
//
//         'box-option': React.DetailedHTMLProps<
//           React.HTMLAttributes<HTMLComboboxOptionElement>,
//           HTMLComboboxOptionElement>
//         & ComboboxOptionJsxAttributes;
//
//         'box-tag': React.DetailedHTMLProps<React.HTMLAttributes<HTMLComboboxTagElement>, HTMLComboboxTagElement>;
//       }
//     }
//   }
//
//
//   namespace preact {
//     namespace JSX {
//       interface IntrinsicElements {
//         'combo-box': preact.HTMLAttributes<HTMLComboboxElement> & ComboboxJsxAttributes;
//         'box-option': preact.HTMLAttributes<HTMLComboboxOptionElement> & ComboboxOptionJsxAttributes;
//         'box-tag': preact.HTMLAttributes<HTMLComboboxTagElement>;
//       }
//     }
//   }
//
// }
//
// declare module 'preact' {
//   namespace JSX {
//     interface IntrinsicElements {
//       'combo-box': preact.HTMLAttributes<HTMLComboboxElement> & ComboboxJsxAttributes;
//       'box-option': preact.HTMLAttributes<HTMLComboboxOptionElement> & ComboboxOptionJsxAttributes;
//       'box-tag': preact.HTMLAttributes<HTMLComboboxTagElement>;
//     }
//   }
// }
//
// // Solid
// declare module 'solid-js' {
//   namespace JSX {
//     interface IntrinsicElements {
//       'combo-box': HTMLAttributes<HTMLComboboxElement> & ComboboxJsxAttributes
//       'box-option': HTMLAttributes<HTMLComboboxOptionElement> & ComboboxOptionJsxAttributes
//       'box-tag': HTMLAttributes<HTMLElement>
//     }
//   }
// }
//
//
// declare global {
//   namespace JSX {
//     interface IntrinsicElements {
//       'combo-box': ComboboxJsxAttributes;
//       'box-option': ComboboxOptionJsxAttributes;
//       'box-tag': HTMLElement;
//     }
//   }
// }