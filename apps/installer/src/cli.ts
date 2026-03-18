#!/usr/bin/env node
import { existsSync } from "node:fs";
import net from "node:net";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { getClaudeCodeConfig, installClaudeCode } from "./hosts/claudeCode.js";
import { getClaudeDesktopConfig, installClaudeDesktop } from "./hosts/claudeDesktop.js";
import { getCodexConfig } from "./hosts/codex.js";
import { getCursorConfig, installCursor } from "./hosts/cursor.js";
import { getVSCodeConfig } from "./hosts/vscodeCopilot.js";

const args = process.argv.slice(2);
const command = args[0];

function getServerPath(): string {
  const candidates = [
    join(process.cwd(), "apps", "mcp-server", "dist", "main.js"),
    join(homedir(), ".threadline", "server", "main.js"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return candidates[0];
}

function getHostFlag(): string | null {
  const idx = args.indexOf("--host");
  if (idx >= 0) return args[idx + 1] ?? "auto";
  return null;
}

async function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

async function runDoctor(): Promise<void> {
  console.log("=== Threadline Doctor ===\n");
  const serverPath = getServerPath();
  const serverExists = existsSync(serverPath);
  console.log(`Server binary: ${serverPath} (${serverExists ? "found" : "not built yet"})`);

  const portFree = await checkPort(47821);
  console.log(`Default port 47821: ${portFree ? "free" : "in use (daemon may be running)"}`);

  const homeDir = join(homedir(), ".threadline");
  console.log(
    `Home dir: ${homeDir} (${existsSync(homeDir) ? "exists" : "will be created on first run"})`
  );

  console.log("\nTo start: node apps/mcp-server/dist/main.js");
  console.log(
    "To install for a host: pnpm threadline install --host <claude-code|claude-desktop|cursor|vscode|codex>"
  );
}

function runInstall(): void {
  const serverPath = getServerPath();
  const host = getHostFlag() ?? "auto";
  const projectDir = resolve(process.cwd());

  const ALL_HOSTS = ["claude-code", "claude-desktop", "cursor", "vscode", "codex"];
  const targets = host === "auto" ? ALL_HOSTS : [host];

  console.log(`Installing Threadline MCP for: ${targets.join(", ")}\n`);

  for (const target of targets) {
    switch (target) {
      case "claude-code":
        installClaudeCode(serverPath);
        break;
      case "claude-desktop":
        installClaudeDesktop(serverPath);
        break;
      case "cursor":
        installCursor(serverPath, projectDir);
        break;
      case "vscode":
        console.log("  VS Code config (write manually to .vscode/mcp.json):");
        console.log(getVSCodeConfig(serverPath));
        break;
      case "codex":
        console.log("  Codex config (write manually to codex.config.toml):");
        console.log(getCodexConfig(serverPath));
        break;
      default:
        console.warn(`  Unknown host: ${target}`);
    }
  }

  console.log("\nDone. Restart your AI host to pick up the new MCP server.");
}

async function main(): Promise<void> {
  switch (command) {
    case "install":
      runInstall();
      break;
    case "doctor":
      await runDoctor();
      break;
    case "package":
      console.log("Run: pnpm package:skill && pnpm package:extension");
      break;
    case "dev":
      console.log("Run: pnpm dev");
      break;
    case undefined:
    case "help":
    case "--help":
      console.log("Usage: threadline <command> [options]");
      console.log("");
      console.log("Commands:");
      console.log("  install [--host <name>]   Install MCP config for a host");
      console.log("  doctor                    Check installation status");
      console.log("  package                   Package skill and extension");
      console.log("  dev                       Start in dev mode");
      console.log("");
      console.log("Hosts: auto | claude-code | claude-desktop | cursor | vscode | codex");
      break;
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
