import { test, expect, FRUITS, descendants, shape, settle, type AxNode } from './fixtures';

/**
 * These tests read Chrome's real accessibility tree (DevTools protocol),
 * the same tree that screen readers consume.
 * Roles and states set through ElementInternals are only visible there,
 * not through Playwright's getByRole() (which can only see ARIA attributes).
 */

const LABELLED = (attrs = '', options = FRUITS) => `
  <label for="fruit">Fruit</label>
  <combo-box id="fruit" ${attrs}>${options}</combo-box>
`;

test.describe('combobox role and name', () => {
  test('host is exposed as a combobox', async ({ mount, ax }) => {
    await mount(LABELLED());
    const tree = await ax();
    expect(tree.all('combobox')).toHaveLength(1);
  });

  test('name comes from <label for>', async ({ mount, ax }) => {
    await mount(LABELLED());
    expect((await ax()).get('combobox').name).toBe('Fruit');
  });

  test('name comes from a wrapping <label>', async ({ mount, ax }) => {
    await mount(`<label>Colour <combo-box>${FRUITS}</combo-box></label>`);
    expect((await ax()).get('combobox').name).toBe('Colour');
  });

  test('name comes from aria-label', async ({ mount, ax }) => {
    await mount(`<combo-box aria-label="Pick a fruit">${FRUITS}</combo-box>`);
    expect((await ax()).get('combobox').name).toBe('Pick a fruit');
  });

  test('name comes from aria-labelledby', async ({ mount, ax }) => {
    await mount(`<span id="lbl">Favourite fruit</span><combo-box aria-labelledby="lbl">${FRUITS}</combo-box>`);
    expect((await ax()).get('combobox').name).toBe('Favourite fruit');
  });

  test('the name is not computed from content (selected text, placeholder, buttons)', async ({ mount, ax }) => {
    await mount(`<combo-box clearable placeholder="Choose one"><box-option value="a" selected>Apple</box-option></combo-box>`);
    expect((await ax()).get('combobox').name).toBe('');
  });

  test('aria-describedby on the host is honoured', async ({ mount, ax }) => {
    await mount(`<label for="c">Fruit</label><combo-box id="c" aria-describedby="hint">${FRUITS}</combo-box><p id="hint">Pick one you like</p>`);
    const combo = (await ax()).get('combobox');
    expect(combo.relations.describedby).toHaveLength(1);
  });
});

