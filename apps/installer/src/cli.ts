#!/usr/bin/env node
import { existsSync } from "node:fs";
import net from "node:net";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { getClaudeCodeConfig, installClaudeCode } from "./hosts/claudeCode.js";
import { getClaudeDesktopConfig, installClaudeDesktop } from "./hosts/claudeDesktop.js";
import { getCodexConfig, installCodex } from "./hosts/codex.js";
import { getCursorConfig, installCursor } from "./hosts/cursor.js";
import { getVSCodeConfig, installVSCode } from "./hosts/vscodeCopilot.js";

const args = process.argv.slice(2);
const command = args[0];

const ALL_HOSTS = ["claude-code", "claude-desktop", "cursor", "vscode", "codex"] as const;
type Host = (typeof ALL_HOSTS)[number];

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

function isPrintFlag(): boolean {
  return args.includes("--print");
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
  const printOnly = isPrintFlag();

  const targets: string[] = host === "auto" ? [...ALL_HOSTS] : [host];

  console.log(`Installing Threadline MCP for: ${targets.join(", ")}\n`);

  for (const target of targets) {
    switch (target) {
      case "claude-code":
        if (printOnly) {
          console.log("  Claude Code config (~/.claude/mcp.json):");
          console.log(getClaudeCodeConfig(serverPath));
        } else {
          installClaudeCode(serverPath);
        }
        break;
      case "claude-desktop":
        if (printOnly) {
          console.log("  Claude Desktop config:");
          console.log(getClaudeDesktopConfig(serverPath));
        } else {
          installClaudeDesktop(serverPath);
        }
        break;
      case "cursor":
        if (printOnly) {
          console.log("  Cursor config (.mcp.json):");
          console.log(getCursorConfig(serverPath));
        } else {
          installCursor(serverPath, projectDir);
        }
        break;
      case "vscode":
        if (printOnly) {
          console.log("  VS Code config (.vscode/mcp.json):");
          console.log(getVSCodeConfig(serverPath));
        } else {
          installVSCode(serverPath, projectDir);
        }
        break;
      case "codex":
        if (printOnly) {
          console.log("  Codex config (codex.config.toml):");
          console.log(getCodexConfig(serverPath));
        } else {
          installCodex(serverPath, projectDir);
        }
        break;
      default:
        console.warn(`  Unknown host: ${target}`);
    }
  }

  if (printOnly) {
    console.log("\nCopy the relevant config above into the appropriate file for your host.");
  } else {
    console.log("\nDone. Restart your AI host to pick up the new MCP server.");
  }
}

function runPrompt(): void {
  const host = getHostFlag();
  const serverPath = getServerPath();
  const repoDir = resolve(process.cwd());

  const hostLine =
    host && host !== "auto"
      ? `  node ${repoDir}/apps/installer/dist/cli.js install --host ${host}`
      : `  node ${repoDir}/apps/installer/dist/cli.js install --host auto`;

  const configExamples: Record<string, string> = {
    "claude-code": `~/.claude/mcp.json  →  ${getClaudeCodeConfig(serverPath)}`,
    cursor: `.mcp.json  →  ${getCursorConfig(serverPath)}`,
    vscode: `.vscode/mcp.json  →  ${getVSCodeConfig(serverPath)}`,
    codex: `codex.config.toml  →  ${getCodexConfig(serverPath)}`,
  };

  const configBlock =
    host && host !== "auto" && configExamples[host]
      ? `\nConfig to write:\n\n${configExamples[host]}\n`
      : "";

  const prompt = `
Please set up Threadline (local work-memory MCP server) for me.

Threadline is a local MCP server that tracks my work context across files, git,
browser history, Claude sessions, and more — then surfaces it through 15 MCP tools.

Steps:

1. Verify Node.js 20+ is installed:
   node --version

2. Install dependencies and build:
   cd ${repoDir}
   pnpm install
   pnpm build

3. Register with my AI host:
${hostLine}
${configBlock}
4. Verify the server starts:
   node ${repoDir}/apps/mcp-server/dist/main.js --doctor

5. Restart your AI host (Claude Code / Claude Desktop / Cursor / VS Code / Codex).

If pnpm is not installed, install it first:
  npm install -g pnpm

Source: https://github.com/ADIITJ/threadline
`.trim();

  console.log("=== Threadline Agent Setup Prompt ===");
  console.log("Paste this into Claude, Copilot, Codex, or any AI agent:\n");
  console.log("─".repeat(60));
  console.log(prompt);
  console.log("─".repeat(60));
}

async function main(): Promise<void> {
  switch (command) {
    case "install":
      runInstall();
      break;
    case "doctor":
      await runDoctor();
      break;
    case "prompt":
      runPrompt();
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
      console.log("  install [--host <name>]      Write MCP config for a host");
      console.log("  install --print [--host <n>] Print configs instead of writing");
      console.log("  prompt  [--host <name>]      Print an agent-ready setup prompt");
      console.log("  doctor                       Check installation status");
      console.log("  package                      Package skill and extension");
      console.log("  dev                          Start in dev mode");
      console.log("");
      console.log("Hosts: auto | claude-code | claude-desktop | cursor | vscode | codex");
      console.log("");
      console.log("Examples:");
      console.log("  pnpm threadline install --host cursor");
      console.log("  pnpm threadline install --host vscode --print");
      console.log("  pnpm threadline prompt --host claude-code");
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
