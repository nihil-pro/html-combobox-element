import { test, expect, FRUITS, settle, trackChanges, changes, isOpen } from './fixtures';

const combo = (page: any) => page.locator('combo-box').first();
const evalCombo = <T>(page: any, fn: (el: any) => T) => combo(page).evaluate(fn);

test.describe('initial state from markup', () => {
  test('an option with the selected attribute becomes the value', async ({ mount, page }) => {
    await mount(`<combo-box><box-option value="a">A</box-option><box-option value="b" selected>B</box-option></combo-box>`);
    expect(await evalCombo(page, (el) => el.value)).toBe('b');
  });

  test('the selected option is shown as a tag', async ({ mount, page }) => {
    await mount(`<combo-box><box-option value="b" selected>Banana</box-option></combo-box>`);
    await expect(page.locator('combo-box box-tag')).toHaveCount(1);
    await expect(page.locator('combo-box [part="tag-label"]')).toHaveText('Banana');
  });

  test('the value attribute selects options', async ({ mount, page }) => {
    await mount(`<combo-box value="cherry">${FRUITS}</combo-box>`);
    expect(await evalCombo(page, (el) => el.value)).toBe('cherry');
  });

  test('the value attribute selects several options in multiple mode', async ({ mount, page }) => {
    await mount(`<combo-box multiple value="apple,date">${FRUITS}</combo-box>`);
    expect(await evalCombo(page, (el) => el.valueAsArray)).toEqual(['apple', 'date']);
  });

  test('several selected options in single mode keep only the last one', async ({ mount, page }) => {
    await mount(`<combo-box><box-option value="a" selected>A</box-option><box-option value="b" selected>B</box-option></combo-box>`);
    expect(await evalCombo(page, (el) => el.value)).toBe('b');
    await expect(page.locator('combo-box box-option[selected]')).toHaveCount(1);
  });

  test('no change event is dispatched for the initial selection', async ({ mount, page }) => {
    await mount('');
    const events = await page.evaluate(async () => {
      const log: string[] = [];
      const host = document.createElement('combo-box');
      host.innerHTML = '<box-option value="a" selected>A</box-option><box-option value="b">B</box-option>';
      host.addEventListener('change', () => log.push('change'));
      document.body.append(host);
      await new Promise((r) => setTimeout(r, 20));
      return log;
    });
    expect(events).toEqual([]);
  });

  test('options are moved into the shadow listbox', async ({ mount, page }) => {
    await mount(`<combo-box>${FRUITS}</combo-box>`);
    expect(await evalCombo(page, (el) => el.children.length)).toBe(0);
    expect(await evalCombo(page, (el) => el.shadowRoot.querySelectorAll('[role=listbox] > box-option').length)).toBe(4);
  });

  test('a combobox created with innerHTML gets its options', async ({ mount, page }) => {
    await mount('<div id="root"></div>');
    await page.evaluate(() => {
      document.getElementById('root')!.innerHTML = '<combo-box aria-label="x"><box-option value="a" selected>Apple</box-option><box-option value="b">B</box-option></combo-box>';
    });
    await settle(page);
    expect(await evalCombo(page, (el) => [el.value, el.length])).toEqual(['a', 2]);
  });

  test('placeholder attribute is displayed when empty', async ({ mount, page }) => {
    await mount(`<combo-box placeholder="Pick one">${FRUITS}</combo-box>`);
    await expect(page.locator('combo-box [part="placeholder"]')).toHaveText('Pick one');
  });

  test('default placeholder is shown when none is given', async ({ mount, page }) => {
    await mount(`<combo-box>${FRUITS}</combo-box>`);
    await expect(page.locator('combo-box [part="placeholder"]')).toBeVisible();
  });

  test('the placeholder is hidden once a value is selected', async ({ mount, page }) => {
    await mount(`<combo-box placeholder="Pick one" value="apple">${FRUITS}</combo-box>`);
    await expect(page.locator('combo-box [part="placeholder"]')).toBeHidden();
  });
});

