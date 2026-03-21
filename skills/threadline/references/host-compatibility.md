# Host Compatibility

Threadline uses MCP (Model Context Protocol) for tool exposure. All functionality
is available through tools alone — no resources or prompts are required.

## Supported hosts

| Host | Config location | Notes |
|------|----------------|-------|
| Claude Code | `~/.claude/mcp.json` | Full support |
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` | Full support |
| Cursor | `.cursor/mcp.json` | Full support |
| VS Code / GitHub Copilot | `.vscode/mcp.json` | Full support (Copilot-compatible) |
| OpenAI / Codex | `codex.config.toml` | Tool-only mode |

## MCP server invocation

```json
{
  "mcpServers": {
    "threadline": {
      "command": "node",
      "args": ["/path/to/threadline/apps/mcp-server/dist/main.js"]
    }
  }
}
```

## Tools-only mode

Some hosts (particularly OpenAI-compatible agents) support only MCP tools, not resources
or prompts. Threadline is fully functional in tools-only mode — all 20 tools return
complete, formatted data through the tool response.

## Browser extension

The browser extension connects to the local daemon at `http://127.0.0.1:47821` (default).
It does not connect to any AI host directly — it sends tab events to the local ingest
endpoint, which are then available through MCP tools.