test.describe('combobox value', () => {
  test('value is the label of the selected option', async ({ mount, ax }) => {
    await mount(LABELLED('', `<box-option value="a">Apple</box-option><box-option value="b" selected>Banana</box-option>`));
    expect((await ax()).get('combobox').value).toBe('Banana');
  });

  test('value is empty when nothing is selected (placeholder is not the value)', async ({ mount, ax }) => {
    await mount(LABELLED('placeholder="Choose"'));
    const combo = (await ax()).get('combobox');
    expect(combo.value ?? '').toBe('');
  });

  test('placeholder is hidden from the accessibility tree', async ({ mount, ax }) => {
    await mount(LABELLED('placeholder="Choose a fruit"'));
    const tree = await ax();
    expect(tree.toString()).not.toContain('Choose a fruit');
  });

  test('value uses the option label attribute when present', async ({ mount, ax }) => {
    await mount(LABELLED('', `<box-option value="a" label="Green apple" selected>🍏</box-option>`));
    expect((await ax()).get('combobox').value).toBe('Green apple');
  });

  test('value of a multiple combobox lists every selected label', async ({ mount, ax }) => {
    await mount(LABELLED('multiple', `
      <box-option value="a" selected>Apple</box-option>
      <box-option value="b">Banana</box-option>
      <box-option value="c" selected>Cherry</box-option>`));
    expect((await ax()).get('combobox').value).toBe('Apple, Cherry');
  });

  test('value follows programmatic value changes', async ({ mount, ax, page }) => {
    await mount(LABELLED());
    await page.evaluate(() => (document.querySelector('combo-box') as any).value = 'cherry');
    await settle(page);
    expect((await ax()).get('combobox').value).toBe('Cherry');
  });

  test('value follows option.selected changes', async ({ mount, ax, page }) => {
    await mount(LABELLED());
    await page.locator('combo-box box-option[value=date]').evaluate((o: any) => o.selected = true);
    await settle(page);
    expect((await ax()).get('combobox').value).toBe('Date');
  });

  test('value is cleared after deselecting', async ({ mount, ax, page }) => {
    await mount(LABELLED('', `<box-option value="a" selected>Apple</box-option>`));
    await page.locator('combo-box box-option').evaluate((o: any) => o.selected = false);
    await settle(page);
    expect((await ax()).get('combobox').value ?? '').toBe('');
  });

  test('value does not include the popup content while open', async ({ mount, ax, page }) => {
    await mount(LABELLED('', `<box-option value="a">Apple</box-option><box-option value="b" selected>Banana</box-option>`));
    await page.locator('combo-box').focus();
    const combo = (await ax()).get('combobox');
    expect(combo.props.expanded).toBe(true);
    expect(combo.value).toBe('Banana');
  });

  test('value does not include tag buttons of a clearable combobox', async ({ mount, ax, page }) => {
    await mount(LABELLED('clearable', `<box-option value="b" selected>Banana</box-option>`));
    await page.locator('combo-box').focus();
    expect((await ax()).get('combobox').value).toBe('Banana');
  });

  test('value does not include the search field or the dialog of a filterable combobox', async ({ mount, ax, page }) => {
    await mount(LABELLED('filterable multiple', `<box-option value="a" selected>Apple</box-option><box-option value="b">Banana</box-option>`));
    await page.locator('combo-box').focus();
    const combo = (await ax()).get('combobox');
    expect(combo.props.expanded).toBe(true);
    expect(combo.value).toBe('Apple');
  });

  test('value is exposed through a single visually hidden text node', async ({ mount, page }) => {
    await mount(LABELLED('', `<box-option value="b" selected>Banana</box-option>`));
    const box = await page.locator('combo-box [part="value"]').boundingBox();
    expect(box!.width).toBeLessThanOrEqual(1);
    expect(box!.height).toBeLessThanOrEqual(1);
    await expect(page.locator('combo-box [part="value"]')).toHaveText('Banana');
  });
});

