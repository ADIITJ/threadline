import { writeFileSync } from "node:fs";
import { join } from "node:path";

export function installCodex(serverPath: string, projectDir: string): void {
  const configPath = join(projectDir, "codex.config.toml");
  writeFileSync(configPath, getCodexConfig(serverPath), "utf-8");
  console.log(`  Wrote Codex config: ${configPath}`);
}

export function getCodexConfig(serverPath: string): string {
  return `[mcp_servers.threadline]
command = "node"
args = ["${serverPath}"]
`;
}
