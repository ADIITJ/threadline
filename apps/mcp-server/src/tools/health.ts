import { THREADLINE_VERSION } from "@threadline/common";
import type { CheckpointsRepo } from "../storage/repositories/checkpointsRepo.js";
import type { CommitmentsRepo } from "../storage/repositories/commitmentsRepo.js";
import type { EventsRepo } from "../storage/repositories/eventsRepo.js";
import type { ThreadsRepo } from "../storage/repositories/threadsRepo.js";
import type { ThreadlineConfig } from "../types.js";

export async function toolHealth(
  _input: Record<string, never>,
  config: ThreadlineConfig,
  repos: {
    events: EventsRepo;
    threads: ThreadsRepo;
    commitments: CommitmentsRepo;
    checkpoints: CheckpointsRepo;
  }
) {
  const enabledCollectors: string[] = [];
  if (config.enableFilesystemWatcher) enabledCollectors.push("filesystem");
  if (config.enableClipboardWatcher) enabledCollectors.push("clipboard");
  if (config.enableGitWatcher) enabledCollectors.push("git");
  if (config.enableBrowserIngest) enabledCollectors.push("browser");
  if (config.enableActiveWindowWatcher) enabledCollectors.push("active_window");

  return {
    ok: true,
    version: THREADLINE_VERSION,
    threadlineHome: config.homeDir,
    capabilities: ["filesystem", "clipboard", "git", "browser", "checkpoint"],
    enabledCollectors,
    recentCounts: {
      events: repos.events.countTotal(),
      threads: repos.threads.countTotal(),
      commitments: repos.commitments.countTotal(),
      checkpoints: repos.checkpoints.countTotal(),
    },
  };
}
