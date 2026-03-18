import type { ThreadlineEvent } from "@threadline/common";
import { EPISODE_GAP_MS } from "@threadline/common";

export interface Signature {
  repoTokens: string[];
  pathTokens: string[];
  urlTokens: string[];
  titleTokens: string[];
  entityTokens: string[];
  checkpointTokens: string[];
  canonical: string;
}

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "from",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "shall",
  "can",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "my",
  "your",
  "their",
  "our",
  "http",
  "https",
  "www",
  "com",
  "org",
  "net",
  "io",
  "html",
  "htm",
  "php",
  "js",
  "ts",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s\-_.]/g, " ")
    .split(/[\s\-_./\\]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

export function extractSignature(events: ThreadlineEvent[]): Signature {
  const repoSet = new Set<string>();
  const pathSet = new Set<string>();
  const urlSet = new Set<string>();
  const titleSet = new Set<string>();
  const entitySet = new Set<string>();
  const checkpointSet = new Set<string>();

  for (const ev of events) {
    if (ev.repoPath) {
      for (const t of tokenize(ev.repoPath)) repoSet.add(t);
    }
    if (ev.path) {
      for (const t of tokenize(ev.path)) pathSet.add(t);
    }
    if (ev.url) {
      try {
        const u = new URL(ev.url);
        urlSet.add(u.hostname.replace(/^www\./, ""));
        for (const t of tokenize(u.pathname)) urlSet.add(t);
      } catch {
        for (const t of tokenize(ev.url)) urlSet.add(t);
      }
    }
    if (ev.title) {
      for (const t of tokenize(ev.title)) titleSet.add(t);
    }
    for (const e of ev.entities) entitySet.add(e.toLowerCase());
    if (ev.source === "checkpoint" && ev.text) {
      for (const t of tokenize(ev.text)) checkpointSet.add(t);
    }
  }

  const canonical = [
    ...Array.from(repoSet).sort(),
    ...Array.from(pathSet).sort(),
    ...Array.from(urlSet).sort(),
    ...Array.from(titleSet).sort(),
  ]
    .slice(0, 20)
    .join("|");

  return {
    repoTokens: Array.from(repoSet),
    pathTokens: Array.from(pathSet),
    urlTokens: Array.from(urlSet),
    titleTokens: Array.from(titleSet),
    entityTokens: Array.from(entitySet),
    checkpointTokens: Array.from(checkpointSet),
    canonical,
  };
}

export interface Episode {
  events: ThreadlineEvent[];
  startTs: number;
  endTs: number;
  signature: Signature;
}

export function segmentEpisodes(
  events: ThreadlineEvent[],
  gapMs: number = EPISODE_GAP_MS
): Episode[] {
  if (events.length === 0) return [];

  const sorted = [...events].sort((a, b) => a.ts - b.ts);
  const episodes: Episode[] = [];
  let current: ThreadlineEvent[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (curr.ts - prev.ts > gapMs) {
      episodes.push(makeEpisode(current));
      current = [curr];
    } else {
      current.push(curr);
    }
  }
  if (current.length > 0) {
    episodes.push(makeEpisode(current));
  }

  return episodes;
}

function makeEpisode(events: ThreadlineEvent[]): Episode {
  return {
    events,
    startTs: events[0].ts,
    endTs: events[events.length - 1].ts,
    signature: extractSignature(events),
  };
}

export interface ClusterCandidate {
  threadId: string;
  signature: Signature;
  lastTs: number;
}

export function scoreEpisodeMatch(ep: Episode, candidate: ClusterCandidate): number {
  let score = 0;
  const sig = ep.signature;
  const cand = candidate.signature;

  const repoOverlap = overlap(sig.repoTokens, cand.repoTokens);
  const pathOverlap = overlap(sig.pathTokens, cand.pathTokens);
  const urlOverlap = overlap(sig.urlTokens, cand.urlTokens);
  const titleOverlap = overlap(sig.titleTokens, cand.titleTokens);
  const entityOverlap = overlap(sig.entityTokens, cand.entityTokens);

  score += repoOverlap * 0.35;
  score += pathOverlap * 0.25;
  score += urlOverlap * 0.15;
  score += titleOverlap * 0.15;
  score += entityOverlap * 0.1;

  // Recency bonus: episodes within 24h of candidate get small boost
  const recencyMs = ep.startTs - candidate.lastTs;
  if (recencyMs > 0 && recencyMs < 24 * 60 * 60 * 1000) {
    score += 0.1;
  }

  return Math.min(score, 1.0);
}

function overlap(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let count = 0;
  for (const t of setA) {
    if (setB.has(t)) count++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : count / union;
}
