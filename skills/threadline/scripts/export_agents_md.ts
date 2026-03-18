/**
 * Export an AGENTS.md file describing Threadline tools for tool-only agent hosts.
 * Output is written to stdout or a specified file.
 *
 * Usage: npx ts-node skills/threadline/scripts/export_agents_md.ts [--out <path>]
 */
import { writeFileSync } from "node:fs";

const AGENTS_MD = `# Threadline — Agent Reference

Threadline is a local-first work-memory MCP server. All tools operate on data
stored in \`~/.threadline/\` with no external network calls.

## Available Tools

| Tool | Description |
|------|-------------|
| \`health\` | Check daemon status and collector state |
| \`list_recent_threads\` | List threads sorted by last activity |
| \`get_thread_details\` | Full detail view of a single thread |
| \`get_thread_timeline\` | Chronological event list for a thread |
| \`resume_last_thread\` | Build resume card for most recent thread |
| \`search_threads\` | Full-text search across threads and events |
| \`find_commitments\` | Find open or completed commitments |
| \`prepare_handoff\` | Generate handoff document for a thread |
| \`safe_clean_downloads\` | Preview or perform Downloads folder cleanup |
| \`undo_last_cleanup\` | Restore most recent cleanup manifest |
| \`explain_why_open\` | Explain why a file or URL is relevant |
| \`open_thread_artifacts\` | Open thread artifacts in default apps |
| \`capture_checkpoint\` | Save a manual checkpoint with notes |
| \`archive_thread\` | Mark a thread as archived |

## Tool Calling Pattern

All tools accept JSON input validated by Zod schemas. All tools return
structured text suitable for display or further processing.

### Resume on session start

\`\`\`json
{ "tool": "resume_last_thread", "input": {} }
\`\`\`

### Find open commitments

\`\`\`json
{ "tool": "find_commitments", "input": { "status": "open" } }
\`\`\`

### Search for work context

\`\`\`json
{ "tool": "search_threads", "input": { "query": "oauth migration" } }
\`\`\`

### Save progress before pausing

\`\`\`json
{
  "tool": "capture_checkpoint",
  "input": {
    "title": "Before lunch break",
    "note": "Completed auth refactor, need to write tests for callback handler"
  }
}
\`\`\`

## Privacy

All data is local. No telemetry. No cloud sync. See \`~/.threadline/audit/events.jsonl\`
for a complete audit log of all writes.
`;

async function main(): Promise<void> {
  const outArg = process.argv[process.argv.indexOf("--out") + 1];
  if (outArg) {
    writeFileSync(outArg, AGENTS_MD, "utf8");
    console.log(`Written to: ${outArg}`);
  } else {
    process.stdout.write(AGENTS_MD);
  }
}

main().catch((err) => {
  console.error("export_agents_md failed:", err);
  process.exit(1);
});