test.describe('HTMLSelectElement-like API', () => {
  test('type is select-one / select-multiple', async ({ mount, page }) => {
    await mount(`<combo-box id="a">${FRUITS}</combo-box><combo-box id="b" multiple>${FRUITS}</combo-box>`);
    expect(await page.evaluate(() => [(document.getElementById('a') as any).type, (document.getElementById('b') as any).type]))
      .toEqual(['select-one', 'select-multiple']);
  });

  test('length counts the options', async ({ mount, page }) => {
    await mount(`<combo-box>${FRUITS}</combo-box>`);
    expect(await evalCombo(page, (el) => el.length)).toBe(4);
  });

  test('item(index) returns options', async ({ mount, page }) => {
    await mount(`<combo-box>${FRUITS}</combo-box>`);
    expect(await evalCombo(page, (el) => [el.item(0).value, el.item(3).value, el.item(9)])).toEqual(['apple', 'date', null]);
  });

  test('selectedOptions lists the selected options', async ({ mount, page }) => {
    await mount(`<combo-box multiple value="banana,date">${FRUITS}</combo-box>`);
    expect(await evalCombo(page, (el) => Array.from(el.selectedOptions, (o: any) => o.value))).toEqual(['banana', 'date']);
  });

  test('value setter selects and deselects', async ({ mount, page }) => {
    await mount(`<combo-box multiple>${FRUITS}</combo-box>`);
    await evalCombo(page, (el) => el.value = 'apple,cherry');
    expect(await evalCombo(page, (el) => el.value)).toBe('apple,cherry');
    await evalCombo(page, (el) => el.value = 'cherry');
    expect(await evalCombo(page, (el) => el.value)).toBe('cherry');
  });

  test('value setter with an unknown value selects nothing', async ({ mount, page }) => {
    await mount(`<combo-box value="apple">${FRUITS}</combo-box>`);
    await evalCombo(page, (el) => el.value = 'nope');
    expect(await evalCombo(page, (el) => el.value)).toBe('');
  });

  test('value setter converts numbers to strings, like select.value', async ({ mount, page }) => {
    await mount(`<combo-box value="apple"><box-option value="42">Answer</box-option><box-option value="apple">Apple</box-option></combo-box>`);
    await evalCombo(page, (el) => el.value = 42);
    expect(await evalCombo(page, (el) => [el.value, el.selectedIndex])).toEqual(['42', 0]);
  });

  test('setting value programmatically dispatches no change event, like select.value', async ({ mount, page }) => {
    await mount(`<combo-box>${FRUITS}</combo-box>`);
    await trackChanges(page);
    await evalCombo(page, (el) => el.value = 'date');
    expect(await changes(page)).toEqual([]);
  });

  test('setAttribute("value") goes through the value setter', async ({ mount, page }) => {
    await mount(`<combo-box>${FRUITS}</combo-box>`);
    await evalCombo(page, (el) => el.setAttribute('value', 'banana'));
    expect(await evalCombo(page, (el) => el.value)).toBe('banana');
  });

  test('option.selected = true updates the combobox value', async ({ mount, page }) => {
    await mount(`<combo-box>${FRUITS}</combo-box>`);
    await page.locator('combo-box box-option[value=date]').evaluate((o: any) => o.selected = true);
    expect(await evalCombo(page, (el) => el.value)).toBe('date');
  });

  test('option.setAttribute("selected") updates the combobox value', async ({ mount, page }) => {
    await mount(`<combo-box>${FRUITS}</combo-box>`);
    await page.locator('combo-box box-option[value=date]').evaluate((o: any) => o.setAttribute('selected', ''));
    expect(await evalCombo(page, (el) => el.value)).toBe('date');
  });

  test('option.removeAttribute("selected") deselects', async ({ mount, page }) => {
    await mount(`<combo-box value="date">${FRUITS}</combo-box>`);
    await page.locator('combo-box box-option[value=date]').evaluate((o: any) => o.removeAttribute('selected'));
    expect(await evalCombo(page, (el) => el.value)).toBe('');
  });

  test('option selected part is kept in sync', async ({ mount, page }) => {
    await mount(`<combo-box value="date">${FRUITS}</combo-box>`);
    await expect(page.locator('combo-box box-option[value=date]')).toHaveAttribute('part', /\bselected\b/);
    await evalCombo(page, (el) => el.value = 'apple');
    await expect(page.locator('combo-box box-option[value=date]')).not.toHaveAttribute('part', /\bselected\b/);
  });

  test('option disabled part is kept in sync', async ({ mount, page }) => {
    await mount(`<combo-box>${FRUITS}</combo-box>`);
    const opt = page.locator('combo-box box-option[value=date]');
    await opt.evaluate((o: any) => o.disabled = true);
    await expect(opt).toHaveAttribute('part', /\bdisabled\b/);
    await opt.evaluate((o: any) => o.disabled = false);
    await expect(opt).not.toHaveAttribute('part', /\bdisabled\b/);
  });

  test('showPicker() and hidePicker() open and close the dropdown', async ({ mount, page }) => {
    await mount(`<combo-box>${FRUITS}</combo-box>`);
    await evalCombo(page, (el) => el.showPicker());
    expect(await isOpen(page)).toBe(true);
    await evalCombo(page, (el) => el.hidePicker());
    expect(await isOpen(page)).toBe(false);
  });

  test('showPicker() does nothing on a disabled combobox', async ({ mount, page }) => {
    await mount(`<combo-box disabled>${FRUITS}</combo-box>`);
    await evalCombo(page, (el) => el.showPicker());
    expect(await isOpen(page)).toBe(false);
  });

  test('disabling an open combobox closes it', async ({ mount, page }) => {
    await mount(`<combo-box>${FRUITS}</combo-box>`);
    await combo(page).focus();
    await evalCombo(page, (el) => el.disabled = true);
    expect(await isOpen(page)).toBe(false);
  });

  test('boolean properties reflect to attributes', async ({ mount, page }) => {
    await mount(`<combo-box>${FRUITS}</combo-box>`);
    const result = await evalCombo(page, (el) => {
      const names = ['multiple', 'required', 'disabled', 'clearable', 'filterable', 'searchable'];
      return names.map((name) => {
        el[name] = true;
        const on = el.hasAttribute(name) && el[name] === true;
        el[name] = false;
        const off = !el.hasAttribute(name) && el[name] === false;
        return [name, on, off];
      });
    });
    for (const [name, on, off] of result) {
      expect([name, on, off]).toEqual([name, true, true]);
    }
  });

  test('removeAttribute of own attributes resets the property', async ({ mount, page }) => {
    await mount(`<combo-box multiple required>${FRUITS}</combo-box>`);
    await evalCombo(page, (el) => { el.removeAttribute('multiple'); el.removeAttribute('required'); });
    expect(await evalCombo(page, (el) => [el.multiple, el.required])).toEqual([false, false]);
  });

  test('"false" attribute strings are treated as false', async ({ mount, page }) => {
    await mount(`<combo-box multiple="false" disabled="false">${FRUITS}</combo-box>`);
    expect(await evalCombo(page, (el) => [el.multiple, el.disabled])).toEqual([false, false]);
  });

  test('placeholder property updates the displayed placeholder', async ({ mount, page }) => {
    await mount(`<combo-box>${FRUITS}</combo-box>`);
    await evalCombo(page, (el) => el.placeholder = 'Choose wisely');
    await expect(page.locator('combo-box [part="placeholder"]')).toHaveText('Choose wisely');
  });

  test('query property sets the search field value', async ({ mount, page }) => {
    await mount(`<combo-box searchable>${FRUITS}</combo-box>`);
    await evalCombo(page, (el) => el.query = 'abc');
    expect(await page.locator('combo-box [part="search-input"]').inputValue()).toBe('abc');
  });

  test('labels returns the associated labels', async ({ mount, page }) => {
    await mount(`<label for="c">One</label><label>Two <combo-box id="c">${FRUITS}</combo-box></label>`);
    expect(await evalCombo(page, (el) => Array.from(el.labels, (l: any) => l.textContent.trim().split(' ')[0]))).toEqual(['One', 'Two']);
  });

  test('strings are exposed as a static property', async ({ mount, page }) => {
    await mount('');
    expect(await page.evaluate(() => ({ ...(customElements.get('combo-box') as any).strings })))
      .toEqual({ clearAll: 'Clear selection', removeTag: 'Remove' });
  });
});

