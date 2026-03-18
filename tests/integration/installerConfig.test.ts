import { describe, expect, it } from "vitest";
import { getClaudeCodeConfig } from "../../apps/installer/src/hosts/claudeCode.js";
import { getClaudeDesktopConfig } from "../../apps/installer/src/hosts/claudeDesktop.js";
import { getCodexConfig } from "../../apps/installer/src/hosts/codex.js";
import { getCursorConfig } from "../../apps/installer/src/hosts/cursor.js";
import { getVSCodeConfig } from "../../apps/installer/src/hosts/vscodeCopilot.js";

const SERVER_PATH = "/usr/local/lib/threadline/dist/main.js";

describe("installer config generation", () => {
  it("generates valid Claude Code config", () => {
    const cfg = JSON.parse(getClaudeCodeConfig(SERVER_PATH));
    expect(cfg.mcpServers.threadline.command).toBe("node");
    expect(cfg.mcpServers.threadline.args[0]).toBe(SERVER_PATH);
  });

  it("generates valid Claude Desktop config", () => {
    const cfg = JSON.parse(getClaudeDesktopConfig(SERVER_PATH));
    expect(cfg.mcpServers.threadline).toBeTruthy();
  });

  it("generates valid Cursor config", () => {
    const cfg = JSON.parse(getCursorConfig(SERVER_PATH));
    expect(cfg.mcpServers.threadline.command).toBe("node");
  });

  it("generates valid VS Code config", () => {
    const cfg = JSON.parse(getVSCodeConfig(SERVER_PATH));
    expect(cfg.servers.threadline.type).toBe("stdio");
    expect(cfg.servers.threadline.command).toBe("node");
  });

  it("generates valid Codex config", () => {
    const toml = getCodexConfig(SERVER_PATH);
    expect(toml).toContain("[mcp_servers.threadline]");
    expect(toml).toContain('command = "node"');
    expect(toml).toContain(SERVER_PATH);
  });
});
