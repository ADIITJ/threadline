import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export function installClaudeCode(serverPath: string): void {
  const configDir = join(homedir(), ".claude");
  const mcpPath = join(configDir, "mcp.json");

  mkdirSync(configDir, { recursive: true });

  let config: Record<string, unknown> = {};
  if (existsSync(mcpPath)) {
    try {
      config = JSON.parse(readFileSync(mcpPath, "utf-8")) as Record<string, unknown>;
    } catch {
      config = {};
    }
  }

  const servers = (config.mcpServers ?? {}) as Record<string, unknown>;
  servers.threadline = {
    command: "node",
    args: [serverPath],
    env: {},
  };
  config.mcpServers = servers;

  writeFileSync(mcpPath, JSON.stringify(config, null, 2), "utf-8");
  console.log(`  Wrote Claude Code MCP config: ${mcpPath}`);
}

export function getClaudeCodeConfig(serverPath: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        threadline: { command: "node", args: [serverPath], env: {} },
      },
    },
    null,
    2
  );
}
