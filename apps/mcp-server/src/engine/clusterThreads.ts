import type { ThreadlineEvent } from "@threadline/common";
import type { Thread } from "@threadline/common";
import {
  type Episode,
  extractSignature,
  generateThreadSummary,
  generateThreadTitle,
  scoreEpisodeMatch,
  segmentEpisodes,
} from "@threadline/engine-core";
import type { ArtifactsRepo } from "../storage/repositories/artifactsRepo.js";
import type { EventsRepo } from "../storage/repositories/eventsRepo.js";
import type { ThreadsRepo } from "../storage/repositories/threadsRepo.js";
import { globalSearchIndex } from "../storage/searchIndex.js";
import { generateId } from "../utils/hashing.js";

const CLUSTER_THRESHOLD = 0.25;

export async function clusterNewEvents(
  events: ThreadlineEvent[],
  eventsRepo: EventsRepo,
  threadsRepo: ThreadsRepo,
  artifactsRepo: ArtifactsRepo
): Promise<void> {
  if (events.length === 0) return;

  const episodes = segmentEpisodes(events);
  const existingThreads = threadsRepo.findAll(200);

  for (const episode of episodes) {
    let bestMatch: { threadId: string; score: number } | null = null;

    for (const thread of existingThreads) {
      const sig = extractSignature(eventsRepo.findByThreadId(thread.id, 50));
      const score = scoreEpisodeMatch(episode, {
        threadId: thread.id,
        signature: sig,
        lastTs: thread.lastSeenTs,
      });
      if (score > CLUSTER_THRESHOLD && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { threadId: thread.id, score };
      }
    }

    let threadId: string;
    if (bestMatch) {
      threadId = bestMatch.threadId;
      const thread = threadsRepo.findById(threadId);
      if (thread) {
        const allThreadEvents = eventsRepo.findByThreadId(threadId, 200);
        const combined = [...allThreadEvents, ...episode.events];
        const updated: Thread = {
          ...thread,
          lastSeenTs: Math.max(thread.lastSeenTs, episode.endTs),
          title: generateThreadTitle(combined),
          summary: generateThreadSummary(combined),
          signature: extractSignature(combined).canonical,
          entityBag: [...new Set([...thread.entityBag, ...episode.signature.entityTokens])],
          repoPaths: [
            ...new Set([
              ...thread.repoPaths,
              ...episode.events.filter((e) => e.repoPath).map((e) => e.repoPath as string),
            ]),
          ],
          urls: [
            ...new Set([
              ...thread.urls,
              ...episode.events.filter((e) => e.url).map((e) => e.url as string),
            ]),
          ],
        };
        threadsRepo.upsert(updated);
        indexThread(updated);
      }
    } else {
      threadId = generateId("th");
      const newThread: Thread = {
        id: threadId,
        title: generateThreadTitle(episode.events),
        summary: generateThreadSummary(episode.events),
        state: "active",
        firstSeenTs: episode.startTs,
        lastSeenTs: episode.endTs,
        score: 0.5,
        signature: episode.signature.canonical,
        entityBag: episode.signature.entityTokens,
        artifactIds: [],
        repoPaths: episode.events
          .filter((e) => e.repoPath)
          .map((e) => e.repoPath as string)
          .filter((v, i, a) => a.indexOf(v) === i),
        urls: episode.events
          .filter((e) => e.url)
          .map((e) => e.url as string)
          .filter((v, i, a) => a.indexOf(v) === i),
        checkpointIds: [],
        metadata: {},
      };
      threadsRepo.upsert(newThread);
      existingThreads.push(newThread);
      indexThread(newThread);
    }

    // Assign threadId to all events in this episode
    for (const ev of episode.events) {
      eventsRepo.updateThreadId(ev.id, threadId);
    }

    // Upsert artifacts for file/url events
    upsertEpisodeArtifacts(episode, threadId, artifactsRepo);
  }
}

function indexThread(thread: Thread): void {
  globalSearchIndex.add(thread.id, [
    thread.title,
    thread.summary,
    thread.signature,
    ...thread.entityBag,
    ...thread.repoPaths,
    ...thread.urls,
  ]);
}

function upsertEpisodeArtifacts(
  episode: Episode,
  threadId: string,
  artifactsRepo: ArtifactsRepo
): void {
  for (const ev of episode.events) {
    if (ev.path) {
      const locator = ev.path;
      let art = artifactsRepo.findByLocator(locator);
      if (!art) {
        art = {
          id: generateId("art"),
          type: "file",
          locator,
          title: ev.title || ev.path.split("/").pop() || ev.path,
          contentHash: ev.contentHash,
          firstSeenTs: ev.ts,
          lastSeenTs: ev.ts,
          metadata: {},
        };
        artifactsRepo.upsert(art);
      } else {
        artifactsRepo.upsert({ ...art, lastSeenTs: ev.ts });
      }
      artifactsRepo.linkToThread(art.id, threadId);
    }
    if (ev.url) {
      const locator = ev.url;
      let art = artifactsRepo.findByLocator(locator);
      if (!art) {
        art = {
          id: generateId("art"),
          type: "url",
          locator,
          title: ev.title || ev.hostname || ev.url,
          firstSeenTs: ev.ts,
          lastSeenTs: ev.ts,
          metadata: {},
        };
        artifactsRepo.upsert(art);
      } else {
        artifactsRepo.upsert({ ...art, lastSeenTs: ev.ts });
      }
      artifactsRepo.linkToThread(art.id, threadId);
    }
    if (ev.repoPath) {
      const locator = ev.repoPath;
      let art = artifactsRepo.findByLocator(locator);
      if (!art) {
        art = {
          id: generateId("art"),
          type: "repo",
          locator,
          title: locator.split("/").pop() || locator,
          firstSeenTs: ev.ts,
          lastSeenTs: ev.ts,
          metadata: {},
        };
        artifactsRepo.upsert(art);
      } else {
        artifactsRepo.upsert({ ...art, lastSeenTs: ev.ts });
      }
      artifactsRepo.linkToThread(art.id, threadId);
    }
  }
}
