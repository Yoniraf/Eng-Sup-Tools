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
const srcIndexHtml = path.resolve(repoRoot, 'index.html');
const srcGuideHtml = path.resolve(repoRoot, 'guide.html');
const srcGuideMd = path.resolve(repoRoot, 'GUIDE.md');
const dstIndexHtml = path.resolve(appDir, 'index.html');
const dstGuideHtml = path.resolve(appDir, 'guide.html');
const dstGuideMd = path.resolve(appDir, 'GUIDE.md');

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
  // Copy toolbox entry pages so the desktop app can load the full dashboard UI.
  if (fs.existsSync(srcIndexHtml)) fs.copyFileSync(srcIndexHtml, dstIndexHtml);
  if (fs.existsSync(srcGuideHtml)) fs.copyFileSync(srcGuideHtml, dstGuideHtml);
  if (fs.existsSync(srcGuideMd)) fs.copyFileSync(srcGuideMd, dstGuideMd);
  console.log(`[sync-app-assets] copied assets/ -> ${path.relative(repoRoot, dstAssets)}`);
  console.log(`[sync-app-assets] copied tools/  -> ${path.relative(repoRoot, dstTools)}`);
  console.log(`[sync-app-assets] copied index.html -> ${path.relative(repoRoot, dstIndexHtml)}`);
  console.log(`[sync-app-assets] copied guide.html -> ${path.relative(repoRoot, dstGuideHtml)}`);
  console.log(`[sync-app-assets] copied GUIDE.md -> ${path.relative(repoRoot, dstGuideMd)}`);
}

main();


