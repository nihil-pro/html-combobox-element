// The `./playwright` subpath export resolves (exports-aware resolution modes).
import { registerCombobox, COMBOBOX_ENGINE_NAME, type SelectorsLike } from 'html-combobox-element/playwright';

declare const selectors: SelectorsLike;
registerCombobox(selectors);
registerCombobox(selectors, COMBOBOX_ENGINE_NAME);
// @ts-expect-error name must be a string
registerCombobox(selectors, 1);
