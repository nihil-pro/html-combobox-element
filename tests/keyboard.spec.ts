import { test, expect, FRUITS, innerFocus, isOpen, trackChanges, changes, settle } from './fixtures';

const BASIC = (attrs = '', options = FRUITS) => `
  <button id="before">before</button>
  <label for="fruit">Fruit</label>
  <combo-box id="fruit" ${attrs}>${options}</combo-box>
  <button id="after">after</button>
`;

const value = (page: any) => page.locator('combo-box').evaluate((el: any) => el.value);

test.describe('focus and Tab', () => {
  test('Tab moves focus onto the combobox host', async ({ mount, page }) => {
    await mount(BASIC());
    await page.locator('#before').focus();
    await page.keyboard.press('Tab');
    expect(await innerFocus(page)).toBe('host');
  });

  test('focusing the combobox opens the dropdown', async ({ mount, page }) => {
    await mount(BASIC());
    await page.locator('#before').focus();
    await page.keyboard.press('Tab');
    expect(await isOpen(page)).toBe(true);
  });

  test('options are not tab stops: Tab from the combobox leaves it', async ({ mount, page }) => {
    await mount(BASIC());
    await page.locator('combo-box').focus();
    await page.keyboard.press('Tab');
    await expect(page.locator('#after')).toBeFocused();
  });

  test('Tab out of the combobox closes the dropdown', async ({ mount, page }) => {
    await mount(BASIC());
    await page.locator('combo-box').focus();
    await page.keyboard.press('Tab');
    await expect.poll(() => isOpen(page)).toBe(false);
  });

  test('Shift+Tab from the combobox goes back to the previous control', async ({ mount, page }) => {
    await mount(BASIC());
    await page.locator('combo-box').focus();
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('#before')).toBeFocused();
  });

  test('Tab from an option leaves the combobox and closes it', async ({ mount, page }) => {
    await mount(BASIC());
    await page.locator('combo-box').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Tab');
    await expect(page.locator('#after')).toBeFocused();
    await expect.poll(() => isOpen(page)).toBe(false);
  });

  test('a user-provided tabindex is kept', async ({ mount, page }) => {
    await mount(BASIC('tabindex="3"'));
    await expect(page.locator('combo-box')).toHaveAttribute('tabindex', '3');
  });

  test('the host gets tabindex=0 when none is given', async ({ mount, page }) => {
    await mount(BASIC());
    await expect(page.locator('combo-box')).toHaveAttribute('tabindex', '0');
  });

  test('a disabled combobox is skipped by Tab', async ({ mount, page }) => {
    await mount(BASIC('disabled'));
    await page.locator('#before').focus();
    await page.keyboard.press('Tab');
    await expect(page.locator('#after')).toBeFocused();
  });

  test('a combobox in a disabled fieldset is skipped by Tab', async ({ mount, page }) => {
    await mount(`<button id="before">b</button><fieldset disabled><combo-box aria-label="x">${FRUITS}</combo-box></fieldset><button id="after">a</button>`);
    await page.locator('#before').focus();
    await page.keyboard.press('Tab');
    await expect(page.locator('#after')).toBeFocused();
  });

  test('clicking the label focuses the combobox', async ({ mount, page }) => {
    await mount(BASIC());
    await page.locator('label').click();
    expect(await innerFocus(page)).toBe('host');
  });
});