test.describe('forms', () => {
  const FORM = (attrs = '') => `
    <form>
      <combo-box name="fruit" ${attrs}>${FRUITS}</combo-box>
      <button type="reset">reset</button>
    </form>`;

  test('form property returns the owner form', async ({ mount, page }) => {
    await mount(FORM());
    expect(await evalCombo(page, (el) => el.form === document.querySelector('form'))).toBe(true);
  });

  test('the value is submitted with the form', async ({ mount, page }) => {
    await mount(FORM('value="banana"'));
    expect(await page.evaluate(() => new FormData(document.querySelector('form')!).get('fruit'))).toBe('banana');
  });

  test('multiple values are submitted comma-separated', async ({ mount, page }) => {
    await mount(FORM('multiple value="apple,cherry"'));
    expect(await page.evaluate(() => new FormData(document.querySelector('form')!).get('fruit'))).toBe('apple,cherry');
  });

  test('the submitted value follows user selection', async ({ mount, page }) => {
    await mount(FORM());
    await combo(page).focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => new FormData(document.querySelector('form')!).get('fruit'))).toBe('apple');
  });

  test('required + empty is invalid (valueMissing)', async ({ mount, page }) => {
    await mount(FORM('required'));
    expect(await evalCombo(page, (el) => [el.validity.valueMissing, el.checkValidity()])).toEqual([true, false]);
  });

  test('required + selected is valid', async ({ mount, page }) => {
    await mount(FORM('required value="apple"'));
    expect(await evalCombo(page, (el) => [el.validity.valid, el.checkValidity()])).toEqual([true, true]);
  });

  test('setting required at runtime updates validity', async ({ mount, page }) => {
    await mount(FORM());
    expect(await evalCombo(page, (el) => el.checkValidity())).toBe(true);
    await evalCombo(page, (el) => el.required = true);
    expect(await evalCombo(page, (el) => el.checkValidity())).toBe(false);
    await evalCombo(page, (el) => el.required = false);
    expect(await evalCombo(page, (el) => el.checkValidity())).toBe(true);
  });

  test('a required empty combobox blocks form.checkValidity()', async ({ mount, page }) => {
    await mount(FORM('required'));
    expect(await page.evaluate(() => document.querySelector('form')!.checkValidity())).toBe(false);
  });

  test('reportValidity() returns a boolean', async ({ mount, page }) => {
    await mount(FORM('required value="apple"'));
    expect(await evalCombo(page, (el) => el.reportValidity())).toBe(true);
  });

  test('setCustomValidity sets and clears a custom error', async ({ mount, page }) => {
    await mount(FORM());
    await evalCombo(page, (el) => el.setCustomValidity('Nope'));
    expect(await evalCombo(page, (el) => [el.validity.customError, el.validationMessage])).toEqual([true, 'Nope']);
    await evalCombo(page, (el) => el.setCustomValidity(''));
    expect(await evalCombo(page, (el) => el.validity.valid)).toBe(true);
  });

  test('willValidate is true', async ({ mount, page }) => {
    await mount(FORM());
    expect(await evalCombo(page, (el) => el.willValidate)).toBe(true);
  });

  test('form reset clears the selection, tags and value text', async ({ mount, page }) => {
    await mount(FORM('multiple value="apple,banana"'));
    await page.locator('button[type=reset]').click();
    expect(await evalCombo(page, (el) => el.value)).toBe('');
    await expect(page.locator('combo-box box-tag')).toHaveCount(0);
    await expect(page.locator('combo-box [part="value"]')).toHaveText('');
  });

  test('form reset dispatches a reset event', async ({ mount, page }) => {
    await mount(FORM('value="apple"'));
    await page.evaluate(() => { (window as any).__reset = 0; document.querySelector('combo-box')!.addEventListener('reset', () => (window as any).__reset++); });
    await page.locator('button[type=reset]').click();
    expect(await page.evaluate(() => (window as any).__reset)).toBe(1);
  });

  test('form reset makes a required combobox invalid again', async ({ mount, page }) => {
    await mount(FORM('required value="apple"'));
    await page.locator('button[type=reset]').click();
    expect(await evalCombo(page, (el) => el.checkValidity())).toBe(false);
  });

  test('form reset does not move focus', async ({ mount, page }) => {
    await mount(FORM('value="apple"'));
    await page.locator('button[type=reset]').focus();
    await page.locator('button[type=reset]').press('Enter');
    await settle(page);
    await expect(page.locator('button[type=reset]')).toBeFocused();
  });

  test('a disabled combobox is not submitted', async ({ mount, page }) => {
    await mount(FORM('disabled value="apple"'));
    expect(await page.evaluate(() => new FormData(document.querySelector('form')!).has('fruit'))).toBe(false);
  });
});

