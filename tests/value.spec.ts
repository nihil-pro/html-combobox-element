import { test, expect, settle, trackChanges, changes, type Page } from './fixtures';

/**
 * combobox.value = x behaves like select.value = x: every input is applied to a native <select>
 * and a <combo-box> holding the same options, and the results compared.
 */

const PAGE = (attrs = '', selected = 'b') => `
  <label for="native">Native</label>
  <select id="native" ${attrs}>
    <option value="a" ${selected === 'a' ? 'selected' : ''}>Apple</option>
    <option value="b" ${selected === 'b' ? 'selected' : ''}>Banana</option>
    <option value="42">Answer</option>
    <option value="null">Null</option>
  </select>
  <label for="custom">Custom</label>
  <combo-box id="custom" ${attrs}>
    <box-option value="a" ${selected === 'a' ? 'selected' : ''}>Apple</box-option>
    <box-option value="b" ${selected === 'b' ? 'selected' : ''}>Banana</box-option>
    <box-option value="42">Answer</box-option>
    <box-option value="null">Null</box-option>
  </combo-box>`;

/** Assign `input` (a JS expression) to both elements' value, return [native, custom] states */
async function assignBoth(page: Page, input: string) {
  return page.evaluate((expr) => {
    const read = (el: any) => ({ value: el.value, selectedIndex: el.selectedIndex, selected: Array.from(el.options, (o: any) => o.selected) });
    const value = (0, eval)(`(${expr})`);
    const native = document.getElementById('native') as any;
    const custom = document.getElementById('custom') as any;
    native.value = value;
    custom.value = value;
    return [read(native), read(custom)];
  }, input);
}

test.describe('value setter: same result as select.value', () => {
  const INPUTS: [string, string, number][] = [
    // [input expression, expected value, expected selectedIndex]
    ['undefined', '', -1],
    ["''", '', -1],
    ["'a'", 'a', 0],
    ['42', '42', 2],
    ["'unknown'", '', -1],
    ['true', '', -1],
    ['{ toString() { return "a" } }', 'a', 0],
  ];
  for (const [input, value, selectedIndex] of INPUTS) {
    test(`value = ${input}`, async ({ mount, page }) => {
      await mount(PAGE());
      const [native, custom] = await assignBoth(page, input);
      expect(custom).toEqual(native);
      expect(custom).toMatchObject({ value, selectedIndex });
    });
  }

  // Deliberate difference: native converts null to "null" and would select <option value="null">;
  // <combo-box> treats null like undefined (clears), which is what frameworks mean by it.
  test('value = null clears the selection (native would select an option valued "null")', async ({ mount, page }) => {
    await mount(PAGE());
    const [native, custom] = await assignBoth(page, 'null');
    expect(native).toMatchObject({ value: 'null', selectedIndex: 3 });
    expect(custom).toMatchObject({ value: '', selectedIndex: -1 });
  });

  test('value = null without an option valued "null" gives the same result as native', async ({ mount, page }) => {
    await mount(PAGE().replace(/<option value="null">Null<\/option>|<box-option value="null">Null<\/box-option>/g, ''));
    const [native, custom] = await assignBoth(page, 'null');
    expect(custom).toEqual(native);
  });
});

test.describe('value = undefined / null / "" clears the selection', () => {
  for (const input of ['undefined', 'null', "''"]) {
    test(`${input}: no option selected, no tag, empty value text`, async ({ mount, page }) => {
      await mount(PAGE('', 'b'));
      await page.locator('#custom').evaluate((el: any, expr) => el.value = (0, eval)(expr), input);
      await expect(page.locator('#custom box-option[selected]')).toHaveCount(0);
      await expect(page.locator('#custom box-tag')).toHaveCount(0);
      await expect(page.locator('#custom [part="value"]')).toHaveText('');
      await expect(page.locator('#custom [part="placeholder"]')).toBeVisible();
    });
  }

  test('clears every selected option in multiple mode', async ({ mount, page }) => {
    await mount(`<combo-box multiple value="a,b"><box-option value="a">A</box-option><box-option value="b">B</box-option></combo-box>`);
    await page.locator('combo-box').evaluate((el: any) => el.value = undefined);
    expect(await page.locator('combo-box').evaluate((el: any) => [el.value, el.valueAsArray, el.selectedIndex])).toEqual(['', [], -1]);
  });

  test('a cleared required combobox becomes invalid', async ({ mount, page }) => {
    await mount(`<combo-box required value="a"><box-option value="a">A</box-option></combo-box>`);
    await page.locator('combo-box').evaluate((el: any) => el.value = undefined);
    expect(await page.locator('combo-box').evaluate((el: any) => el.validity.valueMissing)).toBe(true);
  });

  test('the cleared value is submitted as empty', async ({ mount, page }) => {
    await mount(`<form><combo-box name="f" value="a"><box-option value="a">A</box-option></combo-box></form>`);
    await page.locator('combo-box').evaluate((el: any) => el.value = undefined);
    expect(await page.evaluate(() => new FormData(document.querySelector('form')!).get('f'))).toBe('');
  });

  test('clearing an already empty combobox does nothing (no change event)', async ({ mount, page }) => {
    await mount(`<combo-box><box-option value="a">A</box-option></combo-box>`);
    await trackChanges(page);
    await page.locator('combo-box').evaluate((el: any) => { el.value = undefined; el.value = null; el.value = ''; });
    expect(await changes(page)).toEqual([]);
  });

  test('then Playwright-style selection works: clear, then select options', async ({ mount, page }) => {
    await mount(`<combo-box multiple value="a"><box-option value="a">A</box-option><box-option value="b">B</box-option></combo-box>`);
    expect(await page.locator('combo-box').evaluate((el: any) => {
      el.value = undefined;
      el.options[1].selected = true;
      return el.value;
    })).toBe('b');
  });
});

