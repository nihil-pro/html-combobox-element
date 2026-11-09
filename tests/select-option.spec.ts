import { test as base, expect, axTree, settle, type Page } from './fixtures';
import { registerCombobox } from '../src/playwright';

/**
 * Playwright's own selectOption / toHaveValue / toHaveValues / getByLabel on <combo-box>, with the
 * engine from `html-combobox-element/playwright` registered, exactly as the README describes.
 * Every scenario runs on a native <select> and on a <combo-box> with the same options.
 */
const test = base.extend<{}, { comboboxSelectApi: void }>({
  comboboxSelectApi: [async ({ playwright }, use) => {
    await registerCombobox(playwright.selectors);
    await use();
  }, { scope: 'worker', auto: true }],
});

const OPTIONS = (tag: 'option' | 'box-option') => `
  <${tag} value="apple">Apple</${tag}>
  <${tag} value="banana">Banana</${tag}>
  <optgroup label="Later">
    <${tag} value="cherry">Cherry</${tag}>
    <${tag} value="date" disabled>Date</${tag}>
  </optgroup>
  <${tag}>  Elder
    berry </${tag}>`;

const PAIR = (attrs = '') => `
  <label for="native">Native</label>
  <select id="native" ${attrs}>${OPTIONS('option')}</select>
  <label for="custom">Custom</label>
  <combo-box id="custom" ${attrs}>${OPTIONS('box-option')}</combo-box>`;

const state = (page: Page, id: string) => page.locator(`#${id}`).evaluate((el: any) => ({
  value: el.value,
  selected: Array.from(el.options, (o: any) => o.selected),
}));

/** selectOption with the same argument on both; returns [native, custom] results and states */
async function selectBoth(page: Page, arg: any) {
  const results = [];
  for (const id of ['native', 'custom']) {
    const returned = await page.locator(`#${id}`).selectOption(arg);
    results.push({ returned, ...(await state(page, id)) });
  }
  return results;
}

test.describe('selectOption: same result as on <select>', () => {
  const CASES: [string, string, any][] = [
    ['by value', '', 'banana'],
    ['by label (string)', '', 'Cherry'],
    ['{ value }', '', { value: 'apple' }],
    ['{ label }', '', { label: 'Banana' }],
    ['{ index }', '', { index: 2 }],
    ['label with collapsed whitespace', '', 'Elder berry'],
    ['option without value attribute (value is its text)', '', { value: 'Elder berry' }],
    ['option inside an optgroup', '', 'cherry'],
    ['multiple values', 'multiple', ['apple', 'cherry']],
    ['multiple: labels and values mixed', 'multiple', ['Banana', 'apple']],
    ['multiple: replaces the previous selection', 'multiple', ['banana']],
    ['multiple: empty array clears', 'multiple', []],
  ];
  for (const [name, attrs, arg] of CASES) {
    test(name, async ({ mount, page }) => {
      await mount(PAIR(attrs));
      if (attrs.includes('multiple')) {
        for (const id of ['native', 'custom']) await page.locator(`#${id}`).selectOption(['apple', 'cherry']);
      }
      const [native, custom] = await selectBoth(page, arg);
      if (attrs.includes('multiple')) {
        // select.value is only the first selected value; combobox.value lists all of them (by design)
        expect({ ...custom, value: undefined }).toEqual({ ...native, value: undefined });
        expect(custom.value).toBe(custom.returned.join(','));
      } else {
        expect(custom).toEqual(native);
      }
    });
  }

  test('an element handle of the option', async ({ mount, page }) => {
    await mount(PAIR());
    await page.locator('#native').selectOption(await page.locator('#native option[value=banana]').elementHandle());
    await page.locator('#custom').selectOption(await page.locator('#custom box-option[value=banana]').elementHandle());
    expect(await state(page, 'custom')).toEqual(await state(page, 'native'));
  });

  test('single: the first match wins when several are given', async ({ mount, page }) => {
    await mount(PAIR());
    const [native, custom] = await selectBoth(page, ['cherry', 'apple']);
    expect(custom).toEqual(native);
  });

  test('replacing the selection in single mode', async ({ mount, page }) => {
    await mount(PAIR());
    await selectBoth(page, 'apple');
    const [native, custom] = await selectBoth(page, 'banana');
    expect(custom).toEqual(native);
  });

  test('the combobox state follows: tag, accessible value, form value', async ({ mount, page }) => {
    await mount(`<form><label for="c">Fruit</label><combo-box id="c" name="fruit">${OPTIONS('box-option')}</combo-box></form>`);
    await page.locator('#c').selectOption('banana');
    await expect(page.locator('#c box-tag')).toHaveCount(1);
    expect((await axTree(page)).get('combobox', 'Fruit').value).toBe('Banana');
    expect(await page.evaluate(() => new FormData(document.querySelector('form')!).get('fruit'))).toBe('banana');
  });
});

