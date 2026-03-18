import { describe, expect, it } from "vitest";
import { buildHandoff } from "../../../apps/mcp-server/src/engine/buildHandoff.js";
import type { Thread } from "../../../packages/common/src/index.js";
import { scoreThreadState } from "../../../packages/engine-core/src/scoring.js";

const STALE_DAYS = 10;

function makeThread(overrides: Partial<Thread> = {}): Thread {
  const now = Date.now();
  return {
    id: "t1",
    title: "implement oauth refactor",
    summary: "OAuth refactor in progress",
    state: "stale",
    firstSeenTs: now - STALE_DAYS * 24 * 60 * 60 * 1000 - 3600000,
    lastSeenTs: now - STALE_DAYS * 24 * 60 * 60 * 1000,
    score: 0.3,
    signature: "oauth refactor api projects",
    entityBag: ["oauth", "refactor"],
    artifactIds: [],
    repoPaths: ["/projects/api"],
    urls: ["https://oauth.net/2/"],
    checkpointIds: [],
    metadata: {},
    ...overrides,
  };
}

describe("stale thread handoff eval", () => {
  it("scores stale thread correctly", () => {
    const thread = makeThread();
    const { state, score } = scoreThreadState(thread, [], Date.now());
    expect(state).toBe("stale");
    expect(score).toBeLessThan(0.5);
  });

  it("generates handoff document for stale thread", () => {
    const thread = makeThread();
    const handoff = buildHandoff(thread, [], [], []);
    expect(handoff.title).toContain("oauth");
    expect(handoff.executiveSummary.length).toBeGreaterThan(0);
    expect(handoff.nextSteps.length).toBeGreaterThan(0);
  });

  it("handoff includes open commitments", () => {
    const thread = makeThread();
    const commitments = [
      {
        id: "c1",
        threadId: "t1",
        text: "Complete the OAuth token refresh implementation",
        owner: "user",
        status: "open" as const,
        evidenceEventIds: [],
        confidence: 0.85,
        metadata: {},
      },
    ];
    const handoff = buildHandoff(thread, [], commitments, []);
    expect(handoff.commitments).toHaveLength(1);
    expect(handoff.nextSteps.some((s) => s.toLowerCase().includes("complete"))).toBe(true);
  });

  it("active thread does not score as stale", () => {
    const activeThread = makeThread({ lastSeenTs: Date.now() - 3600000 }); // 1h ago
    const { state } = scoreThreadState(activeThread, [], Date.now());
    expect(state).toBe("active");
  });
});
