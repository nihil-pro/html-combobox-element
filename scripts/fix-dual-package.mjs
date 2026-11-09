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
import { cpSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(fileURLToPath(import.meta.url), '../..');
const typesDir = path.join(root, 'dist/types');
const cjsDir = path.join(root, 'dist/cjs');

writeFileSync(path.join(cjsDir, 'package.json'), JSON.stringify({ type: 'commonjs' }, null, 2) + '\n');

// Copies only *.d.ts (and *.d.ts.map, if ever re-enabled) alongside the existing
// *.js files already emitted into dist/cjs - nothing here overwrites those.
cpSync(typesDir, cjsDir, {
  recursive: true,
  filter: (src) => src.endsWith('.d.ts') || !path.extname(src),
});