test.describe('combobox states', () => {
  test('collapsed: expanded=false, popup has no options in the tree', async ({ mount, ax }) => {
    await mount(LABELLED());
    const tree = await ax();
    expect(tree.get('combobox').props.expanded).toBe(false);
    expect(tree.all('option')).toHaveLength(0);
  });

  test('expanded=true while the dropdown is open', async ({ mount, ax, page }) => {
    await mount(LABELLED());
    await page.locator('combo-box').focus();
    expect((await ax()).get('combobox').props.expanded).toBe(true);
  });

  test('expanded=false again after Escape', async ({ mount, ax, page }) => {
    await mount(LABELLED());
    await page.locator('combo-box').focus();
    await page.keyboard.press('Escape');
    expect((await ax()).get('combobox').props.expanded).toBe(false);
  });

  test('hasPopup=listbox for a plain combobox', async ({ mount, ax }) => {
    await mount(LABELLED());
    expect((await ax()).get('combobox').props.hasPopup).toBe('listbox');
  });

  for (const mode of ['searchable', 'filterable']) {
    test(`hasPopup=dialog for a ${mode} combobox`, async ({ mount, ax }) => {
      await mount(LABELLED(mode));
      expect((await ax()).get('combobox').props.hasPopup).toBe('dialog');
    });
  }

  test('hasPopup follows toggling filterable at runtime', async ({ mount, ax, page }) => {
    await mount(LABELLED());
    await page.evaluate(() => (document.querySelector('combo-box') as any).filterable = true);
    expect((await ax()).get('combobox').props.hasPopup).toBe('dialog');
    await page.evaluate(() => (document.querySelector('combo-box') as any).filterable = false);
    expect((await ax()).get('combobox').props.hasPopup).toBe('listbox');
  });

  test('aria-controls points at the listbox', async ({ mount, ax, page }) => {
    await mount(LABELLED());
    await page.locator('combo-box').focus();
    const tree = await ax();
    const controlled = tree.related(tree.get('combobox'), 'controls');
    expect(controlled.map((n) => n.role)).toEqual(['listbox']);
  });

  test('aria-controls points at the dialog when there is a search field', async ({ mount, ax, page }) => {
    await mount(LABELLED('filterable'));
    await page.locator('combo-box').focus();
    const tree = await ax();
    const controlled = tree.related(tree.get('combobox'), 'controls');
    expect(controlled.map((n) => n.role)).toEqual(['dialog']);
  });

  test('not required by default', async ({ mount, ax }) => {
    await mount(LABELLED());
    expect((await ax()).get('combobox').props.required).toBe(false);
  });

  test('required attribute is exposed', async ({ mount, ax }) => {
    await mount(LABELLED('required'));
    expect((await ax()).get('combobox').props.required).toBe(true);
  });

  test('required property is exposed and can be removed', async ({ mount, ax, page }) => {
    await mount(LABELLED());
    await page.evaluate(() => (document.querySelector('combo-box') as any).required = true);
    expect((await ax()).get('combobox').props.required).toBe(true);
    await page.evaluate(() => (document.querySelector('combo-box') as any).required = false);
    expect((await ax()).get('combobox').props.required).toBe(false);
  });

  test('required="false" string is not required', async ({ mount, ax }) => {
    await mount(LABELLED('required="false"'));
    expect((await ax()).get('combobox').props.required).toBe(false);
  });

  test('not disabled by default', async ({ mount, ax }) => {
    await mount(LABELLED());
    expect((await ax()).get('combobox').props.disabled).toBeUndefined();
  });

  test('disabled attribute is exposed and the combobox stays in the tree', async ({ mount, ax }) => {
    await mount(LABELLED('disabled', `<box-option value="a" selected>Apple</box-option>`));
    const combo = (await ax()).get('combobox', 'Fruit');
    expect(combo.props.disabled).toBe(true);
    // Known Chrome limitation: a disabled form-associated element is not focusable, and Chrome
    // computes the value of an ARIA combobox only while it is focusable, so there is no value here.
  });

  test('disabled combobox regains its value once enabled', async ({ mount, ax, page }) => {
    await mount(LABELLED('disabled', `<box-option value="a" selected>Apple</box-option>`));
    await page.evaluate(() => (document.querySelector('combo-box') as any).disabled = false);
    expect((await ax()).get('combobox', 'Fruit').value).toBe('Apple');
  });

  test('disabled property toggles the state', async ({ mount, ax, page }) => {
    await mount(LABELLED());
    await page.evaluate(() => (document.querySelector('combo-box') as any).disabled = true);
    expect((await ax()).get('combobox').props.disabled).toBe(true);
    await page.evaluate(() => (document.querySelector('combo-box') as any).disabled = false);
    expect((await ax()).get('combobox').props.disabled).toBeUndefined();
  });

  test('host is not made inert when disabled', async ({ mount, page }) => {
    await mount(LABELLED('disabled'));
    expect(await page.locator('combo-box').evaluate((el) => el.hasAttribute('inert'))).toBe(false);
  });

  test('a disabled <fieldset> disables the combobox', async ({ mount, ax }) => {
    await mount(`<fieldset disabled><label for="c">Fruit</label><combo-box id="c">${FRUITS}</combo-box></fieldset>`);
    expect((await ax()).get('combobox').props.disabled).toBe(true);
  });

  test('enabling the fieldset re-enables the combobox', async ({ mount, ax, page }) => {
    await mount(`<fieldset disabled><label for="c">Fruit</label><combo-box id="c">${FRUITS}</combo-box></fieldset>`);
    await page.evaluate(() => document.querySelector('fieldset')!.disabled = false);
    expect((await ax()).get('combobox').props.disabled).toBeUndefined();
  });

  test('the host itself is focused (not an inner element)', async ({ mount, ax, page }) => {
    await mount(`<button id="before">before</button>${LABELLED()}`);
    await page.locator('#before').focus();
    await page.keyboard.press('Tab');
    const tree = await ax();
    expect(tree.focused()?.role).toBe('combobox');
    expect(tree.get('combobox').props.focused).toBe(true);
  });

  test('a focused option is reported as focused inside the listbox', async ({ mount, ax, page }) => {
    await mount(LABELLED());
    await page.locator('combo-box').focus();
    await page.keyboard.press('ArrowDown');
    const focused = (await ax()).focused();
    expect(focused?.role).toBe('option');
    expect(focused?.name).toBe('Apple');
    expect(focused?.parent?.role).toBe('listbox');
  });
});

