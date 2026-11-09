import { test, expect, settle, trackChanges, changes } from './fixtures';

/**
 * `combobox.options` is checked against the real thing: every scenario runs the same operations
 * on a native <select> and on a <combo-box> with the same options, and compares the results.
 */

const SAME_OPTIONS = {
  native: `<option id="o1" value="a">A</option><optgroup label="G"><option value="b" name="bee">B</option></optgroup><option value="c">C</option>`,
  custom: `<box-option id="o1" value="a">A</box-option><optgroup label="G"><box-option value="b" name="bee">B</box-option></optgroup><box-option value="c">C</box-option>`,
};

const PAGE = (attrs = '') => `
  <select id="native" ${attrs}>${SAME_OPTIONS.native}</select>
  <combo-box id="custom" aria-label="custom" ${attrs}>${SAME_OPTIONS.custom}</combo-box>`;

type Scenario = (el: any, make: (text: string, value: string) => HTMLElement) => unknown;

/** Run `scenario` on both elements; return [native result, custom result]. */
async function both(page: any, scenario: Scenario) {
  return page.evaluate(async (source: string) => {
    const run = new Function('el', 'make', `return (${source})(el, make)`);
    const native = document.getElementById('native') as HTMLSelectElement;
    const custom = document.getElementById('custom') as any;
    const nativeResult = run(native, (text: string, value: string) => new Option(text, value));
    const customResult = run(custom, (text: string, value: string) => {
      const option = document.createElement('box-option') as any;
      option.value = value;
      option.textContent = text;
      return option;
    });
    await new Promise((r) => setTimeout(r, 10));
    return [nativeResult, customResult];
  }, scenario.toString());
}

/** Values of the options in order, blanks as "_", and the option's parent element. */
const LIST = `(el) => Array.from(el.options, (o) => (o.value || '_') + (o.parentNode.localName === 'optgroup' ? '@G' : '')).join(',')`;

async function expectSame(page: any, scenario: Scenario) {
  const [native, custom] = await both(page, scenario);
  expect(custom).toEqual(native);
  return custom;
}

async function expectSameList(page: any, scenario: Scenario) {
  await both(page, scenario);
  const [native, custom] = await both(page, eval(LIST));
  expect(custom).toEqual(native);
  return custom;
}

test.describe('combobox.options mirrors select.options', () => {
  test('lists the options in tree order, optgroups included', async ({ mount, page }) => {
    await mount(PAGE());
    expect(await expectSame(page, eval(LIST))).toBe('a,b@G,c');
  });

  test('length', async ({ mount, page }) => {
    await mount(PAGE());
    expect(await expectSame(page, (el) => el.options.length)).toBe(3);
  });

  test('indexed access, in and out of range', async ({ mount, page }) => {
    await mount(PAGE());
    await expectSame(page, (el) => [el.options[0].value, el.options[2].value, String(el.options[3]), String(el.options[99])]);
  });

  test('item(), in and out of range', async ({ mount, page }) => {
    await mount(PAGE());
    await expectSame(page, (el) => [el.options.item(1).value, el.options.item(9), el.options.item(-1)]);
  });

  test('namedItem() by id and by name, and named properties', async ({ mount, page }) => {
    await mount(PAGE());
    await expectSame(page, (el) => [
      el.options.namedItem('o1')?.value, el.options.namedItem('bee')?.value, el.options.namedItem('nope'),
      el.options.o1?.value, el.options['bee']?.value, el.options.namedItem(''),
    ]);
  });

  test('the in operator', async ({ mount, page }) => {
    await mount(PAGE());
    await expectSame(page, (el) => ['0' in el.options, '2' in el.options, '3' in el.options, 'o1' in el.options, 'zzz' in el.options, 'item' in el.options]);
  });

  test('Object.keys lists indices then names', async ({ mount, page }) => {
    await mount(PAGE());
    await expectSame(page, (el) => Object.keys(el.options));
  });

  test('iteration with for...of, Array.from and spread', async ({ mount, page }) => {
    await mount(PAGE());
    await expectSame(page, (el) => {
      const forOf: string[] = [];
      for (const o of el.options) forOf.push(o.value);
      return [forOf, Array.from(el.options, (o: any) => o.value), [...el.options].length];
    });
  });

  test('toString tag', async ({ mount, page }) => {
    await mount(PAGE());
    await expectSame(page, (el) => Object.prototype.toString.call(el.options));
  });

  test('is live: reflects options added later', async ({ mount, page }) => {
    await mount(PAGE());
    await expectSame(page, (el, make) => {
      const options = el.options;
      const before = options.length;
      el.appendChild(make('D', 'd'));
      return [before, options.length, options[3].value];
    });
  });

  test('the same collection object is returned every time', async ({ mount, page }) => {
    await mount(PAGE());
    await expectSame(page, (el) => el.options === el.options);
  });

  test('indexed properties cannot be deleted', async ({ mount, page }) => {
    await mount(PAGE());
    await expectSame(page, (el) => [Reflect.deleteProperty(el.options, '0'), el.options.length]);
  });
});

