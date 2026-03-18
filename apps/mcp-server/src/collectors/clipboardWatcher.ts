import { execFile } from "node:child_process";
import { platform } from "node:os";
import { promisify } from "node:util";
import type { ThreadlineEvent } from "@threadline/common";
import { logger } from "../logger.js";
import { redactSecrets } from "../security/redaction.js";
import { generateId, shortHash } from "../utils/hashing.js";
import { extractEntities } from "../utils/text.js";

const execFileAsync = promisify(execFile);

const POLL_INTERVAL_MS = 3000;

type EventCallback = (event: ThreadlineEvent) => void;

async function readClipboard(): Promise<string | null> {
  const p = platform();
  try {
    if (p === "darwin") {
      const { stdout } = await execFileAsync("pbpaste", []);
      return stdout;
    }
    if (p === "linux") {
      const { stdout } = await execFileAsync("xclip", ["-selection", "clipboard", "-o"]);
      return stdout;
    }
    if (p === "win32") {
      const { stdout } = await execFileAsync("powershell", ["-command", "Get-Clipboard"]);
      return stdout;
    }
  } catch {
    // Clipboard not available or empty
  }
  return null;
}

export class ClipboardWatcher {
  private interval: NodeJS.Timeout | null = null;
  private lastHash = "";
  private callback: EventCallback | null = null;
  private maxChars: number;

  constructor(maxChars = 4096) {
    this.maxChars = maxChars;
  }

  start(callback: EventCallback): void {
    this.callback = callback;
    this.interval = setInterval(() => void this.poll(), POLL_INTERVAL_MS);
    logger.info("Clipboard watcher started");
  }

  private async poll(): Promise<void> {
    try {
      const raw = await readClipboard();
      if (!raw || raw.trim().length === 0) return;

      const text = raw.slice(0, this.maxChars);
      const hash = shortHash(text);
      if (hash === this.lastHash) return;
      this.lastHash = hash;

      const safe = redactSecrets(text);
      const event: ThreadlineEvent = {
        id: generateId("cb"),
        ts: Date.now(),
        source: "clipboard",
        kind: "copied",
        actor: "user",
        title: safe.slice(0, 80).replace(/\n/g, " "),
        text: safe,
        tags: [],
        entities: extractEntities(safe),
        contentHash: hash,
        metadata: {},
      };

      this.callback?.(event);
    } catch {
      // Ignore clipboard errors silently
    }
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