test.describe('listbox and options', () => {
  const openTree = async (mount: any, ax: any, page: any, html: string) => {
    await mount(html);
    await page.locator('combo-box').first().focus();
    return ax();
  };

  test('popup is a listbox with option children', async ({ mount, ax, page }) => {
    const tree = await openTree(mount, ax, page, LABELLED());
    const listbox = tree.get('listbox');
    expect(listbox.children.map((n: AxNode) => `${n.role}:${n.name}`)).toEqual([
      'option:Apple', 'option:Banana', 'option:Cherry', 'option:Date',
    ]);
  });

  test('listbox of a plain combobox is unnamed, like the popup of <select>', async ({ mount, ax, page }) => {
    const tree = await openTree(mount, ax, page, LABELLED());
    expect(tree.get('listbox').name).toBe('');
  });

  test('listbox is single-select by default', async ({ mount, ax, page }) => {
    const tree = await openTree(mount, ax, page, LABELLED());
    expect(tree.get('listbox').props.multiselectable).toBe(false);
  });

  test('listbox is multiselectable with multiple', async ({ mount, ax, page }) => {
    const tree = await openTree(mount, ax, page, LABELLED('multiple'));
    expect(tree.get('listbox').props.multiselectable).toBe(true);
  });

  test('multiselectable follows the multiple property', async ({ mount, ax, page }) => {
    await mount(LABELLED());
    await page.evaluate(() => (document.querySelector('combo-box') as any).multiple = true);
    await page.locator('combo-box').focus();
    expect((await ax()).get('listbox').props.multiselectable).toBe(true);
  });

  test('every option reports selected=false/true', async ({ mount, ax, page }) => {
    const tree = await openTree(mount, ax, page, LABELLED('', `
      <box-option value="a">Apple</box-option><box-option value="b" selected>Banana</box-option>`));
    expect(tree.get('option', 'Apple').props.selected).toBe(false);
    expect(tree.get('option', 'Banana').props.selected).toBe(true);
  });

  test('selecting another option moves selected=true', async ({ mount, ax, page }) => {
    await mount(LABELLED('', `<box-option value="a" selected>Apple</box-option><box-option value="b">Banana</box-option>`));
    await page.evaluate(() => (document.querySelector('combo-box') as any).value = 'b');
    await page.locator('combo-box').focus();
    const tree = await ax();
    expect(tree.get('option', 'Apple').props.selected).toBe(false);
    expect(tree.get('option', 'Banana').props.selected).toBe(true);
  });

  test('several options are selected in a multiple combobox', async ({ mount, ax, page }) => {
    const tree = await openTree(mount, ax, page, LABELLED('multiple', `
      <box-option value="a" selected>Apple</box-option>
      <box-option value="b">Banana</box-option>
      <box-option value="c" selected>Cherry</box-option>`));
    expect(tree.all('option').map((o: AxNode) => o.props.selected)).toEqual([true, false, true]);
  });

  test('disabled unselected option has no selected state, like a native disabled <option>', async ({ mount, ax, page }) => {
    const tree = await openTree(mount, ax, page, LABELLED('', `
      <box-option value="a">Apple</box-option><box-option value="b" disabled>Banana</box-option>`));
    expect(tree.get('option', 'Banana').props.selected).toBeUndefined();
  });

  test('disabled selected option still reports selected=true', async ({ mount, ax, page }) => {
    const tree = await openTree(mount, ax, page, LABELLED('', `
      <box-option value="a">Apple</box-option><box-option value="b" disabled selected>Banana</box-option>`));
    expect(tree.get('option', 'Banana').props.selected).toBe(true);
  });

  test('disabled option is in the tree and marked disabled', async ({ mount, ax, page }) => {
    const tree = await openTree(mount, ax, page, LABELLED('', `
      <box-option value="a">Apple</box-option><box-option value="b" disabled>Banana</box-option>`));
    expect(tree.get('option', 'Banana').props.disabled).toBe(true);
    expect(tree.get('option', 'Apple').props.disabled).toBeUndefined();
  });

  test('option.disabled property toggles the state', async ({ mount, ax, page }) => {
    await mount(LABELLED());
    await page.locator('combo-box box-option[value=banana]').evaluate((o: any) => o.disabled = true);
    await page.locator('combo-box').focus();
    expect((await ax()).get('option', 'Banana').props.disabled).toBe(true);
    await page.locator('combo-box box-option[value=banana]').evaluate((o: any) => o.disabled = false);
    expect((await ax()).get('option', 'Banana').props.disabled).toBeUndefined();
  });

  test('disabled option is not inert', async ({ mount, page }) => {
    await mount(LABELLED('', `<box-option value="b" disabled>Banana</box-option>`));
    const inert = await page.locator('combo-box box-option').evaluate((el) => el.hasAttribute('inert'));
    expect(inert).toBe(false);
  });

  test('option name uses the label attribute', async ({ mount, ax, page }) => {
    const tree = await openTree(mount, ax, page, LABELLED('', `<box-option value="a" label="Apple">🍎</box-option>`));
    expect(tree.all('option').map((o: AxNode) => o.name)).toEqual(['🍎']);
  });

  test('option without text content gets its value as text', async ({ mount, ax, page }) => {
    const tree = await openTree(mount, ax, page, LABELLED('', `<box-option value="Kiwi"></box-option>`));
    expect(tree.get('option').name).toBe('Kiwi');
  });

  test('option with only a label has an empty value, like <option>', async ({ mount, page }) => {
    await mount(LABELLED('', `<box-option label="Plum"></box-option>`));
    const option = page.locator('combo-box box-option');
    expect(await option.evaluate((o: any) => [o.value, o.text, o.label, o.hasAttribute('value')])).toEqual(['', '', 'Plum', false]);
  });

  test('option with only a label is displayed and named by its label', async ({ mount, ax, page }) => {
    await mount(LABELLED('', `<box-option label="Plum"></box-option>`));
    await page.locator('combo-box').focus();
    await expect(page.locator('combo-box box-option')).toHaveText('');
    expect(await page.locator('combo-box box-option').evaluate((o) => getComputedStyle(o, '::before').content)).toBe('"Plum"');
    expect((await ax()).get('option').name).toBe('Plum');
  });

  test('role and states are mirrored as attributes on options', async ({ mount, page }) => {
    await mount(LABELLED('', `<box-option value="a" selected>Apple</box-option><box-option value="b" disabled>B</box-option><box-option value="c">C</box-option>`));
    const attrs = await page.evaluate(() => Array.from(document.querySelector('combo-box')!.shadowRoot!.querySelectorAll('box-option'))
      .map((o) => [o.getAttribute('role'), o.getAttribute('aria-selected'), o.getAttribute('aria-disabled')]));
    expect(attrs).toEqual([['option', 'true', null], ['option', null, 'true'], ['option', 'false', null]]);
  });

  test('mirrored attributes agree with the accessibility tree', async ({ mount, ax, page }) => {
    await mount(LABELLED('', `<box-option value="a" selected>Apple</box-option><box-option value="b" disabled>B</box-option><box-option value="c">C</box-option>`));
    await page.locator('combo-box').focus();
    const tree = await ax();
    const fromTree = tree.all('option').map((o) => [String(o.props.selected ?? null), String(o.props.disabled ?? null)]);
    const fromAttrs = await page.locator('combo-box box-option').evaluateAll((els) =>
      els.map((o) => [o.getAttribute('aria-selected') ?? 'null', o.getAttribute('aria-disabled') ?? 'null']));
    expect(fromAttrs).toEqual(fromTree);
  });

  test('host carries role="combobox" (states stay in internals)', async ({ mount, page }) => {
    await mount(LABELLED());
    await page.locator('combo-box').focus();
    const attrs = await page.locator('combo-box').evaluate((el) => el.getAttributeNames().filter((n) => n === 'role' || n.startsWith('aria-')));
    expect(attrs).toEqual(['role']);
    await expect(page.locator('combo-box')).toHaveAttribute('role', 'combobox');
  });

  test('an author role on an option is kept', async ({ mount, page }) => {
    await mount(LABELLED('', `<box-option value="a" role="menuitemradio">A</box-option>`));
    await expect(page.locator('combo-box box-option')).toHaveAttribute('role', 'menuitemradio');
  });

  test('options are not tab stops (tabindex=-1), the list is entered with arrows', async ({ mount, page }) => {
    await mount(LABELLED());
    const tabindexes = await page.evaluate(() => Array.from(document.querySelector('combo-box')!.shadowRoot!.querySelectorAll('box-option'))
      .map((o) => o.getAttribute('tabindex')));
    expect(new Set(tabindexes)).toEqual(new Set(['-1']));
  });

  test('a document.createElement option gets the option role', async ({ mount, ax, page }) => {
    await mount(LABELLED('', ''));
    await page.evaluate(() => {
      const option = document.createElement('box-option') as any;
      option.value = 'x';
      option.textContent = 'Xigua';
      document.querySelector('combo-box')!.appendChild(option);
    });
    await page.locator('combo-box').focus();
    expect((await ax()).get('option', 'Xigua').props.selected).toBe(false);
  });

  test('options filtered out by filterable leave the tree', async ({ mount, ax, page }) => {
    await mount(LABELLED('filterable'));
    await page.locator('combo-box').focus();
    await page.keyboard.type('an');
    await expect.poll(async () => (await ax()).all('option').map((o) => o.name)).toEqual(['Banana']);
  });

  test('popup content is removed from the tree once closed', async ({ mount, ax, page }) => {
    await mount(`<button id="out">out</button>${LABELLED()}`);
    await page.locator('combo-box').focus();
    expect((await ax()).all('option')).toHaveLength(4);
    await page.locator('#out').focus();
    await expect.poll(async () => (await ax()).all('option')).toHaveLength(0);
  });
});

