import * as chrono from "chrono-node";

export interface ExtractedCommitment {
  text: string;
  owner: string;
  dueDate?: string;
  confidence: number;
}

const COMMITMENT_PATTERNS: Array<{ pattern: RegExp; confidence: number }> = [
  { pattern: /\bi(?:'ll| will)\s+(.{5,120})/gi, confidence: 0.85 },
  { pattern: /\bneed to\s+(.{5,120})/gi, confidence: 0.75 },
  { pattern: /\bmust\s+(.{5,120})/gi, confidence: 0.7 },
  { pattern: /\bfollow(?:\s+up)?\s+with\s+(.{5,120})/gi, confidence: 0.8 },
  { pattern: /\bsend\s+(.{5,120})/gi, confidence: 0.65 },
  { pattern: /\b(?:todo|to-do|to do)\s*[:\-]?\s*(.{5,120})/gi, confidence: 0.9 },
  { pattern: /\baction item\s*[:\-]?\s*(.{5,120})/gi, confidence: 0.9 },
  { pattern: /\bremember to\s+(.{5,120})/gi, confidence: 0.8 },
  { pattern: /\bdon't forget\s+(.{5,120})/gi, confidence: 0.8 },
  { pattern: /\bplease\s+(.{5,120})/gi, confidence: 0.55 },
  { pattern: /\bensure\s+(.{5,120})/gi, confidence: 0.65 },
  { pattern: /\bfix\s+(.{5,120})/gi, confidence: 0.6 },
  { pattern: /\bcheck(?:out)?\s+(.{5,120})/gi, confidence: 0.55 },
];

const MARKDOWN_CHECKBOX = /^[-*]\s+\[\s*[ x]\s*\]\s+(.{3,120})/gim;

function cleanMatch(m: string): string {
  return m
    .replace(/[.!?;:,]+$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

function extractDueDate(text: string): string | undefined {
  const results = chrono.parse(text, new Date(), { forwardDate: true });
  if (results.length > 0) {
    const d = results[0].start.date();
    return d.toISOString().split("T")[0];
  }
  return undefined;
}

export function extractCommitmentsFromText(text: string, owner = "user"): ExtractedCommitment[] {
  if (!text || text.trim().length < 5) return [];

  const seen = new Set<string>();
  const results: ExtractedCommitment[] = [];

  // Markdown checkboxes first (high confidence)
  let match: RegExpExecArray | null;
  const cbRegex = new RegExp(MARKDOWN_CHECKBOX.source, MARKDOWN_CHECKBOX.flags);
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop
  while ((match = cbRegex.exec(text)) !== null) {
    const raw = cleanMatch(match[1]);
    if (!raw || seen.has(raw.toLowerCase())) continue;
    seen.add(raw.toLowerCase());
    results.push({
      text: raw,
      owner,
      dueDate: extractDueDate(raw),
      confidence: 0.92,
    });
  }

  // Pattern-based extraction
  for (const { pattern, confidence } of COMMITMENT_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    // biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop
    while ((match = regex.exec(text)) !== null) {
      const raw = cleanMatch(match[1]);
      if (!raw || raw.length < 5) continue;
      const key = raw.toLowerCase().slice(0, 80);
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        text: raw,
        owner,
        dueDate: extractDueDate(`${raw} ${text.slice(0, 200)}`),
        confidence,
      });
    }
  }

  return results.slice(0, 20);
}
