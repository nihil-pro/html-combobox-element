/**
 * Code written as if it used React, built with react → preact/compat, with both react and preact
 * (and @types/react) installed. The 'react' augmentation may land on preact/compat (tsconfig
 * `paths` alias) or on the real @types/react (no alias): either way <combo-box> must be typed for
 * Preact, which passes native DOM events (compat only adds persist/nativeEvent to them).
 */
import 'html-combobox-element';
import { useRef, useState } from 'react';
import type { Equal, Expect, IsAny } from './assert.js';

export function App() {
  const ref = useRef<HTMLElementTagNameMap['combo-box']>(null);
  const [fruits, setFruits] = useState<string[]>([]);
  return (
    <combo-box
      ref={ref}
      class="picker"
      name="fruit"
      multiple
      onChange={(event) => {
        type _ = [Expect<Equal<IsAny<typeof event>, false>>, Expect<Equal<typeof event.target.valueAsArray, string[]>>];
        event.composedPath(); // a real DOM event in Preact
        setFruits(event.target.valueAsArray);
      }}
    >
      <box-option value="cherry" disabled>Cherry</box-option>
      <box-option value="date" disabled={false} selected>Date</box-option>
      <box-option value="apple">Apple {fruits.length}</box-option>
    </combo-box>
  );
}

export function Rejected() {
  return (
    <>
      {/* @ts-expect-error unknown attribute */}
      <combo-box bogus="1" />
      {/* @ts-expect-error <box-option> requires value */}
      <box-option>Apple</box-option>
    </>
  );
}
