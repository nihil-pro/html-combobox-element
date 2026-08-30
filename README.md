# html-combobox-element

The `<combo-box>` is a web component that provides dropdown/combobox functionality through `<select>` fully compatible API. 

## Install
```sh
npm install html-combobox-element
```

```ts
// app entry point
import 'html-combobox-element';
```
This registers the `<combo-box>`, `<box-option>` and `<box-tag>` custom elements with full TS support for plain DOM/vanilla-JS usage.

### TypeScript + JSX
Using `<combo-box>` in JSX or a Vue template needs one extra step, due to a TypeScript limitation: JSX/template type-checking only picks up custom element typings from a
file in your own project - not from a package's shipped `.d.ts`. 

This isn't specific to this package; it affects any library adding custom elements to `JSX.IntrinsicElements` under the modern automatic JSX runtime.

So, in addition to `import 'html-combobox-element'`, create and include one small file tsconfig.json, with the snippet for your framework: 

<details>
<summary><strong>React</strong> (<code>jsx: "react-jsx"</code>)</summary>

```ts
// combo-box.d.ts
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
```

</details>

<details>
<summary><strong>Preact</strong> (<code>jsx: "react-jsx"</code>, <code>jsxImportSource: "preact"</code>)</summary>

```ts
// combo-box.d.ts
declare module 'preact/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements {
      'combo-box': ComboboxElementAttributes;
      'box-option': ComboboxOptionElementAttributes;
      'box-tag': ComboboxTagElementAttributes;
    }
  }
}
```

</details>

<details>
<summary><strong>Solid</strong> (<code>jsx: "preserve"</code>, <code>jsxImportSource: "solid-js"</code>)</summary>

```ts
// combo-box.d.ts
declare module 'solid-js/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements {
      'combo-box': ComboboxElementAttributes;
      'box-option': ComboboxOptionElementAttributes;
      'box-tag': ComboboxTagElementAttributes;
    }
  }
}
```

</details>

<details>
<summary><strong>Vue</strong> (SFC <code>&lt;template&gt;</code>, checked via <code>vue-tsc</code>)</summary>

Vue templates aren't JSX, so they're type-checked through `GlobalComponents` instead:

```ts
// combo-box.d.ts
declare module 'vue' {
  export interface GlobalComponents {
    'combo-box': new () => { $props: ComboboxElementAttributes };
    'box-option': new () => { $props: ComboboxOptionElementAttributes };
  }
}

```

This checks required props and value types for props you pass; like any native custom
element, Vue still allows extra/unrecognized attributes through (that's expected Vue
behavior for custom elements, not a gap in this typing). The trailing `export {};` may be 
required here (without it the file is treated as a script, not a module, and the
augmentation breaks Vue's own types).

</details>

### Exported types

- `HTMLComboboxElement`, `HTMLComboboxOptionElement`, `HTMLComboboxTagElement` - element
  interfaces, also usable via `document.querySelector('combo-box')` etc.
- `ComboboxEvent`, `ComboboxInputEvent`, `ComboboxFocusEvent` - typed event objects
  (`event.target` is a properly typed `HTMLComboboxElement`).
- `ComboboxJsxAttributes`, `ComboboxOptionJsxAttributes` - the component's own props
  (`value`, `multiple`, `placeholder`, `clearable`, `searchable`, `filterable`,
  `required`, `disabled`, etc.), framework-independent.
- `ComboboxElementAttributes`, `ComboboxOptionElementAttributes`,
  `ComboboxTagElementAttributes` - the above plus common passthrough attributes
  (`class`/`className`, `style`, `ref`, `children`, `data-*`, `aria-*`, `on*`). These
  are what the snippets above use for `'combo-box'` / `'box-option'` / `'box-tag'`.
