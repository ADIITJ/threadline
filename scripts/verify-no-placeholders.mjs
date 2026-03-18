#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const PATTERNS = [
  /\bTODO\b/,
  /\bFIXME\b/,
  /\bXXX\b/,
  /\bplaceholder\b/i,
  /\bstub\b/i,
  /not implemented/i,
];
const SKIP_DIRS = new Set(["node_modules", "dist", ".turbo", ".git", "coverage", "tests"]);
// Files that intentionally contain pattern keywords as test data or self-reference
const SKIP_FILES = new Set([
  "verify-no-placeholders.mjs",
  "package-extension.mjs",
]);
const TEXT_EXTS = new Set([
  ".ts",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".sh",
  ".ps1",
  ".yaml",
  ".yml",
  ".toml",
]);

function scan(dir) {
  const issues = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    if (SKIP_FILES.has(entry.name)) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      issues.push(...scan(fullPath));
    } else if (TEXT_EXTS.has(extname(entry.name))) {
      try {
        const content = readFileSync(fullPath, "utf-8");
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          for (const pattern of PATTERNS) {
            if (pattern.test(lines[i])) {
              // Allow in markdown prose sections and README
              if (entry.name.endsWith(".md")) continue;
              // Allow in verify-no-placeholders.mjs itself (the pattern definitions)
              if (entry.name === "verify-no-placeholders.mjs" && i < 10) continue;
              issues.push(`${fullPath}:${i + 1}: ${lines[i].trim()}`);
            }
          }
        }
      } catch {
        // ignore binary files
      }
    }
  }
  return issues;
}

const issues = scan(process.cwd());
if (issues.length === 0) {
  console.log("No placeholders found.");
  process.exit(0);
} else {
  console.error(`Found ${issues.length} placeholder(s):\n`);
  for (const issue of issues) {
    console.error(`  ${issue}`);
  }
  process.exit(1);
}
