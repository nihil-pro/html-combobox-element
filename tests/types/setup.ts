import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { FIXTURES, LAYOUTS, ROOT, TARBALL, WORK, copyDir, layoutDir, run } from './harness';

/**
 * Builds and packs the package, then installs every fixture layout from the tarball.
 *
 * TYPES_REUSE_INSTALL=1 skips installing layouts that already exist (it still rebuilds, repacks
 * and refreshes the package inside each layout), which keeps the edit-run loop fast.
 */
export default async function setup() {
  fs.mkdirSync(WORK, { recursive: true });

  run('npm', ['run', 'build'], ROOT);
  const packed = execJson(['pack', '--json', '--pack-destination', WORK]);
  fs.renameSync(path.join(WORK, packed[0].filename), TARBALL);

  const reuse = process.env.TYPES_REUSE_INSTALL === '1';

  for (const layout of LAYOUTS) {
    const dir = layoutDir(layout.name);
    const installed = fs.existsSync(path.join(dir, 'node_modules'));

    if (reuse && installed) {
      // Refresh sources (fixtures may have been edited) and the package itself, keep node_modules.
      for (const s of layout.shared ?? []) copyDir(path.join(FIXTURES, s.from), path.join(dir, s.to));
      copyDir(path.join(FIXTURES, layout.name), dir);
      refreshPackage(dir);
      continue;
    }

    fs.rmSync(dir, { recursive: true, force: true });
    for (const s of layout.shared ?? []) copyDir(path.join(FIXTURES, s.from), path.join(dir, s.to));
    copyDir(path.join(FIXTURES, layout.name), dir);

    if (layout.install === 'npm') {
      run('npm', ['install', '--no-audit', '--no-fund', '--prefer-offline'], dir);
    } else {
      run('npx', ['--yes', 'pnpm@10', 'install', '--prefer-offline'], dir);
    }
  }
}

function execJson(args: string[]) {
  return JSON.parse(execFileSync('npm', args, { cwd: ROOT, encoding: 'utf8' }));
}

/** Replace every installed copy of html-combobox-element with the freshly packed dist. */
function refreshPackage(dir: string) {
  const copies: string[] = [];
  const walk = (d: string, depth: number) => {
    if (depth > 6 || !fs.existsSync(d)) return;
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name);
      if (entry.name === 'html-combobox-element' && fs.existsSync(path.join(p, 'package.json')) && !entry.isSymbolicLink()) {
        copies.push(p);
      } else if (entry.isDirectory() && !entry.isSymbolicLink() && (entry.name === 'node_modules' || entry.name === '.pnpm' || d.includes('node_modules') || depth < 3)) {
        walk(p, depth + 1);
      }
    }
  };
  walk(dir, 0);
  for (const copy of copies) {
    fs.rmSync(path.join(copy, 'dist'), { recursive: true, force: true });
    fs.cpSync(path.join(ROOT, 'dist'), path.join(copy, 'dist'), { recursive: true });
  }
}
