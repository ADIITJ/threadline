import type { ThreadlineConfig } from "../types.js";
import { isPathAllowed } from "./pathSafety.js";

export class PermissionGuard {
  constructor(private config: ThreadlineConfig) {}

  canReadPath(p: string): boolean {
    return isPathAllowed(p, this.config.allowPaths, this.config.denyPaths);
  }

  canCleanupPath(p: string): boolean {
    // Cleanup is only allowed for Downloads by default
    const { homedir } = require("node:os") as typeof import("os");
    const downloadsDir = require("node:path").join(homedir(), "Downloads");
    const { isInsideDir } = require("./pathSafety.js") as typeof import("./pathSafety.js");
    return (
      isInsideDir(p, downloadsDir) ||
      isPathAllowed(p, this.config.allowPaths, this.config.denyPaths)
    );
  }

  canIngestBrowserEvent(isIncognito: boolean): boolean {
    if (!this.config.enableBrowserIngest) return false;
    if (isIncognito && this.config.ignorePrivateBrowser) return false;
    return true;
  }
}
