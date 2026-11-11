import { test, expect, FRUITS, innerFocus, isOpen, trackChanges, changes } from './fixtures';

const BASIC = (attrs = '', options = FRUITS) => `
  <p id="outside">Outside</p>
  <label for="fruit">Fruit</label>
  <combo-box id="fruit" ${attrs} style="display:block; width: 300px; border: 1px solid">${options}</combo-box>
`;

const value = (page: any) => page.locator('combo-box').evaluate((el: any) => el.value);
const option = (page: any, v: string) => page.locator(`combo-box box-option[value="${v}"]`);

test.describe('pointer', () => {
  test('clicking the combobox opens the dropdown and focuses the host', async ({ mount, page }) => {
    await mount(BASIC());
    await page.locator('combo-box').click();
    expect(await isOpen(page)).toBe(true);
    expect(await innerFocus(page)).toBe('host');
  });

  test('clicking an option selects it (single), closes and returns focus', async ({ mount, page }) => {
    await mount(BASIC());
    await page.locator('combo-box').click();
    await option(page, 'cherry').click();
    expect(await value(page)).toBe('cherry');
    await expect.poll(() => isOpen(page)).toBe(false);
    expect(await innerFocus(page)).toBe('host');
  });

  test('clicking an option fires one change event', async ({ mount, page }) => {
    await mount(BASIC());
    await trackChanges(page);
    await page.locator('combo-box').click();
    await option(page, 'banana').click();
    expect(await changes(page)).toEqual(['banana']);
  });

  test('clicking options in a multiple combobox adds them and keeps it open', async ({ mount, page }) => {
    await mount(BASIC('multiple'));
    await page.locator('combo-box').click();
    await option(page, 'apple').click();
    await option(page, 'date').click();
    expect(await value(page)).toBe('apple,date');
    await page.waitForTimeout(50);
    expect(await isOpen(page)).toBe(true);
  });

  test('a selected option ignores the pointer (deselect through its tag)', async ({ mount, page }) => {
    await mount(BASIC('multiple value="apple"'));
    expect(await option(page, 'apple').evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
  });

  test('clicking a disabled option does nothing', async ({ mount, page }) => {
    await mount(BASIC('', `<box-option value="a">A</box-option><box-option value="b" disabled>B</box-option>`));
    await page.locator('combo-box').click();
    await option(page, 'b').click({ force: true });
    expect(await value(page)).toBe('');
  });

  test('dispatching a click on a disabled option does nothing', async ({ mount, page }) => {
    await mount(BASIC('', `<box-option value="b" disabled>B</box-option>`));
    await option(page, 'b').evaluate((el: HTMLElement) => el.click());
    expect(await value(page)).toBe('');
  });

  test('clicking an option of a disabled optgroup does nothing', async ({ mount, page }) => {
    await mount(BASIC('', `<optgroup label="G" disabled><box-option value="b">B</box-option></optgroup>`));
    await option(page, 'b').evaluate((el: HTMLElement) => el.click());
    expect(await value(page)).toBe('');
  });

  test('clicking outside closes the dropdown', async ({ mount, page }) => {
    await mount(BASIC());
    await page.locator('combo-box').click();
    await page.locator('#outside').click();
    await expect.poll(() => isOpen(page)).toBe(false);
  });

  test('clicking a tag remove button removes the value', async ({ mount, page }) => {
    await mount(BASIC('multiple value="apple,banana"'));
    await page.locator('combo-box [part="clear-tag"][aria-label="Remove Apple"]').click();
    expect(await value(page)).toBe('banana');
  });

  test('clicking the icon inside a custom tag button still removes the value', async ({ mount, page }) => {
    await mount(`
      <combo-box aria-label="f" multiple style="display:block;width:300px">
        <box-tag><span part="tag-label" slot="label"></span><button part="clear-tag"><b class="icon">x</b></button></box-tag>
        <box-option value="a" selected><span slot="label">Apple</span></box-option>
        <box-option value="b" selected><span slot="label">Banana</span></box-option>
      </combo-box>`);
    await page.locator('combo-box box-tag[value=a] .icon').click();
    expect(await page.locator('combo-box').evaluate((el: any) => el.value)).toBe('b');
  });

  test('clicking clear-all empties the selection', async ({ mount, page }) => {
    await mount(BASIC('multiple value="apple,banana"'));
    await page.locator('combo-box [part="clear-all"]').click();
    expect(await value(page)).toBe('');
    await expect(page.locator('combo-box [part="clear-all"]')).toBeDisabled();
  });

  test('a disabled combobox ignores clicks', async ({ mount, page }) => {
    await mount(BASIC('disabled'));
    await page.locator('combo-box').click({ force: true });
    expect(await isOpen(page)).toBe(false);
    expect(await innerFocus(page)).not.toBe('host');
  });

  test('a disabled combobox has pointer-events: none', async ({ mount, page }) => {
    await mount(BASIC('disabled'));
    expect(await page.locator('combo-box').evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
  });

  test('a disabled combobox matches :state(disabled)', async ({ mount, page }) => {
    await mount(BASIC('disabled'));
    expect(await page.locator('combo-box').evaluate((el) => el.matches(':state(disabled)'))).toBe(true);
    await page.locator('combo-box').evaluate((el: any) => el.disabled = false);
    expect(await page.locator('combo-box').evaluate((el) => el.matches(':state(disabled)'))).toBe(false);
  });

  test('clicking an option in the filtered list selects it', async ({ mount, page }) => {
    await mount(BASIC('filterable'));
    await page.locator('combo-box').click();
    await expect.poll(() => innerFocus(page)).toBe('search-input');
    await page.keyboard.type('dat');
    await expect(page.locator('combo-box box-option:visible')).toHaveText(['Date']);
    await option(page, 'date').click();
    expect(await value(page)).toBe('date');
  });

  test('clicking the combobox again after picking an option reopens it', async ({ mount, page }) => {
    await mount(BASIC());
    await page.locator('combo-box').click();
    await option(page, 'banana').click();
    await expect.poll(() => isOpen(page)).toBe(false);
    expect(await innerFocus(page)).toBe('host');
    await page.locator('combo-box').click();
    expect(await isOpen(page)).toBe(true);
  });

  test('clicking the combobox reopens it after Escape', async ({ mount, page }) => {
    await mount(BASIC());
    await page.locator('combo-box').click();
    await page.keyboard.press('Escape');
    expect(await isOpen(page)).toBe(false);
    await page.locator('combo-box').click();
    expect(await isOpen(page)).toBe(true);
  });

  test('clicking the combobox reopens it after a keyboard selection', async ({ mount, page }) => {
    await mount(BASIC());
    await page.locator('combo-box').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    expect(await isOpen(page)).toBe(false);
    await page.locator('combo-box').click();
    expect(await isOpen(page)).toBe(true);
  });

  test('a reopened filterable combobox focuses its search field', async ({ mount, page }) => {
    await mount(BASIC('filterable'));
    await page.locator('combo-box').click();
    await page.keyboard.press('Escape');
    await page.locator('combo-box').click();
    expect(await isOpen(page)).toBe(true);
    await expect.poll(() => innerFocus(page)).toBe('search-input');
  });

  test('a first click opens it once (focus and click together do not toggle it closed)', async ({ mount, page }) => {
    await mount(BASIC());
    await page.locator('combo-box').click();
    await page.waitForTimeout(50);
    expect(await isOpen(page)).toBe(true);
  });

  test('picking an option does not reopen it (the click inside the dropdown is ignored)', async ({ mount, page }) => {
    await mount(BASIC());
    await page.locator('combo-box').click();
    await option(page, 'cherry').click();
    await page.waitForTimeout(50);
    expect(await isOpen(page)).toBe(false);
  });

  test('removing a tag of a closed combobox does not open it', async ({ mount, page }) => {
    await mount(BASIC('clearable value="apple"'));
    await page.locator('combo-box').focus();
    await page.keyboard.press('Escape');
    await page.locator('combo-box [part="clear-tag"]').click();
    await page.waitForTimeout(50);
    expect(await page.locator('combo-box').evaluate((el: any) => el.value)).toBe('');
    expect(await isOpen(page)).toBe(false);
  });

  test('clear-all on a closed combobox does not open it', async ({ mount, page }) => {
    await mount(BASIC('multiple value="apple,banana"'));
    await page.locator('combo-box').focus();
    await page.keyboard.press('Escape');
    await page.locator('combo-box [part="clear-all"]').click();
    await page.waitForTimeout(50);
    expect(await isOpen(page)).toBe(false);
  });

  test('clicking a disabled combobox does not open it', async ({ mount, page }) => {
    await mount(BASIC('disabled'));
    await page.locator('combo-box').dispatchEvent('click');
    expect(await isOpen(page)).toBe(false);
  });
});
