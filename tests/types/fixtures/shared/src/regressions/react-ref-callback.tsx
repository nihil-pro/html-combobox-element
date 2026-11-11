/**
 * Was broken: `ref` is typed `unknown`.
 *
 * A callback ref's parameter gets no contextual type, so under `strict` it is an implicit `any`
 * (TS7006), and a RefObject of the wrong element type is accepted.
 * Fixed by: in the React augmentation use React's own `Ref<HTMLComboboxElement>` (e.g. by extending
 * React.HTMLAttributes / React.RefAttributes).
 */
import 'html-combobox-element';
import * as React from 'react';
import type { Equal, Expect } from '../assert.js';

export function RefCallback() {
  const wrong = React.useRef<HTMLInputElement>(null);
  return (
    <>
      <combo-box
        ref={(element) => {
          type _ = Expect<Equal<typeof element, HTMLElementTagNameMap['combo-box'] | null>>;
        }}
      />
      {/* @ts-expect-error a ref to an <input> is not a ref to a <combo-box> */}
      <combo-box ref={wrong} />
    </>
  );
}
