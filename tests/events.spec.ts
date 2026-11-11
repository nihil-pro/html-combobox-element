import { test, expect, FRUITS, settle, type Page } from './fixtures';

/**
 * The event model:
 * - change: the user changed the selection. Once per user action, only when the value changed.
 * - input:  the user typed in the search field (the field's own InputEvent, composed).
 * - close:  the dropdown closed; `changed` tells whether the value differs from when it opened.
 * - nothing for changes made by script, like native form controls.
 */

const BASIC = (attrs = '', options = FRUITS) => `
  <label for="fruit">Fruit</label>
  <combo-box id="fruit" ${attrs} style="display:block;width:300px">${options}</combo-box>
  <button id="out">out</button>`;

async function record(page: Page) {
  await page.evaluate(() => {
    const log: string[] = [];
    (window as any).__events = log;
    const el = document.querySelector('combo-box') as any;
    for (const type of ['change', 'input', 'close', 'search', 'reset']) {
      el.addEventListener(type, () => log.push(type === 'change' ? `change:${el.value}` : type === 'close' ? `close:${el.changed}` : type));
    }
  });
}
const events = (page: Page): Promise<string[]> => page.evaluate(() => (window as any).__events);
const value = (page: Page) => page.locator('combo-box').evaluate((el: any) => el.value);

test.describe('change: once per user action', () => {
  test('click an option (single): one change', async ({ mount, page }) => {
    await mount(BASIC());
    await record(page);
    await page.locator('combo-box').click();
    await page.locator('combo-box box-option[value=banana]').click();
    expect((await events(page)).filter((e) => e.startsWith('change'))).toEqual(['change:banana']);
  });

  test('replacing the selection (single) is one change, not deselect + select', async ({ mount, page }) => {
    await mount(BASIC('value="apple"'));
    await record(page);
    await page.locator('combo-box').click();
    await page.locator('combo-box box-option[value=cherry]').click();
    expect((await events(page)).filter((e) => e.startsWith('change'))).toEqual(['change:cherry']);
  });

  test('the change listener never sees an intermediate empty value', async ({ mount, page }) => {
    await mount(BASIC('value="apple"'));
    await page.evaluate(() => {
      (window as any).__seen = [];
      const el = document.querySelector('combo-box') as any;
      el.addEventListener('change', () => (window as any).__seen.push(el.value));
    });
    await page.locator('combo-box').focus();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => (window as any).__seen)).toEqual(['date']);
  });

  test('Enter on an option (single): one change', async ({ mount, page }) => {
    await mount(BASIC('value="apple"'));
    await record(page);
    await page.locator('combo-box').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    expect((await events(page)).filter((e) => e.startsWith('change'))).toEqual(['change:banana']);
  });

  test('Space toggles (multiple): one change per toggle', async ({ mount, page }) => {
    await mount(BASIC('multiple'));
    await record(page);
    await page.locator('combo-box').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press(' ');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press(' ');
    await page.keyboard.press(' ');
    expect((await events(page)).filter((e) => e.startsWith('change'))).toEqual(['change:apple', 'change:apple,banana', 'change:apple']);
  });

  test('click options (multiple): one change per click', async ({ mount, page }) => {
    await mount(BASIC('multiple'));
    await record(page);
    await page.locator('combo-box').click();
    await page.locator('combo-box box-option[value=apple]').click();
    await page.locator('combo-box box-option[value=date]').click();
    expect((await events(page)).filter((e) => e.startsWith('change'))).toEqual(['change:apple', 'change:apple,date']);
  });

  test('a click on content inside an option selects it', async ({ mount, page }) => {
    await mount(BASIC('', `<box-option value="a"><b class="inner">Apple</b> <i>red</i></box-option><box-option value="b">B</box-option>`));
    await record(page);
    await page.locator('combo-box').click();
    await page.locator('combo-box .inner').click();
    expect(await value(page)).toBe('a');
    expect((await events(page)).filter((e) => e.startsWith('change'))).toEqual(['change:a']);
  });

  test('removing a tag: one change', async ({ mount, page }) => {
    await mount(BASIC('multiple value="apple,banana"'));
    await record(page);
    await page.getByRole('button', { name: 'Remove Apple' }).click();
    expect((await events(page)).filter((e) => e.startsWith('change'))).toEqual(['change:banana']);
  });

  test('removing a tag with the keyboard: one change', async ({ mount, page }) => {
    await mount(BASIC('clearable value="apple"'));
    await record(page);
    await page.locator('combo-box').focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    expect((await events(page)).filter((e) => e.startsWith('change'))).toEqual(['change:']);
  });

  test('clear-all with three values: one change, not three', async ({ mount, page }) => {
    await mount(BASIC('multiple value="apple,banana,cherry"'));
    await record(page);
    await page.getByRole('button', { name: 'Clear selection' }).click();
    expect((await events(page)).filter((e) => e.startsWith('change'))).toEqual(['change:']);
  });

  test('choosing the option that is already selected: no change', async ({ mount, page }) => {
    await mount(BASIC('value="banana"'));
    await record(page);
    await page.locator('combo-box').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    expect((await events(page)).filter((e) => e.startsWith('change'))).toEqual([]);
  });

  test('a disabled option: no change', async ({ mount, page }) => {
    await mount(BASIC('', `<box-option value="a" disabled>A</box-option>`));
    await record(page);
    await page.locator('combo-box box-option').evaluate((o: HTMLElement) => o.click());
    expect(await events(page)).toEqual([]);
  });

  test('change bubbles', async ({ mount, page }) => {
    await mount(`<div id="wrap">${BASIC()}</div>`);
    await page.evaluate(() => { (window as any).__bubbled = 0; document.getElementById('wrap')!.addEventListener('change', () => (window as any).__bubbled++); });
    await page.locator('combo-box').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => (window as any).__bubbled)).toBe(1);
  });
});

