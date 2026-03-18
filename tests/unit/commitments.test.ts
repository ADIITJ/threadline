import { describe, expect, it } from "vitest";
import { extractCommitmentsFromText } from "../../packages/engine-core/src/commitments.js";

describe("extractCommitmentsFromText", () => {
  it("extracts todo patterns", () => {
    const text = "TODO: review the PR by Friday";
    const results = extractCommitmentsFromText(text);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].confidence).toBeGreaterThan(0.8);
  });

  it("extracts 'I will' patterns", () => {
    const text = "I will send the invoice by end of week";
    const results = extractCommitmentsFromText(text);
    expect(results.some((c) => c.text.toLowerCase().includes("send"))).toBe(true);
  });

  it("extracts markdown checkboxes", () => {
    const text = "- [ ] Update the deployment docs\n- [x] Fix login bug";
    const results = extractCommitmentsFromText(text);
    expect(results.some((c) => c.text.toLowerCase().includes("update"))).toBe(true);
  });

  it("extracts due dates when present", () => {
    const text = "TODO: submit report by next Monday";
    const results = extractCommitmentsFromText(text);
    const withDate = results.filter((c) => c.dueDate);
    expect(withDate.length).toBeGreaterThan(0);
  });

  it("returns empty for empty text", () => {
    expect(extractCommitmentsFromText("")).toHaveLength(0);
  });

  it("does not fabricate commitments from neutral text", () => {
    const text = "The weather is nice today. Birds are singing.";
    const results = extractCommitmentsFromText(text);
    expect(results.length).toBe(0);
  });
});