test.describe('dynamic options (framework renderers)', () => {
  test('appendChild adds an option into the listbox', async ({ mount, page }) => {
    await mount(`<combo-box>${FRUITS}</combo-box>`);
    await evalCombo(page, (el) => {
      const o = document.createElement('box-option') as any; o.value = 'fig'; o.textContent = 'Fig'; el.appendChild(o);
    });
    expect(await evalCombo(page, (el) => [el.length, el.item(4).value])).toEqual([5, 'fig']);
  });

  test('insertBefore with a null reference appends (Vue/Preact)', async ({ mount, page }) => {
    await mount(`<combo-box>${FRUITS}</combo-box>`);
    await evalCombo(page, (el) => {
      const o = document.createElement('box-option') as any; o.value = 'fig'; el.insertBefore(o, null);
    });
    expect(await evalCombo(page, (el) => el.item(4).value)).toBe('fig');
  });

  test('insertBefore an existing option reorders', async ({ mount, page }) => {
    await mount(`<combo-box>${FRUITS}</combo-box>`);
    await evalCombo(page, (el) => {
      const o = document.createElement('box-option') as any; o.value = 'fig'; el.insertBefore(o, el.item(0));
    });
    expect(await evalCombo(page, (el) => el.item(0).value)).toBe('fig');
  });

  test('append() and prepend() route options and strings', async ({ mount, page }) => {
    await mount(`<combo-box>${FRUITS}</combo-box>`);
    await evalCombo(page, (el) => {
      const a = document.createElement('box-option') as any; a.value = 'z';
      const b = document.createElement('box-option') as any; b.value = 'y';
      el.append(a);
      el.prepend(b);
    });
    expect(await evalCombo(page, (el) => [el.item(0).value, el.item(5).value])).toEqual(['y', 'z']);
  });

  test('replaceChildren replaces all options', async ({ mount, page }) => {
    await mount(`<combo-box>${FRUITS}</combo-box>`);
    await evalCombo(page, (el) => {
      const o = document.createElement('box-option') as any; o.value = 'only';
      el.replaceChildren(o);
    });
    expect(await evalCombo(page, (el) => [el.length, el.item(0).value])).toEqual([1, 'only']);
  });

  test('removeChild removes an option', async ({ mount, page }) => {
    await mount(`<combo-box>${FRUITS}</combo-box>`);
    await evalCombo(page, (el) => el.removeChild(el.item(0)));
    expect(await evalCombo(page, (el) => el.length)).toBe(3);
  });

  test('removing the selected option clears the value', async ({ mount, page }) => {
    await mount(`<combo-box value="apple">${FRUITS}</combo-box>`);
    await evalCombo(page, (el) => el.removeChild(el.item(0)));
    await settle(page);
    expect(await evalCombo(page, (el) => el.value)).toBe('');
    await expect(page.locator('combo-box box-tag')).toHaveCount(0);
    await expect(page.locator('combo-box [part="value"]')).toHaveText('');
  });

  test('replaceChild swaps an option', async ({ mount, page }) => {
    await mount(`<combo-box>${FRUITS}</combo-box>`);
    await evalCombo(page, (el) => {
      const o = document.createElement('box-option') as any; o.value = 'new';
      el.replaceChild(o, el.item(1));
    });
    expect(await evalCombo(page, (el) => el.item(1).value)).toBe('new');
  });

  test('appending a selected option selects it', async ({ mount, page }) => {
    await mount(`<combo-box>${FRUITS}</combo-box>`);
    await evalCombo(page, (el) => {
      const o = document.createElement('box-option') as any; o.value = 'fig'; o.textContent = 'Fig'; o.selected = true; el.appendChild(o);
    });
    expect(await evalCombo(page, (el) => el.value)).toBe('fig');
    await expect(page.locator('combo-box [part="value"]')).toHaveText('Fig');
  });

  test('non-option children stay in the light DOM', async ({ mount, page }) => {
    await mount(`<combo-box>${FRUITS}</combo-box>`);
    await evalCombo(page, (el) => el.appendChild(document.createElement('span')));
    expect(await evalCombo(page, (el) => el.children.length)).toBe(1);
  });

  test('changing an option label updates the value text after reselection', async ({ mount, page }) => {
    await mount(`<combo-box>${FRUITS}</combo-box>`);
    await page.locator('combo-box box-option[value=apple]').evaluate((o: any) => { o.label = 'Red apple'; o.selected = true; });
    await expect(page.locator('combo-box [part="value"]')).toHaveText('Red apple');
  });

  test('option values with quotes and special characters work', async ({ mount, page }) => {
    await mount(`<combo-box multiple><box-option value='a"b'>Quote</box-option><box-option value="x]y">Bracket</box-option></combo-box>`);
    await evalCombo(page, (el) => { el.item(0).selected = true; el.item(1).selected = true; });
    expect(await evalCombo(page, (el) => el.valueAsArray)).toEqual(['a"b', 'x]y']);
    await page.locator('combo-box [aria-label="Remove Quote"]').click();
    expect(await evalCombo(page, (el) => el.valueAsArray)).toEqual(['x]y']);
  });
});