test.describe('no events for changes made by script', () => {
  const SCRIPT_CHANGES: Record<string, string> = {
    'value = "x"': `el.value = 'cherry'`,
    'value = undefined': `el.value = undefined`,
    'selectedIndex': `el.selectedIndex = 3`,
    'option.selected = true': `el.options[2].selected = true`,
    'option.selected = false': `el.options[0].selected = false`,
    'option.setAttribute("selected")': `el.options[2].setAttribute('selected', '')`,
    'native setAttribute on an option': `Element.prototype.setAttribute.call(el.options[2], 'selected', '')`,
    'option.toggleAttribute': `el.options[0].toggleAttribute('selected')`,
    'combobox.setAttribute("value")': `el.setAttribute('value', 'date')`,
    'options.add(selected option)': `(() => { const o = document.createElement('box-option'); o.value = 'z'; o.selected = true; el.options.add(o); })()`,
    'removing the selected option': `el.options[0].remove()`,
    'options.length = 0': `el.options.length = 0`,
    'remove(index) of the selected option': `el.remove(0)`,
    'form reset': `el.form.reset()`,
    'multiple = true': `el.multiple = true`,
  };
  for (const [name, code] of Object.entries(SCRIPT_CHANGES)) {
    test(name, async ({ mount, page }) => {
      await mount(`<form>${BASIC('value="apple"')}</form>`);
      await record(page);
      const before = await value(page);
      await page.locator('combo-box').evaluate((el: any, c: string) => (0, eval)(`(el) => { ${c} }`)(el), code);
      await settle(page);
      expect((await events(page)).filter((e) => e.startsWith('change') || e === 'input')).toEqual([]);
      // the change itself did happen (except for the no-op cases)
      if (!['multiple = true'].includes(name)) expect(await value(page)).not.toBe(before);
    });
  }

  test('options in the initial markup: no change', async ({ mount, page }) => {
    await mount('');
    const log = await page.evaluate(async () => {
      const seen: string[] = [];
      const el = document.createElement('combo-box');
      el.addEventListener('change', () => seen.push('change'));
      el.innerHTML = '<box-option value="a" selected>A</box-option>';
      document.body.append(el);
      await new Promise((r) => setTimeout(r, 20));
      return seen;
    });
    expect(log).toEqual([]);
  });

  test('a framework-style controlled loop settles: onChange → set value → no new change', async ({ mount, page }) => {
    await mount(BASIC());
    const count = await page.evaluate(async () => {
      const el = document.querySelector('combo-box') as any;
      let changes = 0;
      // a "controlled" handler that writes a transformed value back (would loop if setting fired change)
      el.addEventListener('change', () => { changes++; if (changes < 10) el.value = el.value; el.value = 'date'; });
      el.focus();
      return new Promise((resolve) => setTimeout(() => resolve(changes), 50));
    });
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(50);
    expect(await page.evaluate(() => (document.querySelector('combo-box') as any).value)).toBe('date');
    expect(count).toBe(0);
  });
});

