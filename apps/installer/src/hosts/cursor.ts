import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export function installCursor(serverPath: string, projectDir?: string): void {
  const configDir = projectDir ? join(projectDir, ".cursor") : join(homedir(), ".cursor");
  const configPath = join(configDir, "mcp.json");

  mkdirSync(configDir, { recursive: true });

  let config: Record<string, unknown> = {};
  if (existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, "utf-8")) as Record<string, unknown>;
    } catch {
      config = {};
    }
  }

  const servers = (config.mcpServers ?? {}) as Record<string, unknown>;
  servers.threadline = {
    command: "node",
    args: [serverPath],
  };
  config.mcpServers = servers;

  writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
  console.log(`  Wrote Cursor MCP config: ${configPath}`);
}

export function getCursorConfig(serverPath: string): string {
  return JSON.stringify(
    { mcpServers: { threadline: { command: "node", args: [serverPath] } } },
    null,
    2
  );
}
