import './register.js';
import { createRoot } from 'react-dom/client';
import type { Equal, Expect } from './assert.js';
import { UsesUi } from './uses-ui.js';
import { UsesUiTyped } from './uses-ui-typed.js';

createRoot(document.getElementById('root')!).render(
  <>
    <UsesUi />
    <UsesUiTyped />
    {/* the shell can use the element directly too */}
    <combo-box
      multiple
      onChange={(event) => {
        type _ = Expect<Equal<typeof event.target.valueAsArray, string[]>>;
      }}
    >
      <box-option value="a">A</box-option>
    </combo-box>
    {/* @ts-expect-error the augmentation is really active: unknown attributes are rejected */}
    <combo-box bogus />
  </>,
);
