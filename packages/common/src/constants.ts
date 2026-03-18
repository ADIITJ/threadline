export const THREADLINE_VERSION = "1.0.0";
export const DEFAULT_DAEMON_PORT = 47821;
export const DEFAULT_HOME_DIR = ".threadline";
export const AUDIT_LOG_FILE = "audit/events.jsonl";
export const CONFIG_FILE = "config.json";
export const DB_FILE = "data/threadline.db";

export const EPISODE_GAP_MS = 30 * 60 * 1000; // 30 minutes
export const STALE_THREAD_DAYS = 7;
export const ACTIVE_THREAD_HOURS = 4;

export const MAX_CLIPBOARD_CHARS = 4096;
export const MAX_EVENT_TEXT_CHARS = 2048;

export const IGNORED_EXTENSIONS = new Set([".DS_Store", ".git", ".lock", ".log"]);

export const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".turbo",
  "dist",
  "build",
  ".next",
  "__pycache__",
  ".pytest_cache",
  "vendor",
]);

export const COMMITMENT_CONFIDENCE_THRESHOLD = 0.4;
