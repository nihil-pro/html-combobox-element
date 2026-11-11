import { test as base, expect, type Page, type Locator } from '@playwright/test';
import fs from 'node:fs';
import { BUNDLE_PATH } from './global-setup';

export { expect, type Page };

const ORIGIN = 'http://combobox.test';

/** A node of Chrome's accessibility tree, with ignored nodes flattened away. */
export interface AxNode {
  role: string;
  name: string;
  value?: string;
  /** AX properties: focused, expanded, selected, disabled, required, hasPopup, multiselectable, ... */
  props: Record<string, unknown>;
  /** Relations (controls, labelledby, activedescendant): backend DOM node ids */
  relations: Record<string, number[]>;
  backendId?: number;
  children: AxNode[];
  parent?: AxNode;
}

export class AxTree {
  constructor(readonly root: AxNode, readonly byBackendId: Map<number, AxNode>) {}

  /** Every node matching `role` (and `name` when given), in tree order. */
  all(role: string, name?: string | RegExp): AxNode[] {
    const out: AxNode[] = [];
    const walk = (node: AxNode) => {
      if (node.role === role && matches(node.name, name)) out.push(node);
      node.children.forEach(walk);
    };
    walk(this.root);
    return out;
  }

  /** The single node matching `role`/`name`. Throws when there are none or several. */
  get(role: string, name?: string | RegExp): AxNode {
    const found = this.all(role, name);
    if (found.length !== 1) {
      throw new Error(`Expected exactly one ${role} ${name ?? ''}, found ${found.length}\n${this.toString()}`);
    }
    return found[0];
  }

  /** Resolve a relation (e.g. `controls`) to the AX nodes it points to. */
  related(node: AxNode, relation: string): AxNode[] {
    return (node.relations[relation] ?? []).map((id) => this.byBackendId.get(id)).filter(Boolean) as AxNode[];
  }

  focused(): AxNode | undefined {
    let found: AxNode | undefined;
    const walk = (node: AxNode) => {
      if (node.props.focused === true && node.role !== 'RootWebArea') found = node;
      node.children.forEach(walk);
    };
    walk(this.root);
    return found;
  }

  toString(node: AxNode = this.root) {
    return printAx(node);
  }
}

function matches(value: string, pattern?: string | RegExp) {
  if (pattern === undefined) return true;
  return typeof pattern === 'string' ? value === pattern : pattern.test(value);
}

/** Children of a node, as `role "name"` strings, skipping static text. Handy for shape assertions. */
export function shape(node: AxNode, depth = Infinity): unknown {
  const kids = node.children.filter((child) => child.role !== 'StaticText');
  const label = `${node.role}${node.name ? ` "${node.name}"` : ''}`;
  if (!kids.length || depth <= 0) return label;
  return { [label]: kids.map((child) => shape(child, depth - 1)) };
}

/** Descendants of a node, depth-first */
export function descendants(node: AxNode): AxNode[] {
  return node.children.flatMap((child) => [child, ...descendants(child)]);
}

export function printAx(node: AxNode, depth = 0): string {
  const props = Object.entries(node.props).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ');
  const line = `${'  '.repeat(depth)}${node.role} "${node.name}"${node.value !== undefined ? ` value="${node.value}"` : ''} ${props}`;
  return [line, ...node.children.map((child) => printAx(child, depth + 1))].join('\n');
}

