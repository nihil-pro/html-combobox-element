// Resolves the CJS/ESM dual-package hazard for TypeScript's node16/nodenext
// module resolution: the package's root `package.json` declares `"type": "module"`,
// so without this, any `.d.ts`/`.js` file under `dist/` - including the CJS build -
// is treated by Node and TypeScript as ESM. A CommonJS consumer using
// `moduleResolution: "node16"/"nodenext"` would then hit
// `TS1479: ... cannot be imported with 'require'` when importing this package,
// even though `dist/cjs/index.js` is genuinely CommonJS.
//
// Fix: mark `dist/cjs` as CommonJS via its own `package.json`, and give it its own
// copy of the declarations (copied from the ESM `dist/types` build) so TypeScript
// resolves CJS-format types for `require()` and ESM-format types for `import`.
import { cpSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(fileURLToPath(import.meta.url), '../..');
const typesDir = path.join(root, 'dist/types');
const cjsDir = path.join(root, 'dist/cjs');

// The React type fallbacks in src/index.ts (see the region there) look unused to the declaration
// emitter - React is installed in this repo - and are dropped from index.d.ts. Consumers without
// React need them, so put them back right before the `declare module 'react'` augmentation.
{
  const source = readFileSync(path.join(root, 'src/index.ts'), 'utf8');
  const region = /\/\/ #region react-type-fallbacks\n[\s\S]*?\/\/ #endregion react-type-fallbacks\n/.exec(source);
  if (!region) throw new Error('src/index.ts: react-type-fallbacks region not found');
  const dts = path.join(typesDir, 'index.d.ts');
  const types = readFileSync(dts, 'utf8');
  const anchor = "declare module 'react' {";
  if (!types.includes(anchor)) throw new Error(`${dts}: ${anchor} not found`);
  if (!types.includes('// #region react-type-fallbacks')) {
    writeFileSync(dts, types.replace(anchor, region[0] + anchor));
  }
}

writeFileSync(path.join(cjsDir, 'package.json'), JSON.stringify({ type: 'commonjs' }, null, 2) + '\n');

// Copies only *.d.ts (and *.d.ts.map, if ever re-enabled) alongside the existing
// *.js files already emitted into dist/cjs - nothing here overwrites those.
cpSync(typesDir, cjsDir, {
  recursive: true,
  filter: (src) => src.endsWith('.d.ts') || !path.extname(src),
});