test.describe('optgroup', () => {
  const GROUPED = `
    <optgroup label="Citrus">
      <box-option value="lemon">Lemon</box-option>
      <box-option value="lime">Lime</box-option>
    </optgroup>
    <optgroup label="Berries" disabled>
      <box-option value="straw">Strawberry</box-option>
    </optgroup>
    <box-option value="apple">Apple</box-option>`;

  test('optgroup is a named group inside the listbox', async ({ mount, ax, page }) => {
    await mount(LABELLED('', GROUPED));
    await page.locator('combo-box').focus();
    const tree = await ax();
    const citrus = tree.get('group', 'Citrus');
    expect(citrus.parent?.role).toBe('listbox');
    expect(citrus.children.map((n) => n.name)).toEqual(['Lemon', 'Lime']);
  });

  test('options of a disabled optgroup are exposed as disabled', async ({ mount, ax, page }) => {
    await mount(LABELLED('', GROUPED));
    await page.locator('combo-box').focus();
    const tree = await ax();
    expect(tree.get('option', 'Strawberry').props.disabled).toBe(true);
    expect(tree.get('option', 'Lemon').props.disabled).toBeUndefined();
  });

  test('disabled optgroup carries aria-disabled', async ({ mount, page }) => {
    await mount(LABELLED('', GROUPED));
    await expect(page.locator('combo-box optgroup[label=Berries]')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.locator('combo-box optgroup[label=Citrus]')).not.toHaveAttribute('aria-disabled', /.*/);
  });

  test('optgroup added later is given group semantics', async ({ mount, ax, page }) => {
    await mount(LABELLED('', ''));
    await page.evaluate(() => {
      const group = document.createElement('optgroup');
      group.label = 'Late';
      group.innerHTML = '<box-option value="x">X</box-option>';
      document.querySelector('combo-box')!.appendChild(group);
    });
    await settle(page);
    await page.locator('combo-box').focus();
    expect((await ax()).get('group', 'Late').children.map((n) => n.role)).toEqual(['option']);
  });
});