test.describe('connection lifecycle', () => {
  test('a combobox moved in the DOM keeps working', async ({ mount, page }) => {
    await mount(`<div id="a"><combo-box aria-label="x">${FRUITS}</combo-box></div><div id="b"></div><p id="out">out</p>`);
    await page.evaluate(() => document.getElementById('b')!.append(document.querySelector('combo-box')!));
    await combo(page).focus();
    expect(await isOpen(page)).toBe(true);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    expect(await evalCombo(page, (el) => el.value)).toBe('apple');
    await combo(page).focus();
    await page.locator('#out').click();
    await expect.poll(() => isOpen(page)).toBe(false);
  });

  test('a detached combobox no longer listens to outside clicks', async ({ mount, page }) => {
    await mount(`<combo-box aria-label="x">${FRUITS}</combo-box><p id="out">out</p>`);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.evaluate(() => document.querySelector('combo-box')!.remove());
    await page.locator('#out').click();
    expect(errors).toEqual([]);
  });

  test('a custom tag template in the light DOM does not throw', async ({ mount, page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await mount(`<combo-box multiple aria-label="x"><box-tag><button part="clear-tag">x</button></box-tag>${FRUITS}</combo-box>`);
    expect(errors).toEqual([]);
  });

  test('no console errors while using the component', async ({ mount, page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await mount(`<combo-box multiple filterable clearable required aria-label="x">${FRUITS}</combo-box>`);
    await combo(page).focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    expect(errors).toEqual([]);
  });
});
