const REDACT_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bsk-[A-Za-z0-9]{20,60}\b/g, label: "OPENAI_KEY" },
  { pattern: /\bghp_[A-Za-z0-9]{36}\b/g, label: "GITHUB_TOKEN" },
  { pattern: /\bgho_[A-Za-z0-9]{36}\b/g, label: "GITHUB_OAUTH" },
  { pattern: /\bghx_[A-Za-z0-9]{36}\b/g, label: "GITHUB_TOKEN" },
  { pattern: /\bglpat-[A-Za-z0-9_-]{20,}\b/g, label: "GITLAB_TOKEN" },
  { pattern: /\bAKIA[A-Z0-9]{16}\b/g, label: "AWS_ACCESS_KEY" },
  { pattern: /\b[A-Za-z0-9/+=]{40}\b(?=.*aws)/gi, label: "AWS_SECRET" },
  { pattern: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, label: "BEARER_TOKEN" },
  { pattern: /token[=:]\s*["']?[A-Za-z0-9\-._~+/]{20,}["']?/gi, label: "TOKEN" },
  { pattern: /api[_-]?key[=:]\s*["']?[A-Za-z0-9\-._~+/]{16,}["']?/gi, label: "API_KEY" },
  { pattern: /password[=:]\s*["']?[^\s"']{8,}["']?/gi, label: "PASSWORD" },
  { pattern: /secret[=:]\s*["']?[A-Za-z0-9\-._~+/]{12,}["']?/gi, label: "SECRET" },
  // High-entropy strings (base64-ish, 40+ chars)
  {
    pattern:
      /\b(?=[A-Za-z0-9+/]{40,})(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?\b/g,
    label: "HIGH_ENTROPY",
  },
];

export function redactSecrets(text: string): string {
  if (!text) return text;
  let result = text;
  for (const { pattern, label } of REDACT_PATTERNS) {
    result = result.replace(pattern, `[REDACTED_${label}]`);
  }
  return result;
}

export function containsLikelySecret(text: string): boolean {
  for (const { pattern } of REDACT_PATTERNS) {
    if (new RegExp(pattern.source, pattern.flags).test(text)) return true;
  }
  return false;
}
