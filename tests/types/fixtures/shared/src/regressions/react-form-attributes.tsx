/**
 * Was broken: form/global attributes of a form-associated element are missing.
 *
 * <combo-box> is form-associated (it submits under its `name`), but `name`, `form`, `autoFocus`,
 * `role`, `lang`, `dir`, `inert`... are not in the JSX attributes.
 * Fixed by: inherit React.HTMLAttributes (lang, dir, autoFocus...) and declare name/form.
 */
import 'html-combobox-element';

export function FormField() {
  return (
    <form>
      <combo-box name="fruit" form="checkout" autoFocus lang="en" dir="ltr" />
    </form>
  );
}