test.describe('opening and closing', () => {
  for (const key of ['ArrowDown', 'ArrowUp', 'Enter', ' ', 'Home', 'End']) {
    test(`"${key}" reopens a closed dropdown`, async ({ mount, page }) => {
      await mount(BASIC());
      await page.locator('combo-box').focus();
      await page.keyboard.press('Escape');
      expect(await isOpen(page)).toBe(false);
      await page.keyboard.press(key);
      expect(await isOpen(page)).toBe(true);
    });
  }

  test('Escape closes and keeps focus on the combobox', async ({ mount, page }) => {
    await mount(BASIC());
    await page.locator('combo-box').focus();
    await page.keyboard.press('Escape');
    expect(await isOpen(page)).toBe(false);
    expect(await innerFocus(page)).toBe('host');
  });

  test('Escape from an option closes and returns focus to the combobox', async ({ mount, page }) => {
    await mount(BASIC());
    await page.locator('combo-box').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Escape');
    expect(await isOpen(page)).toBe(false);
    expect(await innerFocus(page)).toBe('host');
  });

  test('Escape does not change the value', async ({ mount, page }) => {
    await mount(BASIC('', `<box-option value="a" selected>A</box-option><box-option value="b">B</box-option>`));
    await page.locator('combo-box').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Escape');
    expect(await value(page)).toBe('a');
  });

  test('Escape on an open combobox does not reach the page (stops propagation)', async ({ mount, page }) => {
    await mount(BASIC());
    await page.evaluate(() => { (window as any).__esc = 0; document.addEventListener('keydown', (e) => { if (e.key === 'Escape') (window as any).__esc++; }); });
    await page.locator('combo-box').focus();
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => (window as any).__esc)).toBe(0);
  });

  test('Escape on a closed combobox is left to the page', async ({ mount, page }) => {
    await mount(BASIC());
    await page.evaluate(() => { (window as any).__esc = 0; document.addEventListener('keydown', (e) => { if (e.key === 'Escape') (window as any).__esc++; }); });
    await page.locator('combo-box').focus();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => (window as any).__esc)).toBe(1);
  });

  test('Escape after returning focus does not reopen it (no focus loop)', async ({ mount, page }) => {
    await mount(BASIC());
    await page.locator('combo-box').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Escape');
    await settle(page);
    expect(await isOpen(page)).toBe(false);
  });

  test('a close event is dispatched when the dropdown closes', async ({ mount, page }) => {
    await mount(BASIC());
    await page.evaluate(() => { (window as any).__close = 0; document.querySelector('combo-box')!.addEventListener('close', () => (window as any).__close++); });
    await page.locator('combo-box').focus();
    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => (window as any).__close)).toBe(1);
  });

  test('keys do nothing on a disabled combobox', async ({ mount, page }) => {
    await mount(BASIC('disabled'));
    await page.locator('combo-box').evaluate((el: HTMLElement) => el.focus());
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    expect(await isOpen(page)).toBe(false);
    expect(await value(page)).toBe('');
  });
});

