import type { CommitmentsRepo } from "../storage/repositories/commitmentsRepo.js";
import type { ThreadsRepo } from "../storage/repositories/threadsRepo.js";
import { formatRelative } from "../utils/dates.js";

interface Repos {
  threads: ThreadsRepo;
  commitments: CommitmentsRepo;
}

interface ProjectSummary {
  project: string;
  projectPath: string;
  threadCount: number;
  activeThreads: number;
  lastActiveAt: number;
  openCommitments: number;
  threads: Array<{ id: string; title: string; state: string; lastActiveAt: number }>;
}

export async function toolListProjects(_input: unknown, repos: Repos): Promise<string> {
  const threads = repos.threads.findAll(200);

  // Group threads by project
  const projectMap = new Map<string, ProjectSummary>();

  for (const thread of threads) {
    const project = thread.project ?? deriveProject(thread);
    const projectPath = thread.projectPath ?? "";

    if (!projectMap.has(project)) {
      projectMap.set(project, {
        project,
        projectPath,
        threadCount: 0,
        activeThreads: 0,
        lastActiveAt: 0,
        openCommitments: 0,
        threads: [],
      });
    }

    // biome-ignore lint/style/noNonNullAssertion: key was just set above
    const summary = projectMap.get(project)!;
    summary.threadCount++;
    if (thread.state === "active") summary.activeThreads++;
    if (thread.lastSeenTs > summary.lastActiveAt) {
      summary.lastActiveAt = thread.lastSeenTs;
    }

    const commitmentCount = repos.commitments.findAll({
      threadId: thread.id,
      status: "open",
    }).length;
    summary.openCommitments += commitmentCount;

    summary.threads.push({
      id: thread.id,
      title: thread.title,
      state: thread.state,
      lastActiveAt: thread.lastSeenTs,
    });
  }

  // Sort projects by last activity
  const projects = [...projectMap.values()].sort((a, b) => b.lastActiveAt - a.lastActiveAt);

  if (projects.length === 0) {
    return "No projects found. Projects are detected automatically as threads are created.";
  }

  const lines: string[] = ["## Projects\n"];

  for (const p of projects) {
    const relTime = p.lastActiveAt ? formatRelative(p.lastActiveAt) : "never";
    const activeLabel = p.activeThreads > 0 ? ` · ${p.activeThreads} active` : "";
    const commitLabel = p.openCommitments > 0 ? ` · ${p.openCommitments} open commitments` : "";

    lines.push(`### ${p.project}`);
    if (p.projectPath) lines.push(`Path: \`${p.projectPath}\``);
    lines.push(
      `${p.threadCount} thread${p.threadCount !== 1 ? "s" : ""}${activeLabel}${commitLabel} · Last active: ${relTime}`
    );

    const recentThreads = p.threads.sort((a, b) => b.lastActiveAt - a.lastActiveAt).slice(0, 4);

    for (const t of recentThreads) {
      const stateIcon = t.state === "active" ? "●" : t.state === "stale" ? "○" : "·";
      lines.push(`  ${stateIcon} ${t.title}  \`${t.id.slice(0, 8)}\``);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// Fallback: derive project name from thread entity bag or repo paths
function deriveProject(thread: { repoPaths?: string[]; entityBag?: string[] }): string {
  if (thread.repoPaths && thread.repoPaths.length > 0) {
    const repo = thread.repoPaths[0];
    return repo.split("/").at(-1) ?? repo;
  }
  return "Uncategorized";
}
