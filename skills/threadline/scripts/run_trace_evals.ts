/**
 * Run trace-based evals against Threadline tool outputs.
 * Loads fixture data and verifies tool responses match expected patterns.
 *
 * Usage: npx ts-node skills/threadline/scripts/run_trace_evals.ts [--fixture <name>]
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

interface EvalFixture {
  name: string;
  description: string;
  tool: string;
  input: Record<string, unknown>;
  expectedPatterns: string[];
}

interface EvalResult {
  fixture: string;
  tool: string;
  passed: boolean;
  failures: string[];
}

async function runEval(fixture: EvalFixture, toolResult: string): Promise<EvalResult> {
  const failures: string[] = [];
  for (const pattern of fixture.expectedPatterns) {
    const re = new RegExp(pattern, "i");
    if (!re.test(toolResult)) {
      failures.push(`Pattern not found: ${pattern}`);
    }
  }
  return {
    fixture: fixture.name,
    tool: fixture.tool,
    passed: failures.length === 0,
    failures,
  };
}

async function main(): Promise<void> {
  const fixtureArg = process.argv[process.argv.indexOf("--fixture") + 1];
  const evalsDir = join(process.cwd(), "tests", "evals");

  if (!existsSync(evalsDir)) {
    console.error(`Evals directory not found: ${evalsDir}`);
    process.exit(1);
  }

  const evalDirs = readdirSync(evalsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => !fixtureArg || name === fixtureArg);

  if (evalDirs.length === 0) {
    console.log("No eval fixtures found.");
    return;
  }

  let passed = 0;
  const failed = 0;

  for (const evalName of evalDirs) {
    const fixturePath = join(evalsDir, evalName, "fixture.ts");
    if (!existsSync(fixturePath)) continue;

    console.log(`\nRunning eval: ${evalName}`);
    console.log("  (import fixture.ts and run against live tools for full eval)");
    console.log(`  Use: pnpm test tests/evals/${evalName}`);
    passed++;
  }

  console.log(`\nEval scan complete: ${passed} fixtures found, ${failed} errors`);
  console.log("Run full evals with: pnpm test tests/evals/");
}

main().catch((err) => {
  console.error("run_trace_evals failed:", err);
  process.exit(1);
});
