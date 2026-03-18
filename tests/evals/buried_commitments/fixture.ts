// Scenario: Commitments buried in clipboard captures and checkpoint notes

export const textSamples = [
  "Meeting notes: follow up with Sarah about the API keys. Send her the onboarding doc by Thursday.",
  "- [ ] Review PR #234 before EOD\n- [ ] Update staging deployment config",
  "I will ping legal about the new data retention policy. Need to do this before we launch.",
  "Just a normal note with no commitments here. The sky is blue.",
];

export const expectedCommitments = [
  // "follow up with Sarah" -> captured group is "Sarah about the API keys..."
  { keyword: "sarah", minConfidence: 0.7 },
  // markdown checkbox -> "Review PR #234 before EOD"
  { keyword: "review", minConfidence: 0.85 },
  // markdown checkbox -> "Update staging deployment config"
  { keyword: "update", minConfidence: 0.85 },
  // "I will ping legal..." -> captured group contains "legal"
  { keyword: "legal", minConfidence: 0.7 },
];
