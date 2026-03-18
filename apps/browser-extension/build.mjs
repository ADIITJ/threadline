import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dist = "dist";
if (!existsSync(dist)) mkdirSync(dist, { recursive: true });

// Copy manifest
cpSync("src/manifest.json", join(dist, "manifest.json"));

// Copy HTML files
for (const f of ["options.html", "popup.html"]) {
  if (existsSync(join("src", f))) {
    cpSync(join("src", f), join(dist, f));
  }
}

// Copy icons if present
const iconsDir = join("src", "icons");
if (existsSync(iconsDir)) {
  cpSync(iconsDir, join(dist, "icons"), { recursive: true });
}

console.log("Extension build complete");
