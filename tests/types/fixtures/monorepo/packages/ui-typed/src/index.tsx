// Same component, with the type-only opt-in: elided from the JS output (no runtime import, no
// double registration), but makes this package's own program see the <combo-box> typings.
import type {} from 'html-combobox-element';

export function TypedFruitPicker({ onPick }: { onPick: (values: string[]) => void }) {
  return (
    <combo-box multiple placeholder="Fruit" onChange={(event) => onPick(event.target.valueAsArray)}>
      <box-option value="apple">Apple</box-option>
      <box-option value="banana">Banana</box-option>
    </combo-box>
  );
}
