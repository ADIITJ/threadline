import { describe, expect, it } from "vitest";
import type { ThreadlineEvent } from "../../packages/common/src/index.js";
import {
  extractSignature,
  scoreEpisodeMatch,
  segmentEpisodes,
} from "../../packages/engine-core/src/clustering.js";

function makeEvent(overrides: Partial<ThreadlineEvent> & { ts: number }): ThreadlineEvent {
  return {
    id: `ev-${overrides.ts}`,
    source: "filesystem",
    kind: "modified",
    actor: "user",
    title: "",
    text: "",
    tags: [],
    entities: [],
    metadata: {},
    ...overrides,
  };
}

describe("scoreEpisodeMatch", () => {
  it("scores high for same repo path", () => {
    const events = [makeEvent({ ts: 1000, repoPath: "/home/user/myproject" })];
    const ep = segmentEpisodes(events)[0];
    const candidate = {
      threadId: "t1",
      signature: extractSignature([makeEvent({ ts: 500, repoPath: "/home/user/myproject" })]),
      lastTs: 900,
    };
    const score = scoreEpisodeMatch(ep, candidate);
    expect(score).toBeGreaterThan(0.2);
  });

  it("scores low for unrelated events", () => {
    const events = [makeEvent({ ts: 1000, title: "random document", path: "/docs/recipe.txt" })];
    const ep = segmentEpisodes(events)[0];
    const candidate = {
      threadId: "t2",
      signature: extractSignature([
        makeEvent({ ts: 500, repoPath: "/projects/api", title: "api server" }),
      ]),
      lastTs: 900,
    };
    const score = scoreEpisodeMatch(ep, candidate);
    expect(score).toBeLessThan(0.3);
  });

  it("gives recency bonus for recent candidates", () => {
    const now = Date.now();
    const events = [makeEvent({ ts: now, repoPath: "/projects/api" })];
    const ep = segmentEpisodes(events)[0];
    const recentCandidate = {
      threadId: "t1",
      signature: extractSignature([makeEvent({ ts: now - 60000, repoPath: "/projects/api" })]),
      lastTs: now - 60000,
    };
    const oldCandidate = {
      threadId: "t2",
      signature: extractSignature([
        makeEvent({ ts: now - 48 * 3600000, repoPath: "/projects/api" }),
      ]),
      lastTs: now - 48 * 3600000,
    };
    expect(scoreEpisodeMatch(ep, recentCandidate)).toBeGreaterThan(
      scoreEpisodeMatch(ep, oldCandidate)
    );
  });
});
