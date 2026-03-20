/**
 * BrowserHistoryWatcher
 *
 * Reads browser history SQLite files directly from disk — no extension required.
 * Supports: Chrome, Brave, Arc, Edge (Chromium), Firefox, Safari.
 * Works on macOS, Linux, and Windows.
 *
 * Strategy:
 *  - Poll every POLL_INTERVAL_MS
 *  - For each browser profile found, copy the history file to a temp path
 *    (the original is locked while the browser is open)
 *  - Query the copy using the built-in `sqlite3` CLI
 *  - Emit ThreadlineEvent for each URL not yet seen
 *  - Track seen URLs by (url + visit_timestamp) to allow re-visits over time
 */
import { copyFileSync, existsSync, readdirSync, rmSync } from "node:fs";
import { homedir, platform, tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import type { ThreadlineEvent } from "@threadline/common";
import { logger } from "../logger.js";
import { redactSecrets } from "../security/redaction.js";
import { generateId } from "../utils/hashing.js";
import { normalizeUrl, extractHostname } from "../utils/urls.js";

const POLL_INTERVAL_MS = 60_000; // 1 minute

// Chrome epoch offset: microseconds from 1601-01-01 to 1970-01-01
const CHROME_EPOCH_OFFSET_MS = 11_644_473_600_000;

// Safari/Mac epoch offset: seconds from 2001-01-01 to 1970-01-01
const MAC_EPOCH_OFFSET_MS = 978_307_200_000;

type EventCallback = (event: ThreadlineEvent) => void;

interface BrowserProfile {
  browser: string;
  kind: "chromium" | "firefox" | "safari";
  historyPath: string;
}

function h(): string {
  return homedir();
}

function chromiumProfiles(): BrowserProfile[] {
  const p = platform();
  const profiles: Array<{ browser: string; base: string }> = [];

  if (p === "darwin") {
    profiles.push(
      { browser: "Chrome", base: join(h(), "Library/Application Support/Google/Chrome") },
      { browser: "Chrome Beta", base: join(h(), "Library/Application Support/Google/Chrome Beta") },
      { browser: "Brave", base: join(h(), "Library/Application Support/BraveSoftware/Brave-Browser") },
      { browser: "Arc", base: join(h(), "Library/Application Support/Arc/User Data") },
      { browser: "Edge", base: join(h(), "Library/Application Support/Microsoft Edge") },
      { browser: "Vivaldi", base: join(h(), "Library/Application Support/Vivaldi") },
      { browser: "Opera", base: join(h(), "Library/Application Support/com.operasoftware.Opera") },
    );
  } else if (p === "linux") {
    profiles.push(
      { browser: "Chrome", base: join(h(), ".config/google-chrome") },
      { browser: "Chromium", base: join(h(), ".config/chromium") },
      { browser: "Brave", base: join(h(), ".config/BraveSoftware/Brave-Browser") },
      { browser: "Edge", base: join(h(), ".config/microsoft-edge") },
    );
  } else if (p === "win32") {
    const local = process.env.LOCALAPPDATA ?? "";
    profiles.push(
      { browser: "Chrome", base: join(local, "Google/Chrome/User Data") },
      { browser: "Brave", base: join(local, "BraveSoftware/Brave-Browser/User Data") },
      { browser: "Edge", base: join(local, "Microsoft/Edge/User Data") },
    );
  }

  const result: BrowserProfile[] = [];
  for (const { browser, base } of profiles) {
    if (!existsSync(base)) continue;
    // Each Chromium install can have Default + Profile 1, Profile 2, ...
    const profileDirs = ["Default"];
    try {
      for (const entry of readdirSync(base, { withFileTypes: true })) {
        if (entry.isDirectory() && /^Profile \d+$/.test(entry.name)) {
          profileDirs.push(entry.name);
        }
      }
    } catch { /* ignore */ }

    for (const dir of profileDirs) {
      const historyPath = join(base, dir, "History");
      if (existsSync(historyPath)) {
        result.push({ browser: profileDirs.length > 1 ? `${browser} (${dir})` : browser, kind: "chromium", historyPath });
      }
    }
  }
  return result;
}

function firefoxProfiles(): BrowserProfile[] {
  const p = platform();
  let profilesBase = "";
  if (p === "darwin") profilesBase = join(h(), "Library/Application Support/Firefox/Profiles");
  else if (p === "linux") profilesBase = join(h(), ".mozilla/firefox");
  else if (p === "win32") profilesBase = join(process.env.APPDATA ?? "", "Mozilla/Firefox/Profiles");

  if (!profilesBase || !existsSync(profilesBase)) return [];

  const result: BrowserProfile[] = [];
  try {
    for (const entry of readdirSync(profilesBase, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const placesPath = join(profilesBase, entry.name, "places.sqlite");
      if (existsSync(placesPath)) {
        result.push({ browser: "Firefox", kind: "firefox", historyPath: placesPath });
        break; // only primary profile
      }
    }
  } catch { /* ignore */ }
  return result;
}

function safariProfiles(): BrowserProfile[] {
  if (platform() !== "darwin") return [];
  const historyPath = join(h(), "Library/Safari/History.db");
  if (!existsSync(historyPath)) return [];
  return [{ browser: "Safari", kind: "safari", historyPath }];
}

function allProfiles(): BrowserProfile[] {
  return [...chromiumProfiles(), ...firefoxProfiles(), ...safariProfiles()];
}

function sqlite3Available(): boolean {
  const result = spawnSync("sqlite3", ["--version"], { stdio: "pipe", timeout: 3000 });
  return result.status === 0 && !result.error;
}

function querySqlite(dbPath: string, sql: string): string[][] {
  const result = spawnSync("sqlite3", ["-separator", "\t", dbPath, sql], {
    stdio: "pipe",
    timeout: 5000,
  });
  if (result.error || result.status !== 0) return [];
  const output = (result.stdout ?? "").toString("utf-8");
  return output
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split("\t"));
}

function copyToTemp(src: string, label: string): string | null {
  const dest = join(tmpdir(), `threadline_${label}_${Date.now()}.db`);
  try {
    copyFileSync(src, dest);
    return dest;
  } catch {
    return null;
  }
}

function chromiumTsToMs(chromeTs: string): number {
  const n = Number(chromeTs);
  if (!n) return 0;
  return Math.floor(n / 1000) - CHROME_EPOCH_OFFSET_MS;
}

function firefoxTsToMs(ffTs: string): number {
  const n = Number(ffTs);
  if (!n) return 0;
  return Math.floor(n / 1000); // Firefox uses microseconds since Unix epoch
}

function safariTsToMs(safariTs: string): number {
  const n = Number(safariTs);
  if (!n) return 0;
  return Math.floor(n * 1000) + MAC_EPOCH_OFFSET_MS;
}

const IGNORED_URL_PREFIXES = [
  "chrome://", "chrome-extension://", "brave://",
  "about:", "edge://", "firefox://", "moz-extension://",
  "data:", "blob:", "javascript:",
];

function shouldIgnoreUrl(url: string): boolean {
  return IGNORED_URL_PREFIXES.some((p) => url.startsWith(p));
}

export class BrowserHistoryWatcher {
  private interval: NodeJS.Timeout | null = null;
  private callback: EventCallback | null = null;
  // key = url + ":" + visitTsMs (rounded to nearest second to avoid float drift)
  private seen = new Set<string>();
  private hasSqlite = false;
  // Track the most recent visit time per profile so we only fetch new rows
  private lastChecked = new Map<string, number>();

  start(callback: EventCallback): void {
    this.callback = callback;
    this.hasSqlite = sqlite3Available();

    if (!this.hasSqlite) {
      logger.warn("BrowserHistoryWatcher: sqlite3 CLI not found — browser history polling disabled");
      return;
    }

    const profiles = allProfiles();
    if (profiles.length === 0) {
      logger.info("BrowserHistoryWatcher: no browser profiles found");
      return;
    }

    logger.info("BrowserHistoryWatcher started", {
      browsers: [...new Set(profiles.map((p) => p.browser))],
    });

    // Run immediately, then on interval
    void this.poll(profiles);
    this.interval = setInterval(() => void this.poll(profiles), POLL_INTERVAL_MS);
  }

  private async poll(profiles: BrowserProfile[]): Promise<void> {
    for (const profile of profiles) {
      try {
        await this.pollProfile(profile);
      } catch (err) {
        logger.debug("BrowserHistoryWatcher poll error", { browser: profile.browser, err });
      }
    }
  }

  private async pollProfile(profile: BrowserProfile): Promise<void> {
    const key = profile.historyPath;
    const since = this.lastChecked.get(key) ?? Date.now() - 24 * 60 * 60 * 1000; // default: last 24h on first run

    const tmp = copyToTemp(profile.historyPath, profile.browser.replace(/\s/g, "_"));
    if (!tmp) return;

    try {
      let rows: string[][] = [];

      if (profile.kind === "chromium") {
        // Chrome stores time as microseconds since 1601-01-01
        const sinceChrome = (since + CHROME_EPOCH_OFFSET_MS) * 1000;
        rows = querySqlite(
          tmp,
          `SELECT url, title, last_visit_time FROM urls WHERE last_visit_time > ${sinceChrome} ORDER BY last_visit_time DESC LIMIT 100`,
        );
        for (const [url, title, ts] of rows) {
          const visitMs = chromiumTsToMs(ts);
          this.maybeEmit(url, title, visitMs, profile.browser);
        }
        if (rows.length > 0) {
          const latest = Math.max(...rows.map(([, , ts]) => chromiumTsToMs(ts)));
          if (latest > since) this.lastChecked.set(key, latest);
        }
      } else if (profile.kind === "firefox") {
        const sinceFF = since * 1000; // Firefox uses microseconds since Unix epoch
        rows = querySqlite(
          tmp,
          `SELECT url, title, last_visit_date FROM moz_places WHERE last_visit_date > ${sinceFF} AND url NOT LIKE 'about:%' AND url NOT LIKE 'moz-%' ORDER BY last_visit_date DESC LIMIT 100`,
        );
        for (const [url, title, ts] of rows) {
          const visitMs = firefoxTsToMs(ts);
          this.maybeEmit(url, title, visitMs, profile.browser);
        }
        if (rows.length > 0) {
          const latest = Math.max(...rows.map(([, , ts]) => firefoxTsToMs(ts)));
          if (latest > since) this.lastChecked.set(key, latest);
        }
      } else if (profile.kind === "safari") {
        // Safari: seconds since 2001-01-01
        const sinceSafari = (since - MAC_EPOCH_OFFSET_MS) / 1000;
        rows = querySqlite(
          tmp,
          `SELECT history_items.url, history_visits.title, history_visits.visit_time FROM history_visits JOIN history_items ON history_visits.history_item = history_items.id WHERE history_visits.visit_time > ${sinceSafari} ORDER BY history_visits.visit_time DESC LIMIT 100`,
        );
        for (const [url, title, ts] of rows) {
          const visitMs = safariTsToMs(ts);
          this.maybeEmit(url, title, visitMs, profile.browser);
        }
        if (rows.length > 0) {
          const latest = Math.max(...rows.map(([, , ts]) => safariTsToMs(ts)));
          if (latest > since) this.lastChecked.set(key, latest);
        }
      }
    } finally {
      try { rmSync(tmp); } catch { /* best effort */ }
    }
  }

  private maybeEmit(url: string, title: string, visitMs: number, browser: string): void {
    if (!url || !this.callback) return;
    if (shouldIgnoreUrl(url)) return;
    if (!visitMs || visitMs < 0) return;

    const dedupeKey = `${url}:${Math.floor(visitMs / 1000)}`;
    if (this.seen.has(dedupeKey)) return;
    this.seen.add(dedupeKey);

    // Cap seen set size
    if (this.seen.size > 50_000) {
      const iter = this.seen.values();
      for (let i = 0; i < 10_000; i++) {
        const { value, done } = iter.next();
        if (done) break;
        this.seen.delete(value);
      }
    }

    const safeTitle = redactSecrets((title ?? "").trim() || extractHostname(url));
    const safeUrl = normalizeUrl(url);

    const event: ThreadlineEvent = {
      id: generateId("bh"),
      ts: visitMs,
      source: "browser",
      kind: "tab_visited",
      actor: "user",
      title: safeTitle.slice(0, 200),
      text: "",
      url: safeUrl,
      tags: [browser.toLowerCase().replace(/\s+/g, "-")],
      entities: [extractHostname(url)].filter(Boolean),
      metadata: { browser },
    };

    this.callback(event);
  }

  detectedBrowsers(): string[] {
    if (!sqlite3Available()) return [];
    return [...new Set(allProfiles().map((p) => p.browser))];
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
