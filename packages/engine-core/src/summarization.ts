import type { ThreadlineEvent } from "@threadline/common";
import { tokenize } from "./clustering.js";

export function generateThreadTitle(events: ThreadlineEvent[]): string {
  if (events.length === 0) return "untitled thread";

  // Collect frequency map of meaningful tokens
  const freq = new Map<string, number>();

  for (const ev of events) {
    const sources = [ev.title, ev.repoPath, ev.path, ev.text?.slice(0, 200)].filter(
      Boolean
    ) as string[];
    for (const s of sources) {
      for (const t of tokenize(s)) {
        freq.set(t, (freq.get(t) ?? 0) + 1);
      }
    }
  }

  // Repo paths get big boost
  const repoNames = new Set<string>();
  for (const ev of events) {
    if (ev.repoPath) {
      const parts = ev.repoPath.split(/[/\\]/);
      const name = parts[parts.length - 1] || parts[parts.length - 2];
      if (name && name.length > 1) repoNames.add(name.toLowerCase());
    }
  }

  const sorted = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t);

  const leading = sorted.slice(0, 5);

  if (repoNames.size > 0) {
    const repoName = Array.from(repoNames)[0];
    const restTokens = leading.filter((t) => !repoNames.has(t)).slice(0, 3);
    if (restTokens.length > 0) {
      return `${restTokens.join(" ")} in ${repoName}`;
    }
    return `work in ${repoName}`;
  }

  if (leading.length > 0) {
    return leading.join(" ");
  }

  return "general work session";
}

export function generateThreadSummary(events: ThreadlineEvent[]): string {
  if (events.length === 0) return "";

  const sources = new Set(events.map((e) => e.source));
  const kinds = new Set(events.map((e) => e.kind));
  const repos = new Set(events.filter((e) => e.repoPath).map((e) => e.repoPath as string));
  const urls = new Set(events.filter((e) => e.url).map((e) => e.url as string));
  const first = new Date(events[0].ts);
  const last = new Date(events[events.length - 1].ts);

  const parts: string[] = [];
  parts.push(`${events.length} events across ${sources.size} source(s)`);

  if (repos.size > 0) {
    const repoNames = Array.from(repos)
      .map((r) => r.split(/[/\\]/).pop())
      .filter(Boolean)
      .slice(0, 3)
      .join(", ");
    parts.push(`repos: ${repoNames}`);
  }

  if (urls.size > 0) {
    parts.push(`${urls.size} URL(s) referenced`);
  }

  if (kinds.has("committed")) {
    parts.push("includes git commits");
  }

  if (kinds.has("checkpoint_created")) {
    parts.push("has checkpoint(s)");
  }

  const duration = last.getTime() - first.getTime();
  const hours = Math.round(duration / (60 * 60 * 1000));
  if (hours > 0) {
    parts.push(`~${hours}h session`);
  }

  return parts.join("; ");
}