test.describe('tags area', () => {
  test('hidden from the tree when neither clearable nor multiple (it only repeats the value)', async ({ mount, ax }) => {
    await mount(LABELLED('', `<box-option value="a" selected>Apple</box-option>`));
    const tree = await ax();
    expect(tree.all('list')).toHaveLength(0);
    expect(tree.all('button')).toHaveLength(0);
  });

  test('clearable: a list with one item and a "Remove …" button', async ({ mount, ax }) => {
    await mount(LABELLED('clearable', `<box-option value="a" selected>Apple</box-option>`));
    const tree = await ax();
    const list = tree.get('list');
    expect(shape(list)).toEqual({ list: [{ listitem: ['button "Remove Apple"'] }] });
  });

  test('multiple: one listitem per selected option', async ({ mount, ax }) => {
    await mount(LABELLED('multiple', `
      <box-option value="a" selected>Apple</box-option>
      <box-option value="b" selected>Banana</box-option>
      <box-option value="c">Cherry</box-option>`));
    const tree = await ax();
    expect(tree.all('listitem')).toHaveLength(2);
    expect(tree.all('button', /^Remove /).map((n) => n.name)).toEqual(['Remove Apple', 'Remove Banana']);
  });

  test('tag remove button name uses the option label attribute', async ({ mount, ax }) => {
    await mount(LABELLED('multiple', `<box-option value="a" label="Green apple" selected>🍏</box-option>`));
    expect((await ax()).all('button', 'Remove Green apple')).toHaveLength(1);
  });

  test('the ✕ glyph is not part of the remove button name', async ({ mount, ax }) => {
    await mount(LABELLED('multiple', `<box-option value="a" selected>Apple</box-option>`));
    expect((await ax()).toString()).not.toMatch(/button "[^"]*✕/);
  });

  test('clear-all button is named and only in multiple mode', async ({ mount, ax }) => {
    await mount(`
      <combo-box aria-label="one" clearable><box-option value="a" selected>A</box-option></combo-box>
      <combo-box aria-label="many" multiple><box-option value="a" selected>A</box-option></combo-box>`);
    const tree = await ax();
    expect(tree.all('button', 'Clear selection')).toHaveLength(1);
    const many = tree.get('combobox', 'many');
    expect(descendants(many).some((n) => n.role === 'button' && n.name === 'Clear selection')).toBe(true);
  });

  test('clear-all button is disabled when nothing is selected', async ({ mount, ax }) => {
    await mount(LABELLED('multiple'));
    expect((await ax()).get('button', 'Clear selection').props.disabled).toBe(true);
  });

  test('clear-all button is enabled once something is selected', async ({ mount, ax, page }) => {
    await mount(LABELLED('multiple'));
    await page.evaluate(() => (document.querySelector('combo-box') as any).value = 'apple');
    await settle(page);
    expect((await ax()).get('button', 'Clear selection').props.disabled).toBeUndefined();
  });

  test('accessible strings can be localized', async ({ mount, ax, page }) => {
    await mount('');
    await page.evaluate(() => {
      const ctor = customElements.get('combo-box') as any;
      ctor.strings.clearAll = 'Очистить';
      ctor.strings.removeTag = 'Удалить';
      document.body.innerHTML = '<combo-box aria-label="x" multiple><box-option value="a" selected>Яблоко</box-option></combo-box>';
    });
    await settle(page);
    const tree = await ax();
    expect(tree.all('button', 'Очистить')).toHaveLength(1);
    expect(tree.all('button', 'Удалить Яблоко')).toHaveLength(1);
  });

  test('custom tag template keeps an explicit aria-label of its button', async ({ mount, ax }) => {
    await mount(`
      <combo-box aria-label="Fruit" multiple>
        <box-tag><span slot="label" part="tag-label"></span><button part="clear-tag" aria-label="Drop it">x</button></box-tag>
        <box-option value="a" selected><span slot="label">Apple</span></box-option>
      </combo-box>`);
    expect((await ax()).all('button', 'Drop it')).toHaveLength(1);
  });

  test('custom tag template button without a name gets "Remove …"', async ({ mount, ax }) => {
    await mount(`
      <combo-box aria-label="Fruit" multiple>
        <box-tag><button part="clear-tag">x</button></box-tag>
        <box-option value="a" selected>Apple</box-option>
      </combo-box>`);
    expect((await ax()).all('button', 'Remove Apple')).toHaveLength(1);
  });
});