test.describe('changing the list through options', () => {
  test('setting length higher appends blank options', async ({ mount, page }) => {
    await mount(PAGE());
    expect(await expectSameList(page, (el) => { el.options.length = 5; })).toBe('a,b@G,c,_,_');
  });

  test('setting length lower removes the last options (also inside optgroups)', async ({ mount, page }) => {
    await mount(PAGE());
    expect(await expectSameList(page, (el) => { el.options.length = 1; })).toBe('a');
  });

  test('setting length to 0 empties the list', async ({ mount, page }) => {
    await mount(PAGE());
    expect(await expectSameList(page, (el) => { el.options.length = 0; })).toBe('');
  });

  test('select.length setter works the same way', async ({ mount, page }) => {
    await mount(PAGE());
    await expectSameList(page, (el) => { el.length = 4; });
    await expectSame(page, (el) => el.length);
  });

  test('options[length] = option appends', async ({ mount, page }) => {
    await mount(PAGE());
    expect(await expectSameList(page, (el, make) => { el.options[3] = make('D', 'd'); })).toBe('a,b@G,c,d');
  });

  test('options[i] past the end pads with blank options', async ({ mount, page }) => {
    await mount(PAGE());
    expect(await expectSameList(page, (el, make) => { el.options[5] = make('N', 'n'); })).toBe('a,b@G,c,_,_,n');
  });

  test('options[i] = option replaces the option at i (top level)', async ({ mount, page }) => {
    await mount(`<select id="native"><option value="a">A</option><option value="b">B</option></select>
      <combo-box id="custom"><box-option value="a">A</box-option><box-option value="b">B</box-option></combo-box>`);
    expect(await expectSameList(page, (el, make) => { el.options[0] = make('R', 'r'); })).toBe('r,b');
  });

  // Chrome's native collection diverges from the spec in these two, so they're checked against the spec:
  // "replace the indexth element in the collection by value".
  test('options[i] = option replaces in place when the next option is in an optgroup (Chrome throws)', async ({ mount, page }) => {
    await mount(PAGE());
    const list = await page.locator('#custom').evaluate((el: any) => {
      const option = document.createElement('box-option') as any;
      option.value = 'r';
      el.options[0] = option;
      return Array.from(el.options, (o: any) => o.value + (o.parentNode.localName === 'optgroup' ? '@G' : '')).join(',');
    });
    expect(list).toBe('r,b@G,c');
  });

  test('options[i] = option replaces an option inside an optgroup in place (Chrome moves it out)', async ({ mount, page }) => {
    await mount(PAGE());
    const list = await page.locator('#custom').evaluate((el: any) => {
      const option = document.createElement('box-option') as any;
      option.value = 'r';
      el.options[1] = option;
      return Array.from(el.options, (o: any) => o.value + (o.parentNode.localName === 'optgroup' ? '@G' : '')).join(',');
    });
    expect(list).toBe('a,r@G,c');
  });

  test('options[i] = the option already at i does nothing', async ({ mount, page }) => {
    await mount(PAGE());
    expect(await expectSameList(page, (el) => { el.options[2] = el.options[2]; })).toBe('a,b@G,c');
  });

  test('options[i] = null removes the option at i', async ({ mount, page }) => {
    await mount(PAGE());
    expect(await expectSameList(page, (el) => { el.options[0] = null; })).toBe('b@G,c');
  });

  test('options[i] = something else throws a TypeError', async ({ mount, page }) => {
    await mount(PAGE());
    await expectSame(page, (el) => { try { el.options[0] = document.createElement('div'); return 'no error'; } catch (e: any) { return e.name; } });
  });

  test('add(option) appends', async ({ mount, page }) => {
    await mount(PAGE());
    expect(await expectSameList(page, (el, make) => { el.options.add(make('D', 'd')); })).toBe('a,b@G,c,d');
  });

  test('add(option, index) inserts before that index', async ({ mount, page }) => {
    await mount(PAGE());
    expect(await expectSameList(page, (el, make) => { el.options.add(make('F', 'f'), 0); })).toBe('f,a,b@G,c');
  });

  test('add(option, index) before an option inside an optgroup inserts into the optgroup', async ({ mount, page }) => {
    await mount(PAGE());
    expect(await expectSameList(page, (el, make) => { el.options.add(make('F', 'f'), 1); })).toBe('a,f@G,b@G,c');
  });

  test('add(option, outOfRangeIndex) appends', async ({ mount, page }) => {
    await mount(PAGE());
    expect(await expectSameList(page, (el, make) => { el.options.add(make('F', 'f'), 42); })).toBe('a,b@G,c,f');
  });

  test('add(option, element) inserts before that element', async ({ mount, page }) => {
    await mount(PAGE());
    expect(await expectSameList(page, (el, make) => { el.options.add(make('F', 'f'), el.options[2]); })).toBe('a,b@G,f,c');
  });

  test('add(option, null) appends', async ({ mount, page }) => {
    await mount(PAGE());
    expect(await expectSameList(page, (el, make) => { el.options.add(make('F', 'f'), null); })).toBe('a,b@G,c,f');
  });

  test('add(existing option) moves it', async ({ mount, page }) => {
    await mount(PAGE());
    expect(await expectSameList(page, (el) => { el.options.add(el.options[0]); })).toBe('b@G,c,a');
  });

  test('add(option, itself) does nothing', async ({ mount, page }) => {
    await mount(PAGE());
    expect(await expectSameList(page, (el) => { el.options.add(el.options[2], el.options[2]); })).toBe('a,b@G,c');
  });

  test('add(optgroup) appends a group', async ({ mount, page }) => {
    await mount(PAGE());
    await expectSame(page, (el, make) => {
      const group = document.createElement('optgroup');
      group.label = 'H';
      group.append(make('H1', 'h1'));
      el.options.add(group);
      return Array.from(el.options, (o: any) => o.value);
    });
  });

  test('add(option, element not in the list) throws NotFoundError', async ({ mount, page }) => {
    await mount(PAGE());
    expect(await expectSame(page, (el, make) => { try { el.options.add(make('X', 'x'), make('Y', 'y')); return 'no error'; } catch (e: any) { return e.name; } }))
      .toBe('NotFoundError');
  });

  test('add(not an option) throws TypeError', async ({ mount, page }) => {
    await mount(PAGE());
    expect(await expectSame(page, (el) => { try { el.options.add(document.createElement('div')); return 'no error'; } catch (e: any) { return e.name; } }))
      .toBe('TypeError');
  });

  test('select.add() works the same way', async ({ mount, page }) => {
    await mount(PAGE());
    expect(await expectSameList(page, (el, make) => { el.add(make('F', 'f'), 1); })).toBe('a,f@G,b@G,c');
  });

  test('remove(index) removes that option, out of range does nothing', async ({ mount, page }) => {
    await mount(PAGE());
    expect(await expectSameList(page, (el) => { el.options.remove(99); el.options.remove(-1); el.options.remove(1); })).toBe('a,c');
  });

  test('select.remove(index) removes an option', async ({ mount, page }) => {
    await mount(PAGE());
    expect(await expectSameList(page, (el) => { el.remove(0); })).toBe('b@G,c');
  });

  test('select.remove() without arguments removes the element itself', async ({ mount, page }) => {
    await mount(PAGE());
    expect(await expectSame(page, (el) => { el.remove(); return el.isConnected; })).toBe(false);
  });

  test('namedItem on the select itself', async ({ mount, page }) => {
    await mount(PAGE());
    await expectSame(page, (el) => [el.namedItem('o1')?.value, el.namedItem('bee')?.value, el.namedItem('x')]);
  });
});

