import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname } from "node:path";

const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".txt",
  ".yaml",
  ".yml",
  ".toml",
  ".env",
  ".sh",
  ".py",
  ".rb",
  ".go",
  ".rs",
  ".java",
  ".kt",
  ".swift",
  ".c",
  ".cpp",
  ".h",
  ".css",
  ".html",
  ".xml",
  ".csv",
  ".log",
]);

const MAX_HASH_FILE_SIZE = 512 * 1024; // 512KB

export function safeStatSize(filePath: string): number {
  try {
    return statSync(filePath).size;
  } catch {
    return -1;
  }
}

export function safeContentHash(filePath: string): string | undefined {
  try {
    const ext = extname(filePath).toLowerCase();
    if (!TEXT_EXTENSIONS.has(ext)) return undefined;
    const size = safeStatSize(filePath);
    if (size < 0 || size > MAX_HASH_FILE_SIZE) return undefined;
    const content = readFileSync(filePath);
    return createHash("sha256").update(content).digest("hex").slice(0, 16);
  } catch {
    return undefined;
  }
}

export function fileExists(p: string): boolean {
  return existsSync(p);
}

export function getExtension(filePath: string): string {
  return extname(filePath).toLowerCase();
}