test.describe('input: the user typed in the search field', () => {
  test('one input per keystroke, no change', async ({ mount, page }) => {
    await mount(BASIC('filterable'));
    await record(page);
    await page.locator('combo-box').focus();
    await expect.poll(() => page.evaluate(() => (document.querySelector('combo-box')!.shadowRoot!.activeElement as any)?.getAttribute('part'))).toBe('search-input');
    await page.keyboard.type('ban');
    expect(await events(page)).toEqual(['input', 'input', 'input']);
  });

  test('it is the field\'s InputEvent: query holds the text, target.value the selection', async ({ mount, page }) => {
    await mount(BASIC('filterable value="apple"'));
    await page.evaluate(() => {
      const el = document.querySelector('combo-box') as any;
      el.addEventListener('input', (e: any) => (window as any).__input = {
        isInputEvent: e instanceof InputEvent, data: e.data, query: el.query, targetValue: e.target.value, fieldValue: e.composedPath()[0].value,
      });
    });
    await page.locator('combo-box').focus();
    await expect.poll(() => page.evaluate(() => (document.querySelector('combo-box')!.shadowRoot!.activeElement as any)?.getAttribute('part'))).toBe('search-input');
    await page.keyboard.type('b');
    expect(await page.evaluate(() => (window as any).__input)).toEqual({ isInputEvent: true, data: 'b', query: 'b', targetValue: 'apple', fieldValue: 'b' });
  });

  test('selecting after typing: inputs, then one change', async ({ mount, page }) => {
    await mount(BASIC('filterable'));
    await record(page);
    await page.locator('combo-box').focus();
    await expect.poll(() => page.evaluate(() => (document.querySelector('combo-box')!.shadowRoot!.activeElement as any)?.getAttribute('part'))).toBe('search-input');
    await page.keyboard.type('ch');
    await expect(page.locator('combo-box box-option:visible')).toHaveText(['Cherry']);  // filtering is debounced
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    expect((await events(page)).filter((e) => !e.startsWith('close'))).toEqual(['input', 'input', 'change:cherry']);
  });

  test('setting query by script: no input event', async ({ mount, page }) => {
    await mount(BASIC('searchable'));
    await record(page);
    await page.locator('combo-box').evaluate((el: any) => el.query = 'abc');
    expect(await events(page)).toEqual([]);
  });
});

test.describe('close and changed', () => {
  test('close reports changed=true after a selection during the session', async ({ mount, page }) => {
    await mount(BASIC('multiple'));
    await record(page);
    await page.locator('combo-box').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press(' ');
    await page.keyboard.press('Escape');
    await expect.poll(() => events(page)).toEqual(['change:apple', 'close:true']);
  });

  test('close reports changed=false when nothing changed', async ({ mount, page }) => {
    await mount(BASIC());
    await record(page);
    await page.locator('combo-box').focus();
    await page.keyboard.press('Escape');
    await expect.poll(() => events(page)).toEqual(['close:false']);
  });

  test('close reports changed=false after toggling an option on and off again', async ({ mount, page }) => {
    await mount(BASIC('multiple'));
    await record(page);
    await page.locator('combo-box').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press(' ');
    await page.keyboard.press(' ');
    await page.keyboard.press('Escape');
    await expect.poll(() => events(page)).toEqual(['change:apple', 'change:', 'close:false']);
  });

  test('single selection: change then close', async ({ mount, page }) => {
    await mount(BASIC());
    await record(page);
    await page.locator('combo-box').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect.poll(() => events(page)).toEqual(['change:apple', 'close:true']);
  });
});