/** Read Chrome's accessibility tree through the DevTools protocol. */
export async function axTree(page: Page): Promise<AxTree> {
  const cdp = await page.context().newCDPSession(page);
  try {
    const { nodes } = (await cdp.send('Accessibility.getFullAXTree')) as { nodes: any[] };
    const raw = new Map(nodes.map((node) => [node.nodeId, node]));
    const byBackendId = new Map<number, AxNode>();
    const convert = (rawNode: any, parent?: AxNode): AxNode[] => {
      const childNodes = (rawNode.childIds ?? []).map((id: string) => raw.get(id)).filter(Boolean);
      const role = rawNode.role?.value ?? '';
      if (rawNode.ignored || role === 'InlineTextBox') {
        return childNodes.flatMap((child: any) => convert(child, parent));
      }
      const props: Record<string, unknown> = {};
      const relations: Record<string, number[]> = {};
      for (const prop of rawNode.properties ?? []) {
        if (prop.value.relatedNodes) {
          relations[prop.name] = prop.value.relatedNodes.map((r: any) => r.backendDOMNodeId);
        } else {
          props[prop.name] = prop.value.value;
        }
      }
      const node: AxNode = {
        role,
        name: rawNode.name?.value ?? '',
        value: rawNode.value?.value,
        props,
        relations,
        backendId: rawNode.backendDOMNodeId,
        children: [],
        parent,
      };
      if (node.value === undefined) delete node.value;
      if (rawNode.backendDOMNodeId) byBackendId.set(rawNode.backendDOMNodeId, node);
      node.children = childNodes.flatMap((child: any) => convert(child, node));
      return [node];
    };
    const root = nodes.find((node) => !node.parentId);
    return new AxTree(convert(root)[0], byBackendId);
  } finally {
    await cdp.detach();
  }
}

export interface MountOptions {
  /** Extra markup for <head> (styles, etc.) */
  head?: string;
}

type Fixtures = {
  /** Load a page with the given <body> markup and the component registered. */
  mount: (body: string, options?: MountOptions) => Promise<void>;
  /** Chrome's accessibility tree of the current page */
  ax: () => Promise<AxTree>;
  /** Shorthand: the <combo-box> host (first one, or by selector) */
  combo: (selector?: string) => Locator;
};

const bundle = () => fs.readFileSync(BUNDLE_PATH, 'utf8');

export const test = base.extend<Fixtures>({
  mount: async ({ page }, use) => {
    const script = bundle();
    await use(async (body, options = {}) => {
      await page.route(`${ORIGIN}/**`, (route) => {
        const url = route.request().url();
        if (url.endsWith('/combobox.js')) {
          return route.fulfill({ body: script, contentType: 'text/javascript' });
        }
        return route.fulfill({
          contentType: 'text/html',
          body: `<!doctype html><html lang="en"><head><meta charset="utf-8">${options.head ?? ''}</head>
<body>${body}<script type="module" src="/combobox.js"></script></body></html>`,
        });
      });
      await page.goto(`${ORIGIN}/`);
      await page.evaluate(() => customElements.whenDefined('combo-box'));
      await settle(page);
    });
  },
  ax: async ({ page }, use) => {
    await use(() => axTree(page));
  },
  combo: async ({ page }, use) => {
    await use((selector = 'combo-box') => page.locator(selector).first());
  },
});

/** Let mutation observers, microtasks and a couple of frames run. */
export async function settle(page: Page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

/** The element focused inside the combobox shadow root (null when the host itself is focused). */
export async function innerFocus(page: Page, selector = 'combo-box') {
  return page.evaluate((sel) => {
    const host = document.querySelector(sel)!;
    const active = host.shadowRoot!.activeElement as HTMLElement | null;
    if (!active) return document.activeElement === host ? 'host' : `outside:${document.activeElement?.tagName.toLowerCase()}`;
    if (active.localName === 'box-option') return `option:${active.getAttribute('value')}`;
    return active.getAttribute('part') ?? active.localName;
  }, selector);
}

/** Whether the dropdown popover is open */
export async function isOpen(page: Page, selector = 'combo-box') {
  return page.evaluate((sel) => document.querySelector(sel)!.shadowRoot!.querySelector('#dropdown')!.matches(':popover-open'), selector);
}

/** Count `change` events dispatched by every combo-box on the page (read back with `changes`). */
export async function trackChanges(page: Page) {
  await page.evaluate(() => {
    (window as any).__changes = [];
    document.querySelectorAll('combo-box').forEach((el) => el.addEventListener('change', () => (window as any).__changes.push((el as any).value)));
  });
}

export async function changes(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as any).__changes);
}

/** A shadow-DOM part of the combobox (Playwright CSS pierces open shadow roots). */
export function part(page: Page, name: string, selector = 'combo-box') {
  return page.locator(`${selector} [part~="${name}"]`);
}

export const FRUITS = `
  <box-option value="apple">Apple</box-option>
  <box-option value="banana">Banana</box-option>
  <box-option value="cherry">Cherry</box-option>
  <box-option value="date">Date</box-option>
`;