test.describe('search field (searchable / filterable)', () => {
  for (const mode of ['searchable', 'filterable']) {
    test(`${mode}: popup is a dialog with a textbox and a named listbox`, async ({ mount, ax, page }) => {
      await mount(LABELLED(mode));
      await page.locator('combo-box').focus();
      const tree = await ax();
      const dialog = tree.get('dialog');
      expect(dialog.children.map((n) => n.role)).toEqual(['textbox', 'listbox']);
      expect(tree.get('listbox').name).toBe('Fruit');
    });

    test(`${mode}: the search textbox controls the listbox and autocompletes a list`, async ({ mount, ax, page }) => {
      await mount(LABELLED(mode));
      await page.locator('combo-box').focus();
      const tree = await ax();
      const textbox = tree.get('textbox');
      expect(textbox.name).toBe('Поиск');
      expect(textbox.props.autocomplete).toBe('list');
      expect(tree.related(textbox, 'controls').map((n) => n.role)).toEqual(['listbox']);
    });

    test(`${mode}: the dialog is unnamed so it is not read as part of the value`, async ({ mount, ax, page }) => {
      await mount(LABELLED(mode));
      await page.locator('combo-box').focus();
      expect((await ax()).get('dialog').name).toBe('');
    });
  }

  test('listbox name follows aria-label when there is no <label>', async ({ mount, ax, page }) => {
    await mount(`<combo-box aria-label="Berries" filterable>${FRUITS}</combo-box>`);
    await page.locator('combo-box').focus();
    expect((await ax()).get('listbox').name).toBe('Berries');
  });

  test('search field takes focus when the dialog opens with nothing selected', async ({ mount, ax, page }) => {
    await mount(LABELLED('filterable'));
    await page.locator('combo-box').focus();
    await expect.poll(async () => (await ax()).focused()?.role).toBe('textbox');
  });
});