test.describe('moving through options', () => {
  test('ArrowDown focuses the first option when nothing is selected', async ({ mount, page }) => {
    await mount(BASIC());
    await page.locator('combo-box').focus();
    await page.keyboard.press('ArrowDown');
    expect(await innerFocus(page)).toBe('option:apple');
  });

  test('ArrowDown focuses the selected option', async ({ mount, page }) => {
    await mount(BASIC('value="cherry"'));
    await page.locator('combo-box').focus();
    await page.keyboard.press('ArrowDown');
    expect(await innerFocus(page)).toBe('option:cherry');
  });

  test('ArrowUp focuses the last option when nothing is selected', async ({ mount, page }) => {
    await mount(BASIC());
    await page.locator('combo-box').focus();
    await page.keyboard.press('ArrowUp');
    expect(await innerFocus(page)).toBe('option:date');
  });

  test('ArrowUp focuses the selected option', async ({ mount, page }) => {
    await mount(BASIC('value="banana"'));
    await page.locator('combo-box').focus();
    await page.keyboard.press('ArrowUp');
    expect(await innerFocus(page)).toBe('option:banana');
  });

  test('Home and End from the combobox focus the first and last option', async ({ mount, page }) => {
    await mount(BASIC('value="banana"'));
    await page.locator('combo-box').focus();
    await page.keyboard.press('End');
    expect(await innerFocus(page)).toBe('option:date');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Home');
    expect(await innerFocus(page)).toBe('option:apple');
  });

  test('Enter and Space from the combobox focus the selected option', async ({ mount, page }) => {
    await mount(BASIC('value="cherry"'));
    await page.locator('combo-box').focus();
    await page.keyboard.press('Enter');
    expect(await innerFocus(page)).toBe('option:cherry');
    await page.keyboard.press('Escape');
    await page.keyboard.press(' ');
    expect(await innerFocus(page)).toBe('option:cherry');
  });

  test('ArrowDown/ArrowUp move between options', async ({ mount, page }) => {
    await mount(BASIC());
    await page.locator('combo-box').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    expect(await innerFocus(page)).toBe('option:cherry');
    await page.keyboard.press('ArrowUp');
    expect(await innerFocus(page)).toBe('option:banana');
  });

  test('ArrowDown stops at the last option', async ({ mount, page }) => {
    await mount(BASIC());
    await page.locator('combo-box').focus();
    for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowDown');
    expect(await innerFocus(page)).toBe('option:date');
  });

  test('ArrowUp stops at the first option', async ({ mount, page }) => {
    await mount(BASIC());
    await page.locator('combo-box').focus();
    await page.keyboard.press('ArrowDown');
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowUp');
    expect(await innerFocus(page)).toBe('option:apple');
  });

  test('Home/End/PageUp/PageDown inside the list', async ({ mount, page }) => {
    await mount(BASIC());
    await page.locator('combo-box').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('End');
    expect(await innerFocus(page)).toBe('option:date');
    await page.keyboard.press('Home');
    expect(await innerFocus(page)).toBe('option:apple');
    await page.keyboard.press('PageDown');
    expect(await innerFocus(page)).toBe('option:date');
    await page.keyboard.press('PageUp');
    expect(await innerFocus(page)).toBe('option:apple');
  });

  test('disabled options are skipped', async ({ mount, page }) => {
    await mount(BASIC('', `
      <box-option value="a">A</box-option>
      <box-option value="b" disabled>B</box-option>
      <box-option value="c">C</box-option>`));
    await page.locator('combo-box').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    expect(await innerFocus(page)).toBe('option:c');
    await page.keyboard.press('ArrowUp');
    expect(await innerFocus(page)).toBe('option:a');
  });

  test('a disabled first option is skipped by ArrowDown from the combobox', async ({ mount, page }) => {
    await mount(BASIC('', `<box-option value="a" disabled>A</box-option><box-option value="b">B</box-option>`));
    await page.locator('combo-box').focus();
    await page.keyboard.press('ArrowDown');
    expect(await innerFocus(page)).toBe('option:b');
  });

  test('navigation crosses optgroups and skips disabled groups', async ({ mount, page }) => {
    await mount(BASIC('', `
      <optgroup label="One"><box-option value="a">A</box-option></optgroup>
      <optgroup label="Two" disabled><box-option value="b">B</box-option></optgroup>
      <optgroup label="Three"><box-option value="c">C</box-option></optgroup>
      <box-option value="d">D</box-option>`));
    await page.locator('combo-box').focus();
    await page.keyboard.press('ArrowDown');
    expect(await innerFocus(page)).toBe('option:a');
    await page.keyboard.press('ArrowDown');
    expect(await innerFocus(page)).toBe('option:c');
    await page.keyboard.press('ArrowDown');
    expect(await innerFocus(page)).toBe('option:d');
  });

  test('arrow keys do not scroll the page', async ({ mount, page }) => {
    await mount(`<div style="height:3000px">${BASIC()}</div>`);
    await page.locator('combo-box').focus();
    const before = await page.evaluate(() => scrollY);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('End');
    expect(await page.evaluate(() => scrollY)).toBe(before);
  });
});

