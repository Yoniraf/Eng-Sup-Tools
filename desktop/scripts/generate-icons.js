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

const sharp = require('sharp');

const desktopDir = path.resolve(__dirname, '..');
const srcSvg = path.resolve(desktopDir, 'assets', 'icon.svg');
const outDir = path.resolve(desktopDir, 'build');
const outPng = path.resolve(outDir, 'icon.png');
const outIco = path.resolve(outDir, 'icon.ico');
const outIcns = path.resolve(outDir, 'icon.icns');

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
  const base = sharp(svg).resize(1024, 1024, { fit: 'cover' });
  await base.png({ compressionLevel: 9 }).toFile(outPng);

  // --- ICO (Windows) -------------------------------------------------------
  // ICO container with embedded PNG images at common sizes.
  const icoSizes = [256, 128, 64, 48, 32, 16];
  const icoPngBuffers = [];
  for (const s of icoSizes) {
    const buf = await sharp(svg).resize(s, s, { fit: 'cover' }).png({ compressionLevel: 9 }).toBuffer();
    icoPngBuffers.push({ size: s, buf });
  }

  // ICO header: reserved(2)=0, type(2)=1, count(2)
  const count = icoPngBuffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const dirEntries = Buffer.alloc(16 * count);
  let dataOffset = 6 + 16 * count;
  const dataParts = [];
  for (let i = 0; i < count; i++) {
    const { size, buf } = icoPngBuffers[i];
    const w = size === 256 ? 0 : size;
    const h = size === 256 ? 0 : size;
    const entryOffset = i * 16;
    dirEntries.writeUInt8(w, entryOffset + 0); // width
    dirEntries.writeUInt8(h, entryOffset + 1); // height
    dirEntries.writeUInt8(0, entryOffset + 2); // color count
    dirEntries.writeUInt8(0, entryOffset + 3); // reserved
    dirEntries.writeUInt16LE(1, entryOffset + 4); // planes
    dirEntries.writeUInt16LE(32, entryOffset + 6); // bit count (nominal)
    dirEntries.writeUInt32LE(buf.length, entryOffset + 8); // bytes in resource
    dirEntries.writeUInt32LE(dataOffset, entryOffset + 12); // image offset
    dataParts.push(buf);
    dataOffset += buf.length;
  }

  fs.writeFileSync(outIco, Buffer.concat([header, dirEntries, ...dataParts]));

  // --- ICNS (macOS) --------------------------------------------------------
  // ICNS chunks containing PNG data.
  // Types for PNG: ic10 (1024), ic09 (512), ic08 (256), ic07 (128), icp6 (64), icp5 (32), icp4 (16)
  const icnsSpecs = [
    { type: 'ic10', size: 1024 },
    { type: 'ic09', size: 512 },
    { type: 'ic08', size: 256 },
    { type: 'ic07', size: 128 },
    { type: 'icp6', size: 64 },
    { type: 'icp5', size: 32 },
    { type: 'icp4', size: 16 },
  ];

  const chunks = [];
  for (const spec of icnsSpecs) {
    const png = await sharp(svg).resize(spec.size, spec.size, { fit: 'cover' }).png({ compressionLevel: 9 }).toBuffer();
    const chunkLen = 8 + png.length;
    const chunk = Buffer.alloc(8);
    chunk.write(spec.type, 0, 4, 'ascii');
    chunk.writeUInt32BE(chunkLen, 4);
    chunks.push(Buffer.concat([chunk, png]));
  }

  const totalLen = 8 + chunks.reduce((a, b) => a + b.length, 0);
  const icnsHeader = Buffer.alloc(8);
  icnsHeader.write('icns', 0, 4, 'ascii');
  icnsHeader.writeUInt32BE(totalLen, 4);
  fs.writeFileSync(outIcns, Buffer.concat([icnsHeader, ...chunks]));

  if (!fs.existsSync(outIco) || !fs.existsSync(outIcns)) {
    console.error('Icon generation did not produce expected outputs:', { outIco, outIcns });
    process.exit(1);
  }

  console.log('[generate-icons] OK:', outDir);
}

main().catch((err) => {
  console.error('[generate-icons] failed:', err);
  process.exit(1);
});


