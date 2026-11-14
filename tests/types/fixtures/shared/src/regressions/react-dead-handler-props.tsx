/**
 * Was broken: handler props that React 19 never calls are accepted.
 *
 * For custom elements React 19 attaches unknown `on*` props as native listeners by the exact,
 * case-sensitive name after "on". The component dispatches "close" and "search", so only
 * `onclose`/`onsearch` work; `onClose`/`onSearch` silently never fire (tests/react-events.spec.ts).
 * `onReset`/`onInvalid` are React events, but "reset"/"invalid" don't bubble and React only
 * handles them for its own form elements: also never called, `onreset`/`oninvalid` work
 * (tests/frameworks.spec.ts).
 * Fixed by: declare `onclose`/`onsearch` explicitly and drop the catch-all `on${string}` signature.
 */
import 'html-combobox-element';

export function Dead() {
  return (
    <>
      {/* @ts-expect-error never fires in React 19 - use onclose */}
      <combo-box onClose={() => {}} />
      {/* @ts-expect-error never fires in React 19 - use onsearch */}
      <combo-box onSearch={() => {}} />
      {/* @ts-expect-error never fires in React 19 ('reset' doesn't bubble) - use onreset */}
      <combo-box onReset={() => {}} />
      {/* @ts-expect-error never fires in React 19 ('invalid' doesn't bubble) - use oninvalid */}
      <combo-box onInvalid={() => {}} />
      <combo-box onreset={(event) => event.target.value} oninvalid={(event) => event.target.validity} />
    </>
  );
}