test.describe('typeahead', () => {
  const TYPE = `
    <box-option value="apple">Apple</box-option>
    <box-option value="apricot">Apricot</box-option>
    <box-option value="banana">Banana</box-option>
    <box-option value="blueberry">Blueberry</box-option>
    <box-option value="cherry">Cherry</box-option>`;

  test('typing a letter on the combobox focuses the first matching option', async ({ mount, page }) => {
    await mount(BASIC('', TYPE));
    await page.locator('combo-box').focus();
    await page.keyboard.press('b');
    expect(await innerFocus(page)).toBe('option:banana');
  });

  test('typing a letter opens a closed dropdown', async ({ mount, page }) => {
    await mount(BASIC('', TYPE));
    await page.locator('combo-box').focus();
    await page.keyboard.press('Escape');
    await page.keyboard.press('c');
    expect(await isOpen(page)).toBe(true);
    expect(await innerFocus(page)).toBe('option:cherry');
  });

  test('repeating a letter cycles through matches', async ({ mount, page }) => {
    await mount(BASIC('', TYPE));
    await page.locator('combo-box').focus();
    await page.keyboard.press('a');
    expect(await innerFocus(page)).toBe('option:apple');
    await page.keyboard.press('a');
    expect(await innerFocus(page)).toBe('option:apricot');
    await page.keyboard.press('a');
    expect(await innerFocus(page)).toBe('option:apple');
  });

  test('typing several letters quickly matches a prefix', async ({ mount, page }) => {
    await mount(BASIC('', TYPE));
    await page.locator('combo-box').focus();
    await page.keyboard.type('blu');
    expect(await innerFocus(page)).toBe('option:blueberry');
  });

  test('typeahead is case-insensitive and uses the label', async ({ mount, page }) => {
    await mount(BASIC('', `<box-option value="x" label="Zucchini">🥒</box-option><box-option value="y">Yam</box-option>`));
    await page.locator('combo-box').focus();
    await page.keyboard.press('Z');
    expect(await innerFocus(page)).toBe('option:x');
  });

  test('typeahead does not select (only moves focus)', async ({ mount, page }) => {
    await mount(BASIC('', TYPE));
    await trackChanges(page);
    await page.locator('combo-box').focus();
    await page.keyboard.press('c');
    expect(await value(page)).toBe('');
    expect(await changes(page)).toEqual([]);
  });

  test('typeahead skips disabled options', async ({ mount, page }) => {
    await mount(BASIC('', `<box-option value="a1" disabled>Alpha</box-option><box-option value="a2">Avocado</box-option>`));
    await page.locator('combo-box').focus();
    await page.keyboard.press('a');
    expect(await innerFocus(page)).toBe('option:a2');
  });

  test('a letter with no match keeps focus where it is', async ({ mount, page }) => {
    await mount(BASIC('', TYPE));
    await page.locator('combo-box').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('q');
    expect(await innerFocus(page)).toBe('option:apple');
  });
});

test.describe('selecting with the keyboard (single)', () => {
  test('Enter on an option selects it, closes and returns focus', async ({ mount, page }) => {
    await mount(BASIC());
    await page.locator('combo-box').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    expect(await value(page)).toBe('banana');
    expect(await isOpen(page)).toBe(false);
    expect(await innerFocus(page)).toBe('host');
  });

  test('Space on an option selects it', async ({ mount, page }) => {
    await mount(BASIC());
    await page.locator('combo-box').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press(' ');
    expect(await value(page)).toBe('apple');
    expect(await isOpen(page)).toBe(false);
  });

  test('selecting fires exactly one change event', async ({ mount, page }) => {
    await mount(BASIC());
    await trackChanges(page);
    await page.locator('combo-box').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    expect(await changes(page)).toEqual(['apple']);
  });

  test('selecting replaces the previous selection', async ({ mount, page }) => {
    await mount(BASIC('value="apple"'));
    await page.locator('combo-box').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    expect(await value(page)).toBe('banana');
    expect(await page.locator('combo-box box-option[selected]').count()).toBe(1);
  });

  test('Enter on the already selected option keeps it selected and closes', async ({ mount, page }) => {
    await mount(BASIC('value="banana"'));
    await trackChanges(page);
    await page.locator('combo-box').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    expect(await value(page)).toBe('banana');
    expect(await isOpen(page)).toBe(false);
    expect(await changes(page)).toEqual([]);
  });

  test('Enter on an option does not submit the form', async ({ mount, page }) => {
    await mount(`<form onsubmit="event.preventDefault(); window.__submitted = true"><combo-box name="f" aria-label="f">${FRUITS}</combo-box><button>go</button></form>`);
    await page.locator('combo-box').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => (window as any).__submitted ?? false)).toBe(false);
  });

  test('typing letters on a focused option does not select it', async ({ mount, page }) => {
    await mount(BASIC());
    await page.locator('combo-box').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('x');
    await page.keyboard.press('1');
    expect(await value(page)).toBe('');
  });

  test('the new value is announced: tag and value text are updated', async ({ mount, page }) => {
    await mount(BASIC());
    await page.locator('combo-box').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page.locator('combo-box [part="value"]')).toHaveText('Apple');
    await expect(page.locator('combo-box box-tag')).toHaveCount(1);
  });
});