test.describe('selectedIndex', () => {
  test('is -1 when nothing is selected', async ({ mount, page }) => {
    await mount(`<combo-box><box-option value="a">A</box-option></combo-box>`);
    expect(await page.locator('combo-box').evaluate((el: any) => [el.selectedIndex, el.options.selectedIndex])).toEqual([-1, -1]);
  });

  test('is the index of the selected option', async ({ mount, page }) => {
    await mount(PAGE());
    await page.evaluate(() => { (document.getElementById('native') as any).value = 'c'; (document.getElementById('custom') as any).value = 'c'; });
    expect(await expectSame(page, (el) => [el.selectedIndex, el.options.selectedIndex])).toEqual([2, 2]);
  });

  test('setting it selects that option', async ({ mount, page }) => {
    await mount(PAGE());
    expect(await expectSame(page, (el) => { el.selectedIndex = 1; return [el.selectedIndex, el.value]; })).toEqual([1, 'b']);
  });

  test('options.selectedIndex setter works too', async ({ mount, page }) => {
    await mount(PAGE());
    expect(await expectSame(page, (el) => { el.options.selectedIndex = 2; return el.value; })).toBe('c');
  });

  test('setting -1 clears the selection', async ({ mount, page }) => {
    await mount(PAGE());
    expect(await expectSame(page, (el) => { el.selectedIndex = 1; el.selectedIndex = -1; return [el.selectedIndex, el.value]; })).toEqual([-1, '']);
  });

  test('setting an out-of-range index clears the selection', async ({ mount, page }) => {
    await mount(PAGE());
    expect(await expectSame(page, (el) => { el.selectedIndex = 1; el.selectedIndex = 50; return [el.selectedIndex, el.value]; })).toEqual([-1, '']);
  });

  test('in multiple mode, it is the first selected and setting it keeps only that one', async ({ mount, page }) => {
    await mount(PAGE('multiple'));
    await page.evaluate(() => {
      for (const id of ['native', 'custom']) {
        const el = document.getElementById(id) as any;
        el.options[1].selected = true;
        el.options[2].selected = true;
      }
    });
    await settle(page);
    await expectSame(page, (el) => el.selectedIndex);
    await expectSame(page, (el) => { el.selectedIndex = 2; return Array.from(el.options, (o: any) => o.selected); });
  });

  test('setting selectedIndex updates the tag and the accessible value', async ({ mount, page }) => {
    await mount(PAGE());
    await page.locator('#custom').evaluate((el: any) => el.selectedIndex = 2);
    await expect(page.locator('#custom [part="value"]')).toHaveText('C');
    await expect(page.locator('#custom box-tag')).toHaveCount(1);
  });

  test('setting selectedIndex dispatches no change event, like native', async ({ mount, page }) => {
    await mount(PAGE());
    await trackChanges(page);
    await expectSame(page, (el) => { let n = 0; el.addEventListener('change', () => n++); el.selectedIndex = 0; return n; });
    expect(await changes(page)).toEqual([]);
  });
});

