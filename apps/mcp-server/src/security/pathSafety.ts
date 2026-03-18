import { resolve } from "node:path";

export function isPathAllowed(
  filePath: string,
  allowPaths: string[],
  denyPaths: string[]
): boolean {
  const resolved = resolve(filePath);

  for (const deny of denyPaths) {
    if (resolved.startsWith(resolve(deny))) return false;
  }

  if (allowPaths.length === 0) return false;
  for (const allow of allowPaths) {
    if (resolved.startsWith(resolve(allow))) return true;
  }

  return false;
}

export function isInsideDir(filePath: string, dir: string): boolean {
  return resolve(filePath).startsWith(resolve(dir));
}

export function safeResolvePath(filePath: string, baseDir: string): string | null {
  const resolved = resolve(filePath);
  if (!resolved.startsWith(resolve(baseDir))) return null;
  return resolved;
}