test.describe('selecting with the keyboard (multiple)', () => {
  test('Enter toggles options and keeps the dropdown open', async ({ mount, page }) => {
    await mount(BASIC('multiple'));
    await page.locator('combo-box').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    expect(await value(page)).toBe('apple,cherry');
    expect(await isOpen(page)).toBe(true);
    expect(await innerFocus(page)).toBe('option:cherry');
  });

  test('Space toggles an option off again', async ({ mount, page }) => {
    await mount(BASIC('multiple value="apple,banana"'));
    await page.locator('combo-box').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press(' ');
    expect(await value(page)).toBe('banana');
  });

  test('each toggle fires a change event', async ({ mount, page }) => {
    await mount(BASIC('multiple'));
    await trackChanges(page);
    await page.locator('combo-box').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press(' ');
    await page.keyboard.press(' ');
    expect(await changes(page)).toEqual(['apple', '']);
  });

  test('Escape closes a multiple combobox and keeps the selection', async ({ mount, page }) => {
    await mount(BASIC('multiple'));
    await page.locator('combo-box').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    expect(await value(page)).toBe('apple');
    expect(await isOpen(page)).toBe(false);
  });
});

test.describe('tag buttons', () => {
  test('Tab from the combobox reaches the tag remove buttons first', async ({ mount, page }) => {
    await mount(BASIC('multiple value="apple,banana"'));
    await page.locator('combo-box').focus();
    await page.keyboard.press('Tab');
    expect(await innerFocus(page)).toBe('clear-tag');
  });

  test('Enter on a tag remove button removes that value', async ({ mount, page }) => {
    await mount(BASIC('multiple value="apple,banana"'));
    await page.locator('combo-box').focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    expect(await value(page)).toBe('banana');
  });

  test('Space on a tag remove button removes that value', async ({ mount, page }) => {
    await mount(BASIC('multiple value="apple,banana"'));
    await page.locator('combo-box').focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press(' ');
    expect(await value(page)).toBe('banana');
  });

  test('after removing a tag, focus moves to the next remove button', async ({ mount, page }) => {
    await mount(BASIC('multiple value="apple,banana,cherry"'));
    await page.locator('combo-box').focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    expect(await innerFocus(page)).toBe('clear-tag');
    await expect(page.locator('combo-box [part="clear-tag"]:focus')).toHaveAttribute('aria-label', 'Remove Banana');
  });

  test('after removing the last remaining tag, focus returns to the combobox', async ({ mount, page }) => {
    await mount(BASIC('clearable value="apple"'));
    await page.locator('combo-box').focus();
    await page.keyboard.press('Tab');
    expect(await innerFocus(page)).toBe('clear-tag');
    await page.keyboard.press('Enter');
    expect(await value(page)).toBe('');
    expect(await innerFocus(page)).toBe('host');
  });

  test('clear-all button empties a multiple combobox and focus returns to it', async ({ mount, page }) => {
    await mount(BASIC('multiple value="apple,banana"'));
    await page.locator('combo-box').focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    expect(await innerFocus(page)).toBe('clear-all');
    await page.keyboard.press('Enter');
    expect(await value(page)).toBe('');
    expect(await innerFocus(page)).toBe('host');
  });

  test('Escape from a tag button closes the dropdown and returns focus', async ({ mount, page }) => {
    await mount(BASIC('multiple value="apple"'));
    await page.locator('combo-box').focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Escape');
    expect(await isOpen(page)).toBe(false);
    expect(await innerFocus(page)).toBe('host');
  });
});

