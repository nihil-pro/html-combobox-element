/**
 * Was broken: every other `on*` handler is `(event: any) => void`.
 *
 * The template-literal index signature `[key: `on${string}`]` makes onClick, onKeyDown,
 * onPointerDown, ... (and typos) type-check with an `any` event.
 * Fixed by: inherit React's DOMAttributes in the React augmentation.
 */
import 'html-combobox-element';
import type { Equal, Expect, IsAny } from '../assert.js';

export function Handlers() {
  return (
    <combo-box
      onClick={(event) => {
        type _ = Expect<Equal<IsAny<typeof event>, false>>;
      }}
      onKeyDown={(event) => {
        type _ = Expect<Equal<typeof event.key, string>>;
      }}
    />
  );
}
