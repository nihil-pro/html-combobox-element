import { test, expect, FRUITS, settle, axTree, trackChanges, changes, type Page } from './fixtures';

/**
 * Attributes can change through many paths. The setters (and the setAttribute/removeAttribute
 * overrides routed to them) normalize; attributeChangedCallback applies the side effects, so every
 * path ends in the same state: property, ARIA, accessibility tree and the combobox value.
 */

/** Evaluate `source` (a function of the combobox element) in Playwright's main world. */
const inPage = (page: Page, source: string) =>
  page.locator('combo-box').first().evaluate((el, src) => (0, eval)(`(${src})`)(el), source);

/** Evaluate an expression in a separate JavaScript world, where the component's classes don't exist. */
async function inIsolatedWorld(page: Page, expression: string) {
  const cdp = await page.context().newCDPSession(page);
  const { frameTree } = await cdp.send('Page.getFrameTree');
  const { executionContextId } = await cdp.send('Page.createIsolatedWorld', { frameId: frameTree.frame.id, worldName: 'other-world' });
  const result = await cdp.send('Runtime.evaluate', { expression, contextId: executionContextId, returnByValue: true });
  await cdp.detach();
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

const OPTION = (v: string) => `document.querySelector('combo-box').shadowRoot.querySelector('box-option[value=${v}]')`;

/** Every way to set a boolean attribute on an element `el` (a JS expression) */
const SET_PATHS: Record<string, (el: string, name: string, value: string) => string> = {
  'override setAttribute': (el, n, v) => `${el}.setAttribute('${n}', '${v}')`,
  'Element.prototype.setAttribute': (el, n, v) => `Element.prototype.setAttribute.call(${el}, '${n}', '${v}')`,
  'setAttributeNS': (el, n, v) => `${el}.setAttributeNS(null, '${n}', '${v}')`,
  'setAttributeNode': (el, n, v) => `(() => { const a = document.createAttribute('${n}'); a.value = '${v}'; ${el}.setAttributeNode(a); })()`,
  'toggleAttribute': (el, n) => `${el}.toggleAttribute('${n}', true)`,
  'Element.prototype.toggleAttribute': (el, n) => `Element.prototype.toggleAttribute.call(${el}, '${n}', true)`,
  'property': (el, n) => `${el}.${n} = true`,
};

const REMOVE_PATHS: Record<string, (el: string, name: string) => string> = {
  'override removeAttribute': (el, n) => `${el}.removeAttribute('${n}')`,
  'Element.prototype.removeAttribute': (el, n) => `Element.prototype.removeAttribute.call(${el}, '${n}')`,
  'removeAttributeNS': (el, n) => `${el}.removeAttributeNS(null, '${n}')`,
  'removeAttributeNode': (el, n) => `${el}.removeAttributeNode(${el}.getAttributeNode('${n}'))`,
  'toggleAttribute': (el, n) => `${el}.toggleAttribute('${n}', false)`,
  'property': (el, n) => `${el}.${n} = false`,
};

const optionState = (page: Page, value: string) => page.evaluate((v) => {
  const host = document.querySelector('combo-box') as any;
  const option = host.shadowRoot.querySelector(`box-option[value=${v}]`) as any;
  return {
    selected: option.selected,
    disabled: option.disabled,
    ariaSelected: option.getAttribute('aria-selected'),
    ariaDisabled: option.getAttribute('aria-disabled'),
    part: option.getAttribute('part'),
    hostValue: host.value,
    tags: host.shadowRoot.querySelectorAll('box-tag').length,
  };
}, value);

test.describe('box-option selected: every path selects the same way', () => {
  for (const [name, path] of Object.entries(SET_PATHS)) {
    test(`set via ${name}`, async ({ mount, page }) => {
      await mount(`<combo-box aria-label="Fruit">${FRUITS}</combo-box>`);
      await page.evaluate(path(OPTION('banana'), 'selected', ''));
      expect(await optionState(page, 'banana')).toMatchObject({
        selected: true, ariaSelected: 'true', hostValue: 'banana', tags: 1, part: expect.stringContaining('selected'),
      });
    });
  }

  for (const [name, path] of Object.entries(REMOVE_PATHS)) {
    test(`removed via ${name}`, async ({ mount, page }) => {
      await mount(`<combo-box aria-label="Fruit" value="banana">${FRUITS}</combo-box>`);
      await page.evaluate(path(OPTION('banana'), 'selected'));
      expect(await optionState(page, 'banana')).toMatchObject({ selected: false, ariaSelected: 'false', hostValue: '', tags: 0 });
    });
  }

  test('set from another JavaScript world (Playwright utility world, extensions)', async ({ mount, page }) => {
    await mount(`<combo-box aria-label="Fruit">${FRUITS}</combo-box>`);
    await inIsolatedWorld(page, `${OPTION('cherry')}.setAttribute('selected', '')`);
    expect(await optionState(page, 'cherry')).toMatchObject({ selected: true, ariaSelected: 'true', hostValue: 'cherry', tags: 1 });
  });

  test('removed from another JavaScript world', async ({ mount, page }) => {
    await mount(`<combo-box aria-label="Fruit" value="cherry">${FRUITS}</combo-box>`);
    await inIsolatedWorld(page, `${OPTION('cherry')}.removeAttribute('selected')`);
    expect(await optionState(page, 'cherry')).toMatchObject({ selected: false, hostValue: '', tags: 0 });
  });

  test('changing the Attr node value', async ({ mount, page }) => {
    await mount(`<combo-box aria-label="Fruit" value="banana">${FRUITS}</combo-box>`);
    await page.evaluate(`${OPTION('banana')}.getAttributeNode('selected').value = 'false'`);
    expect(await optionState(page, 'banana')).toMatchObject({ selected: false, hostValue: '' });
  });

  test('the accessibility tree follows a native setAttribute', async ({ mount, page }) => {
    await mount(`<combo-box aria-label="Fruit">${FRUITS}</combo-box>`);
    await page.evaluate(`Element.prototype.setAttribute.call(${OPTION('date')}, 'selected', '')`);
    await page.locator('combo-box').focus();
    const tree = await axTree(page);
    expect(tree.get('combobox').value).toBe('Date');
    expect(tree.get('option', 'Date').props.selected).toBe(true);
  });

  test('single mode: a native setAttribute on another option deselects the previous one', async ({ mount, page }) => {
    await mount(`<combo-box aria-label="Fruit" value="apple">${FRUITS}</combo-box>`);
    await page.evaluate(`Element.prototype.setAttribute.call(${OPTION('date')}, 'selected', '')`);
    expect(await optionState(page, 'apple')).toMatchObject({ selected: false, ariaSelected: 'false', hostValue: 'date', tags: 1 });
  });

  test('multiple mode: native setAttribute adds to the selection', async ({ mount, page }) => {
    await mount(`<combo-box aria-label="Fruit" multiple value="apple">${FRUITS}</combo-box>`);
    await page.evaluate(`Element.prototype.setAttribute.call(${OPTION('date')}, 'selected', '')`);
    expect(await optionState(page, 'date')).toMatchObject({ hostValue: 'apple,date', tags: 2 });
  });

  test('a native path dispatches no change event (a script change, like the setter)', async ({ mount, page }) => {
    await mount(`<combo-box aria-label="Fruit">${FRUITS}</combo-box>`);
    await trackChanges(page);
    await page.evaluate(`Element.prototype.setAttribute.call(${OPTION('apple')}, 'selected', '')`);
    expect(await changes(page)).toEqual([]);
  });

  test('re-setting an already selected option changes nothing', async ({ mount, page }) => {
    await mount(`<combo-box aria-label="Fruit" value="apple">${FRUITS}</combo-box>`);
    await trackChanges(page);
    await page.evaluate(`Element.prototype.setAttribute.call(${OPTION('apple')}, 'selected', 'yes')`);
    expect(await changes(page)).toEqual([]);
    expect(await optionState(page, 'apple')).toMatchObject({ selected: true, hostValue: 'apple', tags: 1 });
  });
});

test.describe('box-option selected: invalid values from paths that skip the setters', () => {
  for (const path of ['Element.prototype.setAttribute', 'setAttributeNS'] as const) {
    test(`selected="false" via ${path} is removed, not treated as selected`, async ({ mount, page }) => {
      await mount(`<combo-box aria-label="Fruit">${FRUITS}</combo-box>`);
      await page.evaluate(SET_PATHS[path](OPTION('apple'), 'selected', 'false'));
      expect(await page.evaluate(`${OPTION('apple')}.hasAttribute('selected')`)).toBe(false);
      expect(await optionState(page, 'apple')).toMatchObject({ selected: false, ariaSelected: 'false', hostValue: '' });
    });
  }

  test('selected="false" on a selected option deselects it', async ({ mount, page }) => {
    await mount(`<combo-box aria-label="Fruit" value="apple">${FRUITS}</combo-box>`);
    await page.evaluate(`Element.prototype.setAttribute.call(${OPTION('apple')}, 'selected', 'false')`);
    expect(await optionState(page, 'apple')).toMatchObject({ selected: false, hostValue: '', tags: 0 });
  });

  test('selected="false" from another world is removed too (no infinite loop)', async ({ mount, page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await mount(`<combo-box aria-label="Fruit" value="apple">${FRUITS}</combo-box>`);
    await inIsolatedWorld(page, `${OPTION('apple')}.setAttribute('selected', 'false')`);
    expect(await optionState(page, 'apple')).toMatchObject({ selected: false, hostValue: '' });
    expect(errors).toEqual([]);
  });

  test('the override still normalizes "false" before writing', async ({ mount, page }) => {
    await mount(`<combo-box aria-label="Fruit">${FRUITS}</combo-box>`);
    await page.evaluate(`${OPTION('apple')}.setAttribute('selected', 'false')`);
    expect(await page.evaluate(`${OPTION('apple')}.hasAttribute('selected')`)).toBe(false);
  });

  test('selected="false" in the initial markup is not selected', async ({ mount, page }) => {
    await mount(`<combo-box aria-label="Fruit"><box-option value="a" selected="false">A</box-option></combo-box>`);
    expect(await page.locator('combo-box').evaluate((el: any) => el.value)).toBe('');
    await expect(page.locator('combo-box box-option')).not.toHaveAttribute('selected', /.*/);
  });
});

test.describe('box-option disabled: every path', () => {
  for (const [name, path] of Object.entries(SET_PATHS)) {
    test(`set via ${name}`, async ({ mount, page }) => {
      await mount(`<combo-box aria-label="Fruit">${FRUITS}</combo-box>`);
      await page.evaluate(path(OPTION('banana'), 'disabled', ''));
      expect(await optionState(page, 'banana')).toMatchObject({
        disabled: true, ariaDisabled: 'true', ariaSelected: null, part: expect.stringContaining('disabled'),
      });
    });
  }

  for (const [name, path] of Object.entries(REMOVE_PATHS)) {
    test(`removed via ${name}`, async ({ mount, page }) => {
      await mount(`<combo-box aria-label="Fruit"><box-option value="banana" disabled>Banana</box-option></combo-box>`);
      await page.evaluate(path(OPTION('banana'), 'disabled'));
      expect(await optionState(page, 'banana')).toMatchObject({ disabled: false, ariaDisabled: null, ariaSelected: 'false' });
    });
  }

  test('disabled="false" via a native path is removed', async ({ mount, page }) => {
    await mount(`<combo-box aria-label="Fruit">${FRUITS}</combo-box>`);
    await page.evaluate(`Element.prototype.setAttribute.call(${OPTION('apple')}, 'disabled', 'false')`);
    expect(await optionState(page, 'apple')).toMatchObject({ disabled: false, ariaDisabled: null });
  });

  test('keyboard navigation skips an option disabled from another world', async ({ mount, page }) => {
    await mount(`<combo-box aria-label="Fruit">${FRUITS}</combo-box>`);
    await inIsolatedWorld(page, `${OPTION('apple')}.setAttribute('disabled', '')`);
    await page.locator('combo-box').focus();
    await page.keyboard.press('ArrowDown');
    expect(await page.evaluate(() => (document.querySelector('combo-box')!.shadowRoot!.activeElement as any)?.value)).toBe('banana');
  });
});

test.describe('box-option value/label/text fall back like <option>', () => {
  const CASES = [
    ['text only', '<X>Cherry</X>'],
    ['text with whitespace', '<X>\n   Green\t\n  apple  </X>'],
    ['value attribute', '<X value="v">Text</X>'],
    ['empty value attribute', '<X value="">Text</X>'],
    ['label attribute', '<X label="Lbl">Text</X>'],
    ['label attribute, no text', '<X label="Lbl"></X>'],
    ['empty label attribute', '<X label="">Text</X>'],
    ['value and label', '<X value="v" label="Lbl">Text</X>'],
    ['nested markup', '<X><b>Bold</b> <i>fruit</i></X>'],
  ] as const;

  for (const [name, markup] of CASES) {
    test(`${name}: same value, label and text as a native option`, async ({ mount, page }) => {
      await mount(`<select id="native">${markup.replaceAll('X', 'option')}</select>
        <combo-box id="custom">${markup.replaceAll('X', 'box-option')}</combo-box>`);
      const read = (sel: string) => page.locator(sel).evaluate((o: any) => ({ value: o.value, label: o.label, text: o.text }));
      expect(await read('#custom box-option')).toEqual(await read('#native option'));
    });
  }

  test('a label-only option is selected with an empty value', async ({ mount, page }) => {
    await mount(`<combo-box multiple><box-option label="Plum"></box-option><box-option value="k">Kiwi</box-option></combo-box>`);
    await page.locator('combo-box').evaluate((el: any) => { el.options[0].selected = true; el.options[1].selected = true; });
    expect(await page.locator('combo-box').evaluate((el: any) => [el.selectedIndex, el.valueAsArray])).toEqual([0, ['', 'k']]);
  });


  test('text setter replaces the content', async ({ mount, page }) => {
    await mount(`<combo-box><box-option>Old</box-option></combo-box>`);
    expect(await page.locator('combo-box box-option').evaluate((o: any) => { o.text = 'New'; return [o.textContent, o.value]; })).toEqual(['New', 'New']);
  });

  test('value follows the text when there is no value attribute', async ({ mount, page }) => {
    await mount(`<combo-box><box-option>Old</box-option></combo-box>`);
    expect(await page.locator('combo-box box-option').evaluate((o: any) => { o.textContent = 'Changed'; return o.value; })).toBe('Changed');
  });

  test('no value attribute is added to text-only options', async ({ mount, page }) => {
    await mount(`<combo-box><box-option>Cherry</box-option></combo-box>`);
    await expect(page.locator('combo-box box-option')).not.toHaveAttribute('value', /.*/);
  });

  test('removeAttribute("value") removes it, the value falls back to the text', async ({ mount, page }) => {
    await mount(`<combo-box><box-option value="v">Text</box-option></combo-box>`);
    expect(await page.locator('combo-box box-option').evaluate((o: any) => { o.removeAttribute('value'); return [o.hasAttribute('value'), o.value]; }))
      .toEqual([false, 'Text']);
  });

  test('removeAttribute("label") removes it, the label falls back to the text', async ({ mount, page }) => {
    await mount(`<combo-box><box-option value="v" label="L">Text</box-option></combo-box>`);
    expect(await page.locator('combo-box box-option').evaluate((o: any) => { o.removeAttribute('label'); return [o.hasAttribute('label'), o.label]; }))
      .toEqual([false, 'Text']);
  });
});

test.describe('text-only options work in the combobox', () => {
  const TEXT_ONLY = `<box-option>Apple</box-option><box-option>Banana</box-option><box-option>Cherry</box-option>`;

  test('selected in the markup', async ({ mount, page }) => {
    await mount(`<combo-box aria-label="Fruit"><box-option>Apple</box-option><box-option selected>Banana</box-option></combo-box>`);
    expect(await page.locator('combo-box').evaluate((el: any) => el.value)).toBe('Banana');
  });

  test('selected with the keyboard', async ({ mount, page }) => {
    await mount(`<combo-box aria-label="Fruit">${TEXT_ONLY}</combo-box>`);
    await page.locator('combo-box').focus();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    expect(await page.locator('combo-box').evaluate((el: any) => el.value)).toBe('Cherry');
    await expect(page.locator('combo-box [part="value"]')).toHaveText('Cherry');
  });

  test('selected through the value setter', async ({ mount, page }) => {
    await mount(`<combo-box aria-label="Fruit" multiple>${TEXT_ONLY}</combo-box>`);
    await page.locator('combo-box').evaluate((el: any) => el.value = 'Apple,Cherry');
    expect(await page.locator('combo-box').evaluate((el: any) => el.selectedIndex)).toBe(0);
    await expect(page.locator('combo-box box-tag')).toHaveCount(2);
  });

  test('removed with its tag button', async ({ mount, page }) => {
    await mount(`<combo-box aria-label="Fruit" multiple value="Apple,Banana">${TEXT_ONLY}</combo-box>`);
    await page.getByRole('button', { name: 'Remove Apple' }).click();
    expect(await page.locator('combo-box').evaluate((el: any) => el.value)).toBe('Banana');
  });

  test('removing the selected option clears the value', async ({ mount, page }) => {
    await mount(`<combo-box aria-label="Fruit" value="Banana">${TEXT_ONLY}</combo-box>`);
    await page.locator('combo-box').evaluate((el: any) => el.remove(1));
    await settle(page);
    expect(await page.locator('combo-box').evaluate((el: any) => el.value)).toBe('');
  });

  test('submitted with the form', async ({ mount, page }) => {
    await mount(`<form><combo-box name="f" value="Cherry">${TEXT_ONLY}</combo-box></form>`);
    expect(await page.evaluate(() => new FormData(document.querySelector('form')!).get('f'))).toBe('Cherry');
  });
});

test.describe('re-reported state is idempotent (option moved or upgraded)', () => {
  test('moving the selected option keeps it selected (single)', async ({ mount, page }) => {
    await mount(`<combo-box aria-label="Fruit" value="cherry">${FRUITS}</combo-box>`);
    await page.locator('combo-box').evaluate((el: any) => el.insertBefore(el.options[2], el.options[0]));
    await settle(page);
    expect(await page.locator('combo-box').evaluate((el: any) => [el.value, el.options[0].selected, el.selectedIndex])).toEqual(['cherry', true, 0]);
    await expect(page.locator('combo-box box-tag')).toHaveCount(1);
  });

  test('moving a selected option keeps the selection (multiple)', async ({ mount, page }) => {
    await mount(`<combo-box aria-label="Fruit" multiple value="apple,cherry">${FRUITS}</combo-box>`);
    await page.locator('combo-box').evaluate((el: any) => el.add(el.options[0]));
    await settle(page);
    expect(await page.locator('combo-box').evaluate((el: any) => el.valueAsArray.sort())).toEqual(['apple', 'cherry']);
    await expect(page.locator('combo-box box-tag')).toHaveCount(2);
  });

  test('an innerHTML-created selected option is selected once', async ({ mount, page }) => {
    await mount('<div id="root"></div>');
    await page.evaluate(() => {
      document.getElementById('root')!.innerHTML = '<combo-box aria-label="x"><box-option value="a">A</box-option><box-option value="b" selected>B</box-option></combo-box>';
    });
    await settle(page);
    expect(await page.locator('combo-box').evaluate((el: any) => el.value)).toBe('b');
    await expect(page.locator('combo-box box-tag')).toHaveCount(1);
  });
});

test.describe('combo-box attributes: every path applies the side effects', () => {
  const HOST = `document.querySelector('combo-box')`;
  const hostState = (page: Page) => inPage(page, `(el) => ({
    multiselectable: el.shadowRoot.querySelector('[role=listbox]').getAttribute('aria-multiselectable'),
    dialog: el.shadowRoot.querySelector('#dropdown').getAttribute('role'),
    tagsHidden: el.shadowRoot.querySelector('#internal').getAttribute('aria-hidden'),
    disabledState: el.matches(':state(disabled)'),
    valid: el.checkValidity(),
  })`);

  for (const [name, path] of Object.entries(SET_PATHS)) {
    test(`booleans set via ${name}`, async ({ mount, page }) => {
      await mount(`<combo-box aria-label="Fruit">${FRUITS}</combo-box>`);
      for (const attr of ['multiple', 'filterable', 'disabled', 'required']) await page.evaluate(path(HOST, attr, ''));
      expect(await hostState(page)).toEqual({ multiselectable: 'true', dialog: 'dialog', tagsHidden: null, disabledState: true, valid: true });
      // required is exposed; validity is skipped while disabled (barred from constraint validation)
      const tree = await axTree(page);
      expect(tree.get('combobox').props).toMatchObject({ required: true, disabled: true, hasPopup: 'dialog' });
    });
  }

  for (const [name, path] of Object.entries(REMOVE_PATHS)) {
    test(`booleans removed via ${name}`, async ({ mount, page }) => {
      await mount(`<combo-box aria-label="Fruit" multiple filterable disabled required>${FRUITS}</combo-box>`);
      for (const attr of ['multiple', 'filterable', 'disabled', 'required']) await page.evaluate(path(HOST, attr));
      expect(await hostState(page)).toEqual({ multiselectable: 'false', dialog: null, tagsHidden: 'true', disabledState: false, valid: true });
      expect((await axTree(page)).get('combobox').props).toMatchObject({ required: false, hasPopup: 'listbox' });
    });
  }

  test('required set from another world makes an empty combobox invalid', async ({ mount, page }) => {
    await mount(`<combo-box aria-label="Fruit">${FRUITS}</combo-box>`);
    await inIsolatedWorld(page, `${HOST}.setAttribute('required', '')`);
    expect(await inPage(page, `(el) => [el.required, el.checkValidity()]`)).toEqual([true, false]);
    expect((await axTree(page)).get('combobox').props.required).toBe(true);
  });

  test('disabled from another world closes and disables it', async ({ mount, page }) => {
    await mount(`<combo-box aria-label="Fruit">${FRUITS}</combo-box>`);
    await page.locator('combo-box').focus();
    await inIsolatedWorld(page, `${HOST}.setAttribute('disabled', '')`);
    expect(await inPage(page, `(el) => [el.shadowRoot.querySelector('#dropdown').matches(':popover-open'), el.matches(':state(disabled)')]`)).toEqual([false, true]);
  });

  test('multiple="false" via a native path is removed', async ({ mount, page }) => {
    await mount(`<combo-box aria-label="Fruit">${FRUITS}</combo-box>`);
    await page.evaluate(`Element.prototype.setAttribute.call(${HOST}, 'multiple', 'false')`);
    expect(await inPage(page, `(el) => [el.hasAttribute('multiple'), el.multiple, el.type]`)).toEqual([false, false, 'select-one']);
  });

  test('disabled="false" from another world is removed, the combobox stays enabled', async ({ mount, page }) => {
    await mount(`<combo-box aria-label="Fruit">${FRUITS}</combo-box>`);
    await inIsolatedWorld(page, `${HOST}.setAttribute('disabled', 'false')`);
    expect(await inPage(page, `(el) => [el.hasAttribute('disabled'), el.matches(':state(disabled)')]`)).toEqual([false, false]);
  });

  test('placeholder set natively updates the displayed placeholder', async ({ mount, page }) => {
    await mount(`<combo-box aria-label="Fruit">${FRUITS}</combo-box>`);
    await page.evaluate(`Element.prototype.setAttribute.call(${HOST}, 'placeholder', 'From outside')`);
    await expect(page.locator('combo-box [part="placeholder"]')).toHaveText('From outside');
  });

  test('query set natively updates the search field', async ({ mount, page }) => {
    await mount(`<combo-box aria-label="Fruit" searchable>${FRUITS}</combo-box>`);
    await inIsolatedWorld(page, `${HOST}.setAttribute('query', 'abc')`);
    expect(await page.locator('combo-box [part="search-input"]').inputValue()).toBe('abc');
  });

  test('typing in the search field keeps the caret position', async ({ mount, page }) => {
    await mount(`<combo-box aria-label="Fruit" filterable>${FRUITS}</combo-box>`);
    await page.locator('combo-box').focus();
    await expect.poll(() => inPage(page, `(el) => el.shadowRoot.activeElement?.getAttribute('part')`)).toBe('search-input');
    await page.keyboard.type('ace');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.type('p');
    expect(await page.locator('combo-box [part="search-input"]').inputValue()).toBe('apce');
  });

  test('the value attribute set natively selects options', async ({ mount, page }) => {
    await mount(`<combo-box aria-label="Fruit">${FRUITS}</combo-box>`);
    await page.evaluate(`Element.prototype.setAttribute.call(${HOST}, 'value', 'date')`);
    expect(await inPage(page, `(el) => el.value`)).toBe('date');
  });

  test('the value attribute set from another world selects options', async ({ mount, page }) => {
    await mount(`<combo-box aria-label="Fruit" multiple>${FRUITS}</combo-box>`);
    await inIsolatedWorld(page, `${HOST}.setAttribute('value', 'apple,cherry')`);
    expect(await inPage(page, `(el) => el.value`)).toBe('apple,cherry');
  });

  test('setAttribute("value") through the override still does not write the attribute', async ({ mount, page }) => {
    await mount(`<combo-box aria-label="Fruit">${FRUITS}</combo-box>`);
    expect(await inPage(page, `(el) => { el.setAttribute('value', 'banana'); return [el.value, el.getAttribute('value')]; }`)).toEqual(['banana', null]);
  });

  test('attributes set on a created, not yet connected combobox apply once connected', async ({ mount, page }) => {
    await mount('');
    const result = await page.evaluate(() => {
      const el = document.createElement('combo-box') as any;
      Element.prototype.setAttribute.call(el, 'multiple', '');
      Element.prototype.setAttribute.call(el, 'required', '');
      el.innerHTML = '<box-option value="a" selected>A</box-option><box-option value="b" selected>B</box-option>';
      document.body.append(el);
      return [el.multiple, el.value, el.checkValidity()];
    });
    expect(result).toEqual([true, 'a,b', true]);
  });
});