test.describe('search field', () => {
  test('filterable: focusing opens the dialog and focuses the search field', async ({ mount, page }) => {
    await mount(BASIC('filterable'));
    await page.locator('#before').focus();
    await page.keyboard.press('Tab');
    await expect.poll(() => innerFocus(page)).toBe('search-input');
  });

  test('searchable: focusing focuses the search field', async ({ mount, page }) => {
    await mount(BASIC('searchable'));
    await page.locator('combo-box').focus();
    await expect.poll(() => innerFocus(page)).toBe('search-input');
  });

  test('filterable: typing filters the options', async ({ mount, page }) => {
    await mount(BASIC('filterable'));
    await page.locator('combo-box').focus();
    await expect.poll(() => innerFocus(page)).toBe('search-input');
    await page.keyboard.type('err');
    await expect(page.locator('combo-box box-option:visible')).toHaveText(['Cherry']);
  });

  test('filterable: query property follows the typed text', async ({ mount, page }) => {
    await mount(BASIC('filterable'));
    await page.locator('combo-box').focus();
    await expect.poll(() => innerFocus(page)).toBe('search-input');
    await page.keyboard.type('ban');
    expect(await page.locator('combo-box').evaluate((el: any) => el.query)).toBe('ban');
  });

  test('ArrowDown from the search field focuses the first visible option', async ({ mount, page }) => {
    await mount(BASIC('filterable'));
    await page.locator('combo-box').focus();
    await expect.poll(() => innerFocus(page)).toBe('search-input');
    await page.keyboard.type('an');
    await expect(page.locator('combo-box box-option:visible')).toHaveText(['Banana']);
    await page.keyboard.press('ArrowDown');
    expect(await innerFocus(page)).toBe('option:banana');
  });

  test('ArrowUp from the first option goes back to the search field', async ({ mount, page }) => {
    await mount(BASIC('filterable'));
    await page.locator('combo-box').focus();
    await expect.poll(() => innerFocus(page)).toBe('search-input');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowUp');
    expect(await innerFocus(page)).toBe('search-input');
  });

  test('arrow navigation skips filtered-out options', async ({ mount, page }) => {
    await mount(BASIC('filterable'));
    await page.locator('combo-box').focus();
    await expect.poll(() => innerFocus(page)).toBe('search-input');
    await page.keyboard.type('a');
    await expect(page.locator('combo-box box-option:visible')).toHaveCount(3);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    expect(await innerFocus(page)).toBe('option:date');
  });

  test('searchable: Enter in the field dispatches a search event', async ({ mount, page }) => {
    await mount(BASIC('searchable'));
    await page.evaluate(() => { (window as any).__search = 0; document.querySelector('combo-box')!.addEventListener('search', () => (window as any).__search++); });
    await page.locator('combo-box').focus();
    await expect.poll(() => innerFocus(page)).toBe('search-input');
    await page.keyboard.type('x');
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => (window as any).__search)).toBe(1);
  });

  test('searchable: options are not filtered automatically', async ({ mount, page }) => {
    await mount(BASIC('searchable'));
    await page.locator('combo-box').focus();
    await expect.poll(() => innerFocus(page)).toBe('search-input');
    await page.keyboard.type('zzz');
    await page.waitForTimeout(500);
    await expect(page.locator('combo-box box-option:visible')).toHaveCount(4);
  });

  test('typing letters in the search field is not typeahead', async ({ mount, page }) => {
    await mount(BASIC('filterable'));
    await page.locator('combo-box').focus();
    await expect.poll(() => innerFocus(page)).toBe('search-input');
    await page.keyboard.type('c');
    expect(await innerFocus(page)).toBe('search-input');
    expect(await page.locator('combo-box [part="search-input"]').inputValue()).toBe('c');
  });

  test('Escape from the search field closes and returns focus to the combobox', async ({ mount, page }) => {
    await mount(BASIC('filterable'));
    await page.locator('combo-box').focus();
    await expect.poll(() => innerFocus(page)).toBe('search-input');
    await page.keyboard.press('Escape');
    expect(await isOpen(page)).toBe(false);
    expect(await innerFocus(page)).toBe('host');
  });

  test('ArrowDown on the combobox moves into the search field', async ({ mount, page }) => {
    await mount(BASIC('filterable'));
    await page.locator('combo-box').focus();
    await expect.poll(() => innerFocus(page)).toBe('search-input');
    await page.keyboard.press('Escape');
    await page.keyboard.press('ArrowDown');
    expect(await innerFocus(page)).toBe('search-input');
  });

  test('selecting an option in a single filterable combobox closes it', async ({ mount, page }) => {
    await mount(BASIC('filterable'));
    await page.locator('combo-box').focus();
    await expect.poll(() => innerFocus(page)).toBe('search-input');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    expect(await value(page)).toBe('apple');
    expect(await isOpen(page)).toBe(false);
    expect(await innerFocus(page)).toBe('host');
  });
});
