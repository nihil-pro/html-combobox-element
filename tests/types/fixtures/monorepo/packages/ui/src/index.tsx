// A shared UI package that renders <combo-box> but does NOT import html-combobox-element:
// it relies on the app shell to register the element (and, for types, to bring the augmentation).
export function FruitPicker({ onPick }: { onPick: (values: string[]) => void }) {
  return (
    <combo-box multiple placeholder="Fruit" onChange={(event) => onPick(event.target.valueAsArray)}>
      <box-option value="apple">Apple</box-option>
      <box-option value="banana">Banana</box-option>
    </combo-box>
  );
}
