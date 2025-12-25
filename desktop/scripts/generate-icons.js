#!/usr/bin/env node
/**
 * Generates Windows/macOS icon files for electron-builder.
 *
 * Source of truth: `desktop/assets/icon.svg` (text file, committed).
 * Outputs (generated, not meant to be committed):
 * - `desktop/build/icon.png`  (1024x1024)
 * - `desktop/build/icon.ico`
 * - `desktop/build/icon.icns`
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const sharp = require('sharp');

const desktopDir = path.resolve(__dirname, '..');
const srcSvg = path.resolve(desktopDir, 'assets', 'icon.svg');
const outDir = path.resolve(desktopDir, 'build');
const outPng = path.resolve(outDir, 'icon.png');

function mkdirp(p) {
  fs.mkdirSync(p, { recursive: true });
}

async function main() {
  if (!fs.existsSync(srcSvg)) {
    console.error('Missing icon source:', srcSvg);
    process.exit(1);
  }

  mkdirp(outDir);

  const svg = fs.readFileSync(srcSvg);
  await sharp(svg)
    .resize(1024, 1024, { fit: 'cover' })
    .png({ compressionLevel: 9 })
    .toFile(outPng);

  const bin = process.platform === 'win32'
    ? path.resolve(desktopDir, 'node_modules', '.bin', 'electron-icon-builder.cmd')
    : path.resolve(desktopDir, 'node_modules', '.bin', 'electron-icon-builder');

  const args = [`--input=${outPng}`, `--output=${outDir}`];
  const r = spawnSync(bin, args, { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status || 1);

  // electron-icon-builder outputs: icon.icns + icon.ico (and other sizes).
  // electron-builder config points at build/icon.icns and build/icon.ico.
  const icns = path.resolve(outDir, 'icon.icns');
  const ico = path.resolve(outDir, 'icon.ico');
  if (!fs.existsSync(icns) || !fs.existsSync(ico)) {
    console.error('Icon generation did not produce expected outputs:', { icns, ico });
    process.exit(1);
  }

  console.log('[generate-icons] OK:', outDir);
}

main().catch((err) => {
  console.error('[generate-icons] failed:', err);
  process.exit(1);
});