test.describe('selectOption: events like on <select>', () => {
  test('one input and one change, the same as native', async ({ mount, page }) => {
    await mount(PAIR());
    await page.evaluate(() => {
      (window as any).log = { native: [], custom: [] };
      for (const id of ['native', 'custom']) {
        const el = document.getElementById(id)!;
        for (const type of ['input', 'change']) el.addEventListener(type, () => (window as any).log[id].push(type));
      }
    });
    await selectBoth(page, 'banana');
    const log = await page.evaluate(() => (window as any).log);
    expect(log.custom).toEqual(log.native);
    expect(log.custom).toEqual(['input', 'change']);
  });

  test('the change listener sees the new value', async ({ mount, page }) => {
    await mount(PAIR());
    await page.evaluate(() => {
      const el = document.getElementById('custom') as any;
      el.addEventListener('change', () => (window as any).seen = el.value);
    });
    await page.locator('#custom').selectOption('cherry');
    expect(await page.evaluate(() => (window as any).seen)).toBe('cherry');
  });
});

test.describe('selectOption: failures like on <select>', () => {
  test('an unknown option times out on both', async ({ mount, page }) => {
    await mount(PAIR());
    for (const id of ['native', 'custom']) {
      await expect(page.locator(`#${id}`).selectOption('nope', { timeout: 500 })).rejects.toThrow(/Timeout/);
    }
  });

  test('a disabled option is not selected on both', async ({ mount, page }) => {
    await mount(PAIR());
    for (const id of ['native', 'custom']) {
      await expect(page.locator(`#${id}`).selectOption('date', { timeout: 500 })).rejects.toThrow(/Timeout/);
      expect((await state(page, id)).selected[3]).toBe(false);
    }
  });

  test('a disabled combobox makes selectOption wait, like a disabled select', async ({ mount, page }) => {
    await mount(PAIR('disabled'));
    for (const id of ['native', 'custom']) {
      const error = await page.locator(`#${id}`).selectOption('apple', { timeout: 500 }).catch((e) => e.message);
      expect(error).toMatch(/not enabled|disabled/);
    }
  });
});

test.describe('locators and assertions', () => {
  test('getByLabel finds the combobox (<label for>)', async ({ mount, page }) => {
    await mount(PAIR());
    await page.getByLabel('Custom').selectOption('banana');
    expect((await state(page, 'custom')).value).toBe('banana');
  });

  test('getByLabel finds the combobox (wrapping <label>)', async ({ mount, page }) => {
    await mount(`<label>Fruit <combo-box>${OPTIONS('box-option')}</combo-box></label>`);
    await page.getByLabel('Fruit').selectOption('cherry');
    expect(await page.locator('combo-box').evaluate((el: any) => el.value)).toBe('cherry');
  });

  test('selecting through the label element itself', async ({ mount, page }) => {
    await mount(PAIR());
    await page.locator('label[for=custom]').selectOption('apple');
    expect((await state(page, 'custom')).value).toBe('apple');
  });

  test('toHaveValue', async ({ mount, page }) => {
    await mount(PAIR());
    await page.locator('#custom').selectOption('banana');
    await expect(page.locator('#custom')).toHaveValue('banana');
    await expect(page.locator('#custom')).not.toHaveValue('apple');
    await expect(page.getByLabel('Custom')).toHaveValue(/ban/);
  });

  test('toHaveValue with nothing selected', async ({ mount, page }) => {
    await mount(`<combo-box aria-label="x"><box-option value="a">A</box-option></combo-box>`);
    await expect(page.locator('combo-box')).toHaveValue('');
  });

  test('toHaveValues', async ({ mount, page }) => {
    await mount(PAIR('multiple'));
    await page.locator('#custom').selectOption(['apple', 'cherry']);
    await expect(page.locator('#custom')).toHaveValues(['apple', 'cherry']);
    await expect(page.locator('#custom')).not.toHaveValues(['apple']);
  });

  test('toHaveValue follows a selection made by the user', async ({ mount, page }) => {
    await mount(PAIR());
    await page.locator('#custom').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page.locator('#custom')).toHaveValue('banana');
  });

  test('toBeDisabled / toBeEnabled', async ({ mount, page }) => {
    await mount(PAIR('disabled'));
    await expect(page.locator('#custom')).toBeDisabled();
    await page.locator('#custom').evaluate((el: any) => el.disabled = false);
    await expect(page.locator('#custom')).toBeEnabled();
  });
});

