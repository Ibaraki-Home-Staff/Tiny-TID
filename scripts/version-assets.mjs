// Cache-busting: single content hash shared by every static reference.
// Replaces `?ver=__ASSET_VERSION__` (or a previous `?ver=<hash>`) with the
// fresh hash, and appends `?ver=` to bare relative `.js` module specifiers.
// Idempotent: hashing runs over normalized content, so an unchanged tree
// yields the same version. Run before serving/deploying (and before
// build-legacy.ps1 so bundles bake the final value).
// Usage: node scripts/version-assets.mjs [public-dir]
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const OLD_VER_RE = /\?ver=[0-9a-f]{12}\b/g;
const META_VER_RE = /content="[0-9a-f]{12}"/g;
const TOKEN_RE = /__ASSET_VERSION__/g;
// Static side-effect-free module specifiers: `from './x.js'`, `import('./x.js')`.
const BARE_IMPORT_RE =
  /((?:import|export)[^'"()]*?from\s*['"]|import\s*\(\s*['"])(\.[^'"]*?\.js)(['"])/g;
const GENERATED = /^legacy-.*\.js$/;
const root = resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'public'));

async function filesUnder(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await filesUnder(full)));
    else if (entry.isFile()) out.push(full);
  }
  return out.sort();
}

const files = await filesUnder(root);
const contents = new Map();
for (const file of files) {
  try {
    const text = await readFile(file, 'utf8');
    if (!text.includes('\0')) contents.set(file, text);
  } catch {
    /* binary: hash-only */
  }
}
// Normalize first so the previous version never perturbs the hash.
const normalized = new Map();
for (const [file, text] of contents) {
  normalized.set(file, text.replace(OLD_VER_RE, '').replace(META_VER_RE, 'content=""').replace(TOKEN_RE, ''));
}
const vhash = createHash('sha256');
for (const file of files) {
  const rel = relative(root, file).split(sep).join('/');
  const text = normalized.get(file);
  vhash.update(rel, 'utf8');
  vhash.update('\0');
  if (text !== undefined) vhash.update(text, 'utf8');
  else vhash.update(await readFile(file));
}
const version = vhash.digest('hex').slice(0, 12);

let rewritten = 0;
for (const [file, text] of contents) {
  const rel = relative(root, file);
  if (GENERATED.test(rel.split(sep).pop())) continue; // esbuild output: no token inside
  const withVersion = text.replace(TOKEN_RE, version).replace(OLD_VER_RE, `?ver=${version}`);
  const finalText = withVersion.replace(BARE_IMPORT_RE, `$1$2?ver=${version}$3`);
  if (finalText !== text) {
    await writeFile(file, finalText);
    rewritten += 1;
  }
}

console.log(`version-assets: ver=${version} files=${files.length} rewritten=${rewritten}`);
