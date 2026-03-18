import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function installVSCode(serverPath: string, projectDir: string): void {
  const vscodeDir = join(projectDir, ".vscode");
  mkdirSync(vscodeDir, { recursive: true });
  const configPath = join(vscodeDir, "mcp.json");
  writeFileSync(configPath, getVSCodeConfig(serverPath), "utf-8");
  console.log(`  Wrote VS Code MCP config: ${configPath}`);
}

export function getVSCodeConfig(serverPath: string): string {
  return JSON.stringify(
    {
      servers: {
        threadline: {
          type: "stdio",
          command: "node",
          args: [serverPath],
        },
      },
    },
    null,
    2
  );
}
