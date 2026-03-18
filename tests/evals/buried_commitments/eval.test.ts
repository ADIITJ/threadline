import { describe, expect, it } from "vitest";
import { extractCommitmentsFromText } from "../../../packages/engine-core/src/commitments.js";
import { expectedCommitments, textSamples } from "./fixture.js";

describe("buried commitments eval", () => {
  for (const expected of expectedCommitments) {
    it(`extracts commitment containing "${expected.keyword}"`, () => {
      let found = false;
      for (const text of textSamples) {
        const commitments = extractCommitmentsFromText(text);
        const match = commitments.find((c) =>
          c.text.toLowerCase().includes(expected.keyword.toLowerCase())
        );
        if (match) {
          expect(match.confidence).toBeGreaterThanOrEqual(expected.minConfidence);
          found = true;
          break;
        }
      }
      expect(found).toBe(true);
    });
  }

  it("does not extract from neutral text", () => {
    const neutral = textSamples.find((t) => t.includes("sky is blue")) ?? "";
    const commitments = extractCommitmentsFromText(neutral);
    expect(commitments).toHaveLength(0);
  });
});
