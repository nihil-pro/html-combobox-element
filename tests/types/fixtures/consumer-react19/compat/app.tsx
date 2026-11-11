// Compiled together with readme-snippet.d.ts: projects that copied the React snippet from the
// README of earlier versions must keep compiling (they keep the framework-agnostic typings until
// they delete the snippet, which is no longer needed).
import 'html-combobox-element';

export const App = () => (
  <combo-box multiple onChange={(event) => event.target.valueAsArray}>
    <box-option value="a">A</box-option>
  </combo-box>
);
