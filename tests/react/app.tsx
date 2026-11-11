/**
 * A React 19 app rendering <combo-box>, bundled by tests/react-events.spec.ts.
 * Every handler records what React actually passed to it, so the spec can compare that with
 * what the JSX typings promise.
 */
import '../../src/index.ts';
import { useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

export interface Call {
  prop: string;
  type: string;
  /** a React SyntheticEvent: not a DOM Event, wraps one in `nativeEvent` */
  synthetic: boolean;
  instanceOfEvent: boolean;
  nativeEventType: string | null;
  hasComposedPath: boolean;
  targetIsCombobox: boolean;
  currentTargetIsCombobox: boolean;
  value: string;
  query: string;
}

const calls: Call[] = [];
let combobox: HTMLElementTagNameMap['combo-box'] | null = null;
const refCalls: unknown[] = [];

const record = (prop: string) => (event: any) => {
  calls.push({
    prop,
    type: event.type,
    synthetic: !(event instanceof Event) && 'nativeEvent' in event,
    instanceOfEvent: event instanceof Event,
    nativeEventType: event.nativeEvent ? event.nativeEvent.constructor.name : null,
    hasComposedPath: typeof event.composedPath === 'function',
    targetIsCombobox: event.target === combobox,
    currentTargetIsCombobox: event.currentTarget === combobox,
    value: event.target?.value,
    query: event.target?.query,
  });
};

let setProps: (props: Record<string, unknown>) => void = () => {};

function App() {
  const [props, set] = useState<Record<string, unknown>>({});
  setProps = (next) => flushSync(() => set(next));
  return (
    <combo-box
      ref={(element: any) => {
        combobox = element;
        refCalls.push(element);
      }}
      aria-label="Fruit"
      searchable
      placeholder="Pick a fruit"
      style={{ display: 'block', width: 300 }}
      // Typed: React wraps these in SyntheticEvents
      onChange={record('onChange')}
      onInput={record('onInput')}
      onFocus={record('onFocus')}
      onBlur={record('onBlur')}
      onClick={record('onClick')}
      // Unknown to React: attached as native listeners by exact name
      onclose={record('onclose')}
      onsearch={record('onsearch')}
      // camelCase variants the typings also accept
      {...({ onClose: record('onClose'), onSearch: record('onSearch') } as {})}
      {...props}
    >
      <box-option value="apple">Apple</box-option>
      <box-option value="banana">Banana</box-option>
      <box-option value="cherry">Cherry</box-option>
    </combo-box>
  );
}

const root = document.createElement('div');
document.body.append(root);
const out = document.createElement('button');
out.id = 'out';
out.textContent = 'out';
document.body.append(out);
flushSync(() => createRoot(root).render(<App />));

Object.assign(window, {
  __react: {
    calls,
    refCalls: () => refCalls.map((r) => (r === null ? null : (r as Element).localName)),
    refIsUpgraded: () => combobox instanceof customElements.get('combo-box')!,
    setProps: (props: Record<string, unknown>) => setProps(props),
  },
});
