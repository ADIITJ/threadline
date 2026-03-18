import { describe, expect, it } from "vitest";
import {
  containsLikelySecret,
  redactSecrets,
} from "../../apps/mcp-server/src/security/redaction.js";

describe("redactSecrets", () => {
  it("redacts OpenAI keys", () => {
    const text = "Use token sk-abcdefghijklmnopqrstuvwxyz12345678901234 for auth";
    const result = redactSecrets(text);
    expect(result).not.toContain("sk-abcdefghijklmnopqrstuvwxyz12345678901234");
    expect(result).toContain("[REDACTED_");
  });

  it("redacts GitHub tokens", () => {
    const text = "token ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef1234";
    const result = redactSecrets(text);
    expect(result).not.toContain("ghp_");
  });

  it("redacts AWS access keys", () => {
    const text = "AKIAIOSFODNN7EXAMPLE is the key";
    const result = redactSecrets(text);
    expect(result).not.toContain("AKIAIOSFODNN7EXAMPLE");
  });

  it("redacts Bearer tokens", () => {
    const text = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9abc";
    const result = redactSecrets(text);
    expect(result).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9abc");
  });

  it("does not redact normal text", () => {
    const text = "hello world this is a normal message";
    expect(redactSecrets(text)).toBe(text);
  });

  it("containsLikelySecret detects secrets", () => {
    expect(containsLikelySecret("api_key=sk-abc123456789012345678901234567890")).toBe(true);
    expect(containsLikelySecret("just some normal text")).toBe(false);
  });
});