test.describe('parity with native <select>', () => {
  const pair = (selectAttrs = '', comboAttrs = '') => `
    <label for="native">Fruit</label>
    <select id="native" ${selectAttrs}>
      <option value="a">Apple</option>
      <option value="b" selected>Banana</option>
      <option value="c" disabled>Cherry</option>
    </select>
    <label for="custom">Fruit</label>
    <combo-box id="custom" ${comboAttrs}>
      <box-option value="a">Apple</box-option>
      <box-option value="b" selected>Banana</box-option>
      <box-option value="c" disabled>Cherry</box-option>
    </combo-box>`;

  const summary = (node: AxNode) => ({
    role: node.role,
    name: node.name,
    value: node.value,
    expanded: node.props.expanded,
    required: node.props.required ?? false,
    disabled: node.props.disabled ?? false,
    options: descendants(node).filter((n) => n.role === 'option')
      .map((o) => ({ name: o.name, selected: o.props.selected, disabled: o.props.disabled ?? false })),
  });

  test('collapsed: same role, name, value and expanded state', async ({ mount, ax }) => {
    await mount(pair());
    const [native, custom] = (await ax()).all('combobox');
    const n = summary(native);
    const c = summary(custom);
    expect({ ...c, options: undefined }).toEqual({ ...n, options: undefined });
  });

  test('expanded: same options with same selected/disabled states', async ({ mount, ax, page }) => {
    await mount(pair());
    await page.locator('#custom').focus();
    const [native, custom] = (await ax()).all('combobox');
    expect(summary(custom).expanded).toBe(true);
    expect(summary(custom).options).toEqual(summary(native).options);
  });

  test('required: exposed as required (Chrome reports a native required <select> as not required)', async ({ mount, ax }) => {
    await mount(pair('required', 'required'));
    const [native, custom] = (await ax()).all('combobox');
    expect(summary(custom).required).toBe(true);
    expect(custom.props.invalid).toBe(native.props.invalid);
  });

  test('disabled: same disabled state, both still in the tree', async ({ mount, ax }) => {
    await mount(pair('disabled', 'disabled'));
    const [native, custom] = (await ax()).all('combobox');
    // Value excluded: Chrome doesn't expose the value of a disabled (non-focusable) ARIA combobox
    // Options excluded: a collapsed native <select> keeps its (hidden) popup in the tree, ours doesn't.
    expect({ ...summary(custom), value: undefined, options: undefined })
      .toEqual({ ...summary(native), value: undefined, options: undefined });
  });

  test('both are focused as the combobox itself', async ({ mount, ax, page }) => {
    await mount(pair());
    await page.locator('#native').focus();
    expect((await ax()).focused()?.name).toBe('Fruit');
    await page.locator('#custom').focus();
    const focused = (await ax()).focused();
    expect(focused?.role).toBe('combobox');
    expect(focused?.name).toBe('Fruit');
  });

  test('popup structure: combobox > [group] > listbox > options, unnamed popup', async ({ mount, ax, page }) => {
    await mount(pair());
    await page.locator('#custom').focus();
    const custom = (await ax()).all('combobox')[1];
    const listbox = descendants(custom).find((n) => n.role === 'listbox')!;
    expect(listbox.name).toBe('');
    expect(listbox.children.map((n) => n.role)).toEqual(['option', 'option', 'option']);
  });
});
