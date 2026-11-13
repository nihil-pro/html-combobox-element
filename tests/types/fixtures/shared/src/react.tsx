/**
 * React JSX typing of <combo-box>, <box-option>, <box-tag>.
 *
 * Compiled under jsx: "react-jsx" (react/jsx-runtime), "react-jsxdev" (react/jsx-dev-runtime) and
 * "react" (classic, React.createElement → React.JSX). Each mode looks up `JSX.IntrinsicElements`
 * from a different place, so each one has to see the package's augmentation.
 *
 * These assertions describe what must stay true. Known gaps (where the types disagree with what
 * React does at runtime) live in ./gaps and are tracked as expected failures.
 */
import 'html-combobox-element';
import * as React from 'react';
import type { Equal, Expect, IsAny } from './assert.js';

const FRUITS = ['apple', 'banana'] as const;

export function Basic() {
  const ref = React.useRef<HTMLElementTagNameMap['combo-box']>(null);
  return (
    <form>
      <combo-box
        ref={ref}
        id="fruit"
        className="picker"
        class="picker"
        style={{ width: 300 }}
        hidden={false}
        tabIndex={0}
        title="Fruit"
        slot="field"
        data-testid="fruit"
        aria-label="Fruit"
        multiple
        clearable={false}
        filterable
        searchable={false}
        required
        disabled={false}
        placeholder="Pick a fruit"
        query=""
        value="apple,banana"
      >
        <optgroup label="Fruits">
          {FRUITS.map((fruit) => (
            <box-option key={fruit} value={fruit} label={fruit} selected={fruit === 'apple'}>
              {fruit}
            </box-option>
          ))}
        </optgroup>
        <box-option value="cherry" disabled>Cherry</box-option>
        <box-option value="date" disabled={false} selected={false}>Date</box-option>
        <box-tag slot="tag" />
      </combo-box>
    </form>
  );
}

// --- Event handlers: whatever the exact event type, `target` must be the combobox -------------
export function Events() {
  return (
    <combo-box
      onChange={(event) => {
        type _ = [
          Expect<Equal<IsAny<typeof event>, false>>,
          Expect<Equal<typeof event.target.valueAsArray, string[]>>,
          Expect<Equal<typeof event.currentTarget.value, string>>,
          Expect<Equal<typeof event.type, string>>,
        ];
        event.preventDefault();
        event.stopPropagation();
      }}
      onInput={(event) => {
        type _ = Expect<Equal<typeof event.target.query, string>>;
      }}
      onFocus={(event) => {
        type _ = Expect<Equal<typeof event.target.multiple, boolean>>;
      }}
      onBlur={(event) => {
        type _ = Expect<Equal<IsAny<typeof event>, false>>;
      }}
      onInvalid={(event) => {
        type _ = Expect<Equal<typeof event.target.validity, ValidityState>>;
      }}
      // React 19 attaches non-React `on*` props of custom elements as native listeners, by the
      // exact (case-sensitive) event name: "close" and "search" need lowercase props.
      onclose={() => {}}
      onsearch={() => {}}
    />
  );
}

// --- What must NOT compile -------------------------------------------------------------------
export function Rejected() {
  return (
    <>
      {/* @ts-expect-error unknown attribute */}
      <combo-box bogus="1" />
      {/* @ts-expect-error boolean attribute given a string */}
      <combo-box multiple="true" />
      {/* @ts-expect-error value is a string */}
      <combo-box value={1} />
      {/* @ts-expect-error placeholder is a string */}
      <combo-box placeholder={null} />
      {/* @ts-expect-error <box-option> requires value */}
      <box-option>Apple</box-option>
      {/* @ts-expect-error selected is boolean */}
      <box-option value="a" selected="selected" />
      <combo-box
        // @ts-expect-error handler must accept the event, not a string
        onChange={(value: string) => value}
      />
    </>
  );
}

// --- The README example ------------------------------------------------------------------------
export function ReadmeExample({ setFruits, save }: { setFruits: (fruits: string[]) => void; save: () => void }) {
  return (
    <combo-box
      name="fruit"
      multiple
      onChange={(event) => setFruits(event.target.valueAsArray)}
      onclose={(event) => event.target.changed && save()}
    >
      <box-option value="apple">Apple</box-option>
    </combo-box>
  );
}

// --- The README's listener hook (needed on React 18, where onChange/onclose never fire) ---------
// Uses the global ComboboxEventMap and element types, without importing them.
export function useComboboxEvent<K extends keyof ComboboxEventMap>(
  ref: React.RefObject<HTMLElementTagNameMap['combo-box'] | null>,
  type: K,
  handler: (event: ComboboxEventMap[K]) => void,
) {
  const latest = React.useRef(handler);
  latest.current = handler;
  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const listener = (event: ComboboxEventMap[K]) => latest.current(event);
    element.addEventListener(type, listener);
    return () => element.removeEventListener(type, listener);
  }, [ref, type]);
}

export function ReadmeHookExample({ setFruits }: { setFruits: (fruits: string[]) => void }) {
  const ref = React.useRef<HTMLComboboxElement>(null);
  useComboboxEvent(ref, 'change', (event) => setFruits(event.target.valueAsArray));
  useComboboxEvent(ref, 'close', (event) => {
    const changed: boolean = event.target.changed;
    return changed;
  });
  return <combo-box ref={ref} multiple />;
}
