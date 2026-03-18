#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const SKILL_DIR = join(process.cwd(), "skills", "threadline");
const DIST_DIR = join(process.cwd(), "dist");
const OUT_FILE = join(DIST_DIR, "skill.zip");

if (!existsSync(SKILL_DIR)) {
  console.error("skills/threadline not found");
  process.exit(1);
}

mkdirSync(DIST_DIR, { recursive: true });

function collectFiles(dir, base) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath, base));
    } else {
      results.push({ path: fullPath, name: relative(base, fullPath) });
    }
  }
  return results;
}

function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  return table;
}

const CRC_TABLE = makeCrcTable();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const files = collectFiles(SKILL_DIR, SKILL_DIR);
const fileChunks = [];
const centralDirectory = [];
let offset = 0;

for (const entry of files) {
  const data = readFileSync(entry.path);
  const name = Buffer.from(entry.name.replace(/\\/g, "/"));

  const localHeader = Buffer.alloc(30 + name.length);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0, 6);
  localHeader.writeUInt16LE(0, 8);
  localHeader.writeUInt16LE(0, 10);
  localHeader.writeUInt16LE(0, 12);
  const crc = crc32(data);
  localHeader.writeUInt32LE(crc, 14);
  localHeader.writeUInt32LE(data.length, 18);
  localHeader.writeUInt32LE(data.length, 22);
  localHeader.writeUInt16LE(name.length, 26);
  localHeader.writeUInt16LE(0, 28);
  name.copy(localHeader, 30);

  fileChunks.push(localHeader, data);
  centralDirectory.push({ name, crc, size: data.length, offset });
  offset += localHeader.length + data.length;
}

const cdOffset = offset;
const cdChunks = [];
for (const { name, crc, size, offset: localOffset } of centralDirectory) {
  const cdEntry = Buffer.alloc(46 + name.length);
  cdEntry.writeUInt32LE(0x02014b50, 0);
  cdEntry.writeUInt16LE(20, 4);
  cdEntry.writeUInt16LE(20, 6);
  cdEntry.writeUInt16LE(0, 8);
  cdEntry.writeUInt16LE(0, 10);
  cdEntry.writeUInt16LE(0, 12);
  cdEntry.writeUInt16LE(0, 14);
  cdEntry.writeUInt32LE(crc, 16);
  cdEntry.writeUInt32LE(size, 20);
  cdEntry.writeUInt32LE(size, 24);
  cdEntry.writeUInt16LE(name.length, 28);
  cdEntry.writeUInt16LE(0, 30);
  cdEntry.writeUInt16LE(0, 32);
  cdEntry.writeUInt16LE(0, 34);
  cdEntry.writeUInt16LE(0, 36);
  cdEntry.writeUInt32LE(0, 38);
  cdEntry.writeUInt32LE(localOffset, 42);
  name.copy(cdEntry, 46);
  cdChunks.push(cdEntry);
}

const cdSize = cdChunks.reduce((s, c) => s + c.length, 0);
const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0);
eocd.writeUInt16LE(0, 4);
eocd.writeUInt16LE(0, 6);
eocd.writeUInt16LE(files.length, 8);
eocd.writeUInt16LE(files.length, 10);
eocd.writeUInt32LE(cdSize, 12);
eocd.writeUInt32LE(cdOffset, 16);
eocd.writeUInt16LE(0, 20);

writeFileSync(OUT_FILE, Buffer.concat([...fileChunks, ...cdChunks, eocd]));
console.log(`Skill packaged: ${OUT_FILE} (${files.length} files)`);
