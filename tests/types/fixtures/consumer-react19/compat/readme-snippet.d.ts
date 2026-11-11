// The README's React snippet, as users copied it into their projects
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
export {};
