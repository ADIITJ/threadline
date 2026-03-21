import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DEFAULT_DAEMON_PORT, DEFAULT_HOME_DIR } from "@threadline/common";
import type { ThreadlineConfig } from "./types.js";

export function getDefaultHomeDir(): string {
  return join(homedir(), DEFAULT_HOME_DIR);
}

export function loadConfig(homeDir?: string): ThreadlineConfig {
  const home = homeDir ?? getDefaultHomeDir();
  const configPath = join(home, "config.json");

  const defaults: ThreadlineConfig = {
    homeDir: home,
    daemonPort: DEFAULT_DAEMON_PORT,
    enableBrowserIngest: true,
    enableClipboardWatcher: true,
    enableFilesystemWatcher: true,
    enableGitWatcher: true,
    enableActiveWindowWatcher: false,
    enableBrowserHistoryWatcher: true,
    enableClaudeSessionWatcher: true,
    enableBeadsMemoryWatcher: true,
    enableClaudeTaskWatcher: true,
    allowPaths: [
      join(homedir(), "Desktop"),
      join(homedir(), "Downloads"),
      join(homedir(), "Documents"),
    ],
    denyPaths: [],
    ignorePrivateBrowser: true,
    autoArchiveThresholdDays: 30,
    downloadCleanupThreshold: 3,
    maxStoredClipboardChars: 4096,
  };

  if (!existsSync(configPath)) {
    return defaults;
  }

  try {
    const raw = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<ThreadlineConfig>;
    return { ...defaults, ...parsed, homeDir: home };
  } catch {
    return defaults;
  }
}

export function ensureHomeDirs(homeDir: string): void {
  for (const sub of ["data", "audit", "cache", "quarantine", "logs", "exports"]) {
    const dir = join(homeDir, sub);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}

export function saveConfig(config: ThreadlineConfig): void {
  ensureHomeDirs(config.homeDir);
  const configPath = join(config.homeDir, "config.json");
  writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
}
