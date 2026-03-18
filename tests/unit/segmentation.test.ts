import { describe, expect, it } from "vitest";
import type { ThreadlineEvent } from "../../packages/common/src/index.js";
import { segmentEpisodes } from "../../packages/engine-core/src/clustering.js";

function makeEvent(tsOffset: number, id: string): ThreadlineEvent {
  return {
    id,
    ts: 1000000 + tsOffset,
    source: "filesystem",
    kind: "modified",
    actor: "user",
    title: "test.ts",
    text: "",
    tags: [],
    entities: [],
    metadata: {},
  };
}

describe("segmentEpisodes", () => {
  it("returns empty for no events", () => {
    expect(segmentEpisodes([])).toHaveLength(0);
  });

  it("groups nearby events into one episode", () => {
    const events = [makeEvent(0, "a"), makeEvent(5000, "b"), makeEvent(10000, "c")];
    const episodes = segmentEpisodes(events, 60000);
    expect(episodes).toHaveLength(1);
    expect(episodes[0].events).toHaveLength(3);
  });

  it("splits on large time gap", () => {
    const GAP = 60 * 60 * 1000; // 60 min
    const events = [makeEvent(0, "a"), makeEvent(5000, "b"), makeEvent(GAP + 10000, "c")];
    const episodes = segmentEpisodes(events, 30 * 60 * 1000);
    expect(episodes).toHaveLength(2);
    expect(episodes[0].events).toHaveLength(2);
    expect(episodes[1].events).toHaveLength(1);
  });

  it("sets correct start/end timestamps", () => {
    const events = [makeEvent(100, "a"), makeEvent(200, "b"), makeEvent(300, "c")];
    const [ep] = segmentEpisodes(events, 60000);
    expect(ep.startTs).toBe(1000100);
    expect(ep.endTs).toBe(1000300);
  });
});
