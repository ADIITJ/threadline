# Threadline Local Install for Windows
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoDir = Split-Path -Parent $PSScriptRoot

Write-Host "=== Threadline Local Install ===" -ForegroundColor Cyan
Write-Host ""

Set-Location $RepoDir

pnpm install
pnpm build

node apps/installer/dist/cli.js install --host claude-code

Write-Host ""
Write-Host "Done. Restart Claude Code to activate Threadline." -ForegroundColor Green
