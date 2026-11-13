/**
 * Preact JSX typing of <combo-box>, <box-option>, <box-tag>.
 * Compiled with jsx: "react-jsx" + jsxImportSource: "preact" (preact/jsx-runtime → JSXInternal).
 * Preact passes native DOM events to handlers, so ComboboxEvent & co. are the right types here.
 */
import 'html-combobox-element';
import { useRef } from 'preact/hooks';
import type { Equal, Expect, IsAny } from './assert.js';

export function Basic() {
  const ref = useRef<HTMLElementTagNameMap['combo-box']>(null);
  return (
    <combo-box ref={ref} class="picker" name="fruit" multiple placeholder="Fruit" value="apple">
      <box-option value="cherry" disabled>Cherry</box-option>
      <box-option value="date" disabled={false} selected>Date</box-option>
      <box-option value="apple">Apple</box-option>
      <box-tag />
    </combo-box>
  );
}

export function Events() {
  return (
    <combo-box
      onChange={(event) => {
        type _ = [
          Expect<Equal<IsAny<typeof event>, false>>,
          Expect<Equal<typeof event.target.valueAsArray, string[]>>,
        ];
        // a real DOM event in Preact
        event.composedPath();
      }}
      onInput={(event) => {
        type _ = Expect<Equal<typeof event.target.query, string>>;
      }}
    />
  );
}

export function Rejected() {
  return (
    <>
      {/* @ts-expect-error unknown attribute */}
      <combo-box bogus="1" />
      {/* @ts-expect-error boolean attribute given a string */}
      <combo-box multiple="true" />
      {/* @ts-expect-error <box-option> requires value */}
      <box-option>Apple</box-option>
    </>
  );
}
