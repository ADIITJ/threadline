#!/usr/bin/env bash
set -euo pipefail

echo "=== Threadline Local Install ==="
echo ""

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Install deps and build
cd "$REPO_DIR"
pnpm install
pnpm build

# Install MCP config for Claude Code
node apps/installer/dist/cli.js install --host claude-code

echo ""
echo "Done. Restart Claude Code to activate Threadline."
echo ""
echo "Server: $REPO_DIR/apps/mcp-server/dist/main.js"
echo "Home:   ~/.threadline/"