test.describe('dynamic content and navigation', () => {
  test('options added after load can be selected', async ({ mount, page }) => {
    await mount(`<combo-box aria-label="x"></combo-box>`);
    await page.locator('combo-box').evaluate((el: any) => {
      const option = document.createElement('box-option') as any;
      option.value = 'late';
      option.textContent = 'Late';
      el.append(option);
    });
    await page.locator('combo-box').selectOption('Late');
    await expect(page.locator('combo-box')).toHaveValue('late');
  });

  test('a combobox inserted after load', async ({ mount, page }) => {
    await mount('<div id="root"></div>');
    await page.evaluate(() => {
      document.getElementById('root')!.innerHTML = '<combo-box aria-label="x"><box-option value="a">A</box-option><box-option value="b">B</box-option></combo-box>';
    });
    await settle(page);
    await page.locator('combo-box').selectOption('b');
    await expect(page.locator('combo-box')).toHaveValue('b');
  });

  test('keeps working after navigating to another page', async ({ mount, page }) => {
    await mount(PAIR());
    await page.locator('#custom').selectOption('apple');
    await page.goto('http://combobox.test/second');
    await page.locator('#custom').selectOption('banana');
    await expect(page.locator('#custom')).toHaveValue('banana');
  });

  test('a <select> on the same page is unaffected', async ({ mount, page }) => {
    await mount(PAIR('multiple'));
    await page.locator('#native').selectOption(['banana', 'cherry']);
    await expect(page.locator('#native')).toHaveValues(['banana', 'cherry']);
  });
});

test.describe('the page itself is untouched', () => {
  test('nothing changes in the page\'s own JavaScript world', async ({ mount, page }) => {
    await mount(PAIR());
    await page.locator('#custom').selectOption('apple');  // the engine is certainly evaluated by now
    const pageWorld = await page.evaluate(() => {
      const div = document.createElement('div');
      return {
        nodeName: document.getElementById('custom')!.nodeName,
        divHasValue: 'value' in div,
        divHasOptions: 'options' in div,
        patchedHTMLElement: ['options', 'selectedOptions', 'multiple', 'labels', 'label', 'selected', 'value']
          .filter((name) => Object.getOwnPropertyDescriptor(HTMLElement.prototype, name)),
        customElementsWorks: !!customElements.get('combo-box'),
        comboboxOptionsIsCollection: Object.prototype.toString.call((document.getElementById('custom') as any).options),
      };
    });
    expect(pageWorld).toEqual({
      nodeName: 'COMBO-BOX',
      divHasValue: false,
      divHasOptions: false,
      patchedHTMLElement: [],
      customElementsWorks: true,
      comboboxOptionsIsCollection: '[object HTMLOptionsCollection]',
    });
  });

  test('page scripts using select-like checks see a combo-box as before', async ({ mount, page }) => {
    await mount(PAIR());
    await page.locator('#custom').selectOption('apple');
    expect(await page.evaluate(() => {
      const el = document.getElementById('custom')!;
      return [el.nodeName.toLowerCase() === 'select', el instanceof HTMLSelectElement, el.matches('select')];
    })).toEqual([false, false, false]);
  });
});
