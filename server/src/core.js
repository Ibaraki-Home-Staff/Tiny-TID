// tid-core (WASM) loader. Same domain as the Cloudflare worker;
// JSON in/out across the boundary. Rebuild via `pwsh ./build-wasm.ps1`.
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

function resolveFirst(candidates) {
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

export function repoRoot() {
  // server/src -> repo root (dev and deployed layouts share it).
  return resolve(here, '..', '..');
}

export function loadCore() {
  const glue = join(here, '..', 'vendor', 'tid_core_node.js');
  const require = createRequire(import.meta.url);
  // eslint-disable-next-line import/no-dynamic-require
  const wasm = require(glue);
  const call = (fn, ...args) => {
    try {
      return fn(...args);
    } catch (e) {
      throw new Error(typeof e === 'string' ? e : (e?.message ?? String(e)));
    }
  };
  return {
    buildFullSnapshot: (builtAt, stDocsJson, mastersJson) =>
      call(wasm.build_full_snapshot, builtAt, stDocsJson, mastersJson),
    buildViewJson: (snapshotJson, reqJson) => call(wasm.build_view_json, snapshotJson, reqJson),
    cronEvaluateJson: (snapshotJson, reqJson) =>
      call(wasm.cron_evaluate_json, snapshotJson, reqJson),
    parseColorMapJson: (text) => call(wasm.parse_color_map_json, text),
    snapshotVersion: () => wasm.snapshot_version(),
  };
}

export function loadColorText() {
  const root = repoRoot();
  const file =
    resolveFirst([join(root, 'assets', 'color.txt')]) ??
    (() => {
      throw new Error('assets/color.txt not found');
    })();
  return readFileSync(file, 'utf8');
}

export function publicDir() {
  const root = repoRoot();
  const dir = resolveFirst([join(root, 'public')]);
  if (!dir) throw new Error('public/ not found');
  return dir;
}