test.describe('accessible value: the selected option text, not its value (like <select>)', () => {
  test('value="1" with text "Foo" is exposed as "Foo", as on a native select', async ({ mount, ax }) => {
    await mount(`
      <label for="n">Native</label><select id="n"><option value="1" selected>Foo</option></select>
      <label for="c">Custom</label><combo-box id="c"><box-option value="1" selected>Foo</box-option></combo-box>`);
    const tree = await ax();
    expect(tree.get('combobox', 'Native').value).toBe('Foo');
    expect(tree.get('combobox', 'Custom').value).toBe('Foo');
  });

  test('after value = undefined the accessible value is empty, like a native select', async ({ mount, ax, page }) => {
    await mount(PAGE());
    await assignBoth(page, 'undefined');
    await settle(page);
    const tree = await ax();
    expect(tree.get('combobox', 'Custom').value ?? '').toBe(tree.get('combobox', 'Native').value ?? '');
  });

  test('after value = "a" the accessible value is the text "Apple"', async ({ mount, ax, page }) => {
    await mount(PAGE());
    await assignBoth(page, "'a'");
    await settle(page);
    const tree = await ax();
    expect(tree.get('combobox', 'Native').value).toBe('Apple');
    expect(tree.get('combobox', 'Custom').value).toBe('Apple');
  });
});

test.describe('value attribute and initial state', () => {
  test('without a value attribute, options selected in the markup stay selected', async ({ mount, page }) => {
    await mount(`<combo-box><box-option value="a">A</box-option><box-option value="b" selected>B</box-option></combo-box>`);
    expect(await page.locator('combo-box').evaluate((el: any) => el.value)).toBe('b');
  });

  test('reconnecting does not clear the selection', async ({ mount, page }) => {
    await mount(`<div id="a"></div><combo-box><box-option value="a">A</box-option><box-option value="b" selected>B</box-option></combo-box>`);
    await page.evaluate(() => document.getElementById('a')!.append(document.querySelector('combo-box')!));
    expect(await page.locator('combo-box').evaluate((el: any) => el.value)).toBe('b');
  });

  test('removeAttribute("value") keeps the selection (the attribute is only an initial value)', async ({ mount, page }) => {
    await mount(`<combo-box value="b"><box-option value="a">A</box-option><box-option value="b">B</box-option></combo-box>`);
    expect(await page.locator('combo-box').evaluate((el: any) => { el.removeAttribute('value'); return [el.hasAttribute('value'), el.value]; }))
      .toEqual([false, 'b']);
  });

  test('removeAttribute("placeholder") restores the default placeholder (not "false")', async ({ mount, page }) => {
    await mount(`<combo-box placeholder="Pick"><box-option value="a">A</box-option></combo-box>`);
    await page.locator('combo-box').evaluate((el: any) => el.removeAttribute('placeholder'));
    await expect(page.locator('combo-box [part="placeholder"]')).not.toHaveText('false');
    await expect(page.locator('combo-box [part="placeholder"]')).not.toHaveText('Pick');
  });

  test('removeAttribute("query") empties the search field (not "false")', async ({ mount, page }) => {
    await mount(`<combo-box searchable query="abc"><box-option value="a">A</box-option></combo-box>`);
    await page.locator('combo-box').evaluate((el: any) => el.removeAttribute('query'));
    expect(await page.locator('combo-box [part="search-input"]').inputValue()).toBe('');
  });

  test('removeAttribute on boolean attributes still turns them off', async ({ mount, page }) => {
    await mount(`<combo-box multiple required><box-option value="a">A</box-option></combo-box>`);
    expect(await page.locator('combo-box').evaluate((el: any) => { el.removeAttribute('multiple'); el.removeAttribute('required'); return [el.multiple, el.required]; }))
      .toEqual([false, false]);
  });
});
