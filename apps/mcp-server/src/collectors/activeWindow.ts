import { execFile } from "node:child_process";
import { platform } from "node:os";
import { promisify } from "node:util";
import type { ThreadlineEvent } from "@threadline/common";
import { logger } from "../logger.js";
import { generateId } from "../utils/hashing.js";

const execFileAsync = promisify(execFile);
const POLL_INTERVAL_MS = 10000;

type EventCallback = (event: ThreadlineEvent) => void;

async function probeActiveWindow(): Promise<{ title: string; app: string } | null> {
  const p = platform();
  try {
    if (p === "darwin") {
      const script = `tell application "System Events" to get {name, title} of first application process whose frontmost is true`;
      const { stdout } = await execFileAsync("osascript", ["-e", script]);
      const parts = stdout
        .trim()
        .split(",")
        .map((s) => s.trim());
      return { app: parts[0] ?? "", title: parts[1] ?? "" };
    }
    if (p === "linux") {
      const { stdout: id } = await execFileAsync("xdotool", ["getactivewindow"]);
      const { stdout: name } = await execFileAsync("xdotool", ["getwindowname", id.trim()]);
      return { app: "", title: name.trim() };
    }
  } catch {
    // Not available
  }
  return null;
}

export class ActiveWindowWatcher {
  private interval: NodeJS.Timeout | null = null;
  private lastTitle = "";
  private available: boolean | null = null;
  private callback: EventCallback | null = null;

  async checkAvailability(): Promise<boolean> {
    if (this.available !== null) return this.available;
    const result = await probeActiveWindow();
    this.available = result !== null;
    if (!this.available) {
      logger.info("Active window capture unavailable on this platform/config — collector disabled");
    }
    return this.available;
  }

  async start(callback: EventCallback): Promise<void> {
    const ok = await this.checkAvailability();
    if (!ok) return;

    this.callback = callback;
    this.interval = setInterval(() => void this.poll(), POLL_INTERVAL_MS);
    logger.info("Active window watcher started");
  }

  private async poll(): Promise<void> {
    try {
      const info = await probeActiveWindow();
      if (!info || !info.title) return;
      if (info.title === this.lastTitle) return;
      this.lastTitle = info.title;

      const event: ThreadlineEvent = {
        id: generateId("aw"),
        ts: Date.now(),
        source: "active_window",
        kind: "opened",
        actor: "user",
        title: info.title,
        text: info.app ? `App: ${info.app}` : "",
        tags: [],
        entities: [],
        metadata: { app: info.app },
      };

      this.callback?.(event);
    } catch {
      // Ignore
    }
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
