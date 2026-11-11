/**
 * Was broken: React handlers are typed as native DOM events, but React passes SyntheticEvents.
 *
 * In React 19 `onChange`, `onInput`, `onFocus`, `onBlur`, `onClick`, ... on a custom element go
 * through React's event system: the handler gets a SyntheticBaseEvent (no `composedPath()`,
 * not `instanceof Event`, has `nativeEvent`) - see tests/react-events.spec.ts. The typings say
 * `ComboboxEvent` (a DOM Event), so:
 *   - React's own handler types (React.ChangeEventHandler<...>) are rejected,
 *   - `event.nativeEvent` is a type error although it exists,
 *   - `event.composedPath()` type-checks but throws at runtime.
 * Fixed by: in `declare module 'react'` type handlers with React's event types, e.g.
 *   onChange?: React.ChangeEventHandler<HTMLComboboxElement>
 */
import 'html-combobox-element';
import * as React from 'react';

type Combobox = HTMLElementTagNameMap['combo-box'];

const onChange: React.ChangeEventHandler<Combobox> = (event) => event.target.valueAsArray;
const onFocus: React.FocusEventHandler<Combobox> = (event) => event.target.valueAsArray;

export function Synthetic() {
  return (
    <>
      <combo-box onChange={onChange} onFocus={onFocus} />
      <combo-box onChange={(event) => event.nativeEvent} />
      <combo-box
        onInput={(event) => {
          // @ts-expect-error SyntheticEvent has no composedPath() - this throws at runtime
          event.composedPath();
        }}
      />
    </>
  );
}
