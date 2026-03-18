import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

function getClaudeDesktopConfigPath(): string {
  const p = platform();
  if (p === "darwin") {
    return join(
      homedir(),
      "Library",
      "Application Support",
      "Claude",
      "claude_desktop_config.json"
    );
  }
  if (p === "win32") {
    return join(process.env.APPDATA ?? "", "Claude", "claude_desktop_config.json");
  }
  return join(homedir(), ".config", "claude", "claude_desktop_config.json");
}

export function installClaudeDesktop(serverPath: string): void {
  const configPath = getClaudeDesktopConfigPath();
  const dir = configPath.substring(0, configPath.lastIndexOf("/"));
  mkdirSync(dir, { recursive: true });

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
  console.log(`  Wrote Claude Desktop config: ${configPath}`);
}

export function getClaudeDesktopConfig(serverPath: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        threadline: { command: "node", args: [serverPath] },
      },
    },
    null,
    2
  );
}
