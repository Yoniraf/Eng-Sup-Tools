#!/usr/bin/env node
/**
 * Copies the toolbox `assets/` and `tools/` into `desktop/app/` so Electron Builder can package them.
 *
 * We intentionally copy instead of referencing `../tools` directly, because electron-builder packaging
 * does not reliably include files from outside the app directory.
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const desktopDir = path.resolve(repoRoot, 'desktop');
const appDir = path.resolve(desktopDir, 'app');

const srcAssets = path.resolve(repoRoot, 'assets');
const srcTools = path.resolve(repoRoot, 'tools');
const dstAssets = path.resolve(appDir, 'assets');
const dstTools = path.resolve(appDir, 'tools');

function rmrf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch {}
}

function mkdirp(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyDir(src, dst) {
  mkdirp(dst);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else if (e.isFile()) fs.copyFileSync(s, d);
  }
}

function main() {
  if (!fs.existsSync(srcAssets) || !fs.existsSync(srcTools)) {
    console.error('Expected repo root folders not found: assets/ or tools/');
    process.exit(1);
  }

  mkdirp(appDir);
  rmrf(dstAssets);
  rmrf(dstTools);
  copyDir(srcAssets, dstAssets);
  copyDir(srcTools, dstTools);
  console.log(`[sync-app-assets] copied assets/ -> ${path.relative(repoRoot, dstAssets)}`);
  console.log(`[sync-app-assets] copied tools/  -> ${path.relative(repoRoot, dstTools)}`);
}

main();