test.describe('side effects on the combobox', () => {
  test('an option added through options is a working option', async ({ mount, page }) => {
    await mount(PAGE());
    await page.locator('#custom').evaluate((el: any) => {
      const option = document.createElement('box-option') as any;
      option.value = 'd';
      option.textContent = 'Date';
      el.options.add(option, 0);
    });
    await page.locator('#custom').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    expect(await page.locator('#custom').evaluate((el: any) => el.value)).toBe('d');
  });

  test('removing the selected option through options clears the value', async ({ mount, page }) => {
    await mount(PAGE());
    await page.locator('#custom').evaluate((el: any) => { el.value = 'a'; el.options.remove(0); });
    await settle(page);
    expect(await page.locator('#custom').evaluate((el: any) => el.value)).toBe('');
    await expect(page.locator('#custom box-tag')).toHaveCount(0);
  });

  test('length = 0 clears the value', async ({ mount, page }) => {
    await mount(PAGE());
    await page.locator('#custom').evaluate((el: any) => { el.value = 'c'; el.options.length = 0; });
    await settle(page);
    expect(await page.locator('#custom').evaluate((el: any) => [el.value, el.length])).toEqual(['', 0]);
  });

  test('adding a selected option through options selects it', async ({ mount, page }) => {
    await mount(PAGE());
    await page.locator('#custom').evaluate((el: any) => {
      const option = document.createElement('box-option') as any;
      option.value = 'z';
      option.selected = true;
      el.options[el.options.length] = option;
    });
    expect(await page.locator('#custom').evaluate((el: any) => [el.value, el.selectedIndex])).toEqual(['z', 3]);
  });

  test('blank options appended by length get the option role', async ({ mount, page }) => {
    await mount(PAGE());
    await page.locator('#custom').evaluate((el: any) => { el.options.length = 4; });
    await expect(page.locator('#custom box-option').nth(3)).toHaveAttribute('role', 'option');
  });

  test('options and item() return the same elements', async ({ mount, page }) => {
    await mount(PAGE());
    expect(await page.locator('#custom').evaluate((el: any) => el.options[1] === el.item(1) && el.options.item(1) === el.item(1))).toBe(true);
  });
});
