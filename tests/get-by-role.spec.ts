import { test, expect, FRUITS } from './fixtures';

/**
 * Playwright's role engine reads ARIA attributes only (ElementInternals is private to the element),
 * so these work thanks to the role/aria-* attributes mirrored from internals.
 * Note: Playwright names a custom element from <label for> only for native controls,
 * so the combobox is queried without a name here, or named with aria-label.
 */

const PAGE = (attrs = '', options = FRUITS) => `<combo-box aria-label="Fruit" ${attrs}>${options}</combo-box>`;

test.describe('Playwright getByRole', () => {
  test('finds the combobox', async ({ mount, page }) => {
    await mount(PAGE());
    await expect(page.getByRole('combobox')).toHaveCount(1);
  });

  test('finds the combobox by its aria-label', async ({ mount, page }) => {
    await mount(PAGE());
    await expect(page.getByRole('combobox', { name: 'Fruit' })).toHaveCount(1);
  });

  test('finds the combobox by aria-labelledby', async ({ mount, page }) => {
    await mount(`<span id="l">Snack</span><combo-box aria-labelledby="l">${FRUITS}</combo-box>`);
    await expect(page.getByRole('combobox', { name: 'Snack' })).toHaveCount(1);
  });

  test('finds the listbox and its options once open', async ({ mount, page }) => {
    await mount(PAGE());
    await page.getByRole('combobox').focus();
    await expect(page.getByRole('listbox')).toBeVisible();
    await expect(page.getByRole('option')).toHaveText(['Apple', 'Banana', 'Cherry', 'Date']);
  });

  test('options are hidden from getByRole while closed', async ({ mount, page }) => {
    await mount(PAGE());
    await expect(page.getByRole('option')).toHaveCount(0);
    await expect(page.getByRole('option', { includeHidden: true })).toHaveCount(4);
  });

  test('finds an option by name and clicks it', async ({ mount, page }) => {
    await mount(PAGE());
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Cherry' }).click();
    expect(await page.locator('combo-box').evaluate((el: any) => el.value)).toBe('cherry');
  });

  test('filters options by selected state', async ({ mount, page }) => {
    await mount(PAGE('multiple value="apple,date"'));
    await page.getByRole('combobox').focus();
    await expect(page.getByRole('option', { selected: true })).toHaveText(['Apple', 'Date']);
    await expect(page.getByRole('option', { selected: false })).toHaveText(['Banana', 'Cherry']);
  });

  test('selected state follows user selection', async ({ mount, page }) => {
    await mount(PAGE());
    await page.getByRole('combobox').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.getByRole('combobox').press('ArrowDown');
    await expect(page.getByRole('option', { selected: true })).toHaveText('Banana');
  });

  test('selected state follows programmatic changes', async ({ mount, page }) => {
    await mount(PAGE('value="apple"'));
    await page.locator('combo-box').evaluate((el: any) => el.value = 'cherry');
    await page.getByRole('combobox').focus();
    await expect(page.getByRole('option', { selected: true })).toHaveText('Cherry');
  });

  test('toBeDisabled / disabled filter on options', async ({ mount, page }) => {
    await mount(PAGE('', `<box-option value="a">Apple</box-option><box-option value="b" disabled>Banana</box-option>`));
    await page.getByRole('combobox').focus();
    await expect(page.getByRole('option', { name: 'Banana' })).toBeDisabled();
    await expect(page.getByRole('option', { name: 'Apple' })).toBeEnabled();
    await expect(page.getByRole('option', { disabled: true })).toHaveText('Banana');
  });

  test('disabled state follows the property', async ({ mount, page }) => {
    await mount(PAGE());
    await page.getByRole('combobox').focus();
    const apple = page.getByRole('option', { name: 'Apple' });
    await apple.evaluate((o: any) => o.disabled = true);
    await expect(apple).toBeDisabled();
    await apple.evaluate((o: any) => o.disabled = false);
    await expect(apple).toBeEnabled();
  });

  test('toBeFocused on an option reached with the keyboard', async ({ mount, page }) => {
    await mount(PAGE());
    await page.getByRole('combobox').focus();
    await page.keyboard.press('End');
    await expect(page.getByRole('option', { name: 'Date' })).toBeFocused();
  });

  test('finds the optgroup as a group', async ({ mount, page }) => {
    await mount(PAGE('', `<optgroup label="Citrus"><box-option value="l">Lemon</box-option></optgroup>`));
    await page.getByRole('combobox').focus();
    await expect(page.getByRole('group', { name: 'Citrus' }).getByRole('option')).toHaveText('Lemon');
  });

  test('finds the tag remove buttons and the clear-all button', async ({ mount, page }) => {
    await mount(PAGE('multiple value="apple,banana"'));
    await page.getByRole('button', { name: 'Remove Apple' }).click();
    expect(await page.locator('combo-box').evaluate((el: any) => el.value)).toBe('banana');
    await page.getByRole('button', { name: 'Clear selection' }).click();
    expect(await page.locator('combo-box').evaluate((el: any) => el.value)).toBe('');
  });

  test('finds the search field and the dialog', async ({ mount, page }) => {
    await mount(PAGE('filterable'));
    await page.getByRole('combobox').focus();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('textbox').fill('err');
    await expect(page.getByRole('option')).toHaveText(['Cherry']);
  });

  test('ariaSnapshot shows combobox, listbox and option states', async ({ mount, page }) => {
    await mount(PAGE('', `<box-option value="a">Apple</box-option><box-option value="b" selected>Banana</box-option><box-option value="c" disabled>Cherry</box-option>`));
    await page.getByRole('combobox').focus();
    await expect(page.locator('body')).toMatchAriaSnapshot(`
      - combobox "Fruit":
        - listbox:
          - option "Apple"
          - option "Banana" [selected]
          - option "Cherry" [disabled]
    `);
  });
});

test.describe('aria-disabled mirrored on the host', () => {
  test('a disabled combobox carries aria-disabled="true"', async ({ mount, page }) => {
    await mount(PAGE('disabled'));
    await expect(page.locator('combo-box')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByRole('combobox')).toBeDisabled();
    await expect(page.getByRole('combobox', { disabled: true })).toHaveCount(1);
  });

  test('it is removed when enabled again', async ({ mount, page }) => {
    await mount(PAGE('disabled'));
    await page.locator('combo-box').evaluate((el: any) => el.disabled = false);
    await expect(page.locator('combo-box')).not.toHaveAttribute('aria-disabled', /.*/);
    await expect(page.getByRole('combobox')).toBeEnabled();
  });

  test('a disabled fieldset sets it too', async ({ mount, page }) => {
    await mount(`<fieldset disabled>${PAGE()}</fieldset>`);
    await expect(page.locator('combo-box')).toHaveAttribute('aria-disabled', 'true');
    await page.evaluate(() => document.querySelector('fieldset')!.disabled = false);
    await expect(page.locator('combo-box')).not.toHaveAttribute('aria-disabled', /.*/);
  });

  test("an author's own aria-disabled is left alone", async ({ mount, page }) => {
    await mount(PAGE('aria-disabled="false"'));
    await page.locator('combo-box').evaluate((el: any) => { el.disabled = true; el.disabled = false; });
    await expect(page.locator('combo-box')).toHaveAttribute('aria-disabled', 'false');
  });
});
