import { describe, expect, it } from "vitest";
import type { ThreadlineEvent } from "../../packages/common/src/index.js";
import { extractSignature, tokenize } from "../../packages/engine-core/src/clustering.js";

function makeEvent(overrides: Partial<ThreadlineEvent>): ThreadlineEvent {
  return {
    id: "test",
    ts: Date.now(),
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

describe("tokenize", () => {
  it("splits on separators and lowercases", () => {
    expect(tokenize("MyComponent.tsx")).toContain("mycomponent");
  });

  it("filters stop words", () => {
    const tokens = tokenize("the quick brown fox");
    expect(tokens).not.toContain("the");
    expect(tokens).toContain("quick");
  });

  it("filters short tokens", () => {
    expect(tokenize("a b cd")).toHaveLength(0);
  });
});

describe("extractSignature", () => {
  it("extracts repo tokens from events", () => {
    const events = [makeEvent({ repoPath: "/home/user/projects/my-api", kind: "committed" })];
    const sig = extractSignature(events);
    expect(sig.repoTokens.length).toBeGreaterThan(0);
    expect(sig.canonical).toBeTruthy();
  });

  it("extracts url tokens", () => {
    const events = [
      makeEvent({
        url: "https://github.com/acme/widget-service/pull/42",
        kind: "tab_opened",
        source: "browser",
      }),
    ];
    const sig = extractSignature(events);
    expect(sig.urlTokens).toContain("github.com");
  });

  it("returns empty canonical for no events", () => {
    expect(extractSignature([]).canonical).toBe("");
  });
});
