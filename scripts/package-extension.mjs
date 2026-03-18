#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const EXT_DIR = join(process.cwd(), "apps", "browser-extension", "dist");
const DIST_DIR = join(process.cwd(), "dist");
const OUT_FILE = join(DIST_DIR, "extension.zip");

if (!existsSync(EXT_DIR)) {
  console.error("apps/browser-extension/dist not found — run pnpm build first");
  process.exit(1);
}

mkdirSync(DIST_DIR, { recursive: true });

function collectFiles(dir, base) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    const relPath = relative(base, fullPath);
    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath, base));
    } else {
      results.push({ path: fullPath, name: relPath });
    }
  }
  return results;
}

// Also copy placeholder icons if they don't exist
const iconsDir = join(EXT_DIR, "icons");
if (!existsSync(iconsDir)) {
  mkdirSync(iconsDir, { recursive: true });
}
// Create minimal PNG stubs if not present
for (const size of [16, 48, 128]) {
  const iconPath = join(iconsDir, `icon${size}.png`);
  if (!existsSync(iconPath)) {
    // 1x1 transparent PNG
    const minPng = Buffer.from(
      "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c48900000011494441" +
        "5478016360f8cfc00000000200010ea26b560000000049454e44ae426082",
      "hex"
    );
    writeFileSync(iconPath, minPng);
  }
}

const files = collectFiles(EXT_DIR, EXT_DIR);

function crc32(buf) {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

const fileChunks = [];
const cdChunks = [];
let offset = 0;
const fileCount = files.length;

for (const entry of files) {
  const data = readFileSync(entry.path);
  const name = Buffer.from(entry.name.replace(/\\/g, "/"));
  const crc = crc32(data);

  const lh = Buffer.alloc(30 + name.length);
  lh.writeUInt32LE(0x04034b50, 0);
  lh.writeUInt16LE(20, 4);
  lh.writeUInt16LE(0, 6);
  lh.writeUInt16LE(0, 8);
  lh.writeUInt16LE(0, 10);
  lh.writeUInt16LE(0, 12);
  lh.writeUInt32LE(crc, 14);
  lh.writeUInt32LE(data.length, 18);
  lh.writeUInt32LE(data.length, 22);
  lh.writeUInt16LE(name.length, 26);
  lh.writeUInt16LE(0, 28);
  name.copy(lh, 30);

  const localOffset = offset;
  fileChunks.push(lh);
  fileChunks.push(data);
  offset += lh.length + data.length;

  const cd = Buffer.alloc(46 + name.length);
  cd.writeUInt32LE(0x02014b50, 0);
  cd.writeUInt16LE(20, 4);
  cd.writeUInt16LE(20, 6);
  cd.writeUInt16LE(0, 8);
  cd.writeUInt16LE(0, 10);
  cd.writeUInt16LE(0, 12);
  cd.writeUInt16LE(0, 14);
  cd.writeUInt32LE(crc, 16);
  cd.writeUInt32LE(data.length, 20);
  cd.writeUInt32LE(data.length, 24);
  cd.writeUInt16LE(name.length, 28);
  cd.writeUInt16LE(0, 30);
  cd.writeUInt16LE(0, 32);
  cd.writeUInt16LE(0, 34);
  cd.writeUInt16LE(0, 36);
  cd.writeUInt32LE(0, 38);
  cd.writeUInt32LE(localOffset, 42);
  name.copy(cd, 46);
  cdChunks.push(cd);
}

const cdSize = cdChunks.reduce((s, c) => s + c.length, 0);
const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0);
eocd.writeUInt16LE(0, 4);
eocd.writeUInt16LE(0, 6);
eocd.writeUInt16LE(fileCount, 8);
eocd.writeUInt16LE(fileCount, 10);
eocd.writeUInt32LE(cdSize, 12);
eocd.writeUInt32LE(offset, 16);
eocd.writeUInt16LE(0, 20);

writeFileSync(OUT_FILE, Buffer.concat([...fileChunks, ...cdChunks, eocd]));
console.log(`Extension packaged: ${OUT_FILE} (${fileCount} files)`);
