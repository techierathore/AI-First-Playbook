import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? ".");
const excluded = "docs/OpenCode-Only-Framework-Implementation-Checklist.md";
const skippedDirectories = new Set([".git", "node_modules"]);
const sourceExtensions = /\.(?:js|mjs|ts|json|jsonc|md|ya?ml)$/;
const removedHarness = ["harness", ["claude", "code"].join("-")].join("/");
const removedConfig = `.${["clau", "de"].join("")}`;
const removedInstructions = ["CLAUDE", ".md"].join("");
const removedMcpConfig = [".mcp", ".json"].join("");
const removedGenerator = ["scripts/harness", "-install.mjs"].join("");
const prohibitedArtifacts = [removedHarness, removedConfig, removedInstructions, removedMcpConfig, removedGenerator];
const prohibitedMarkers = [
  ["Claude", "Code"].join(" "), ["Claude", "adapter"].join(" "),
  ["Claude", "binary"].join(" "), ["Claude", "harness"].join(" "),
  ["Claude", "hook"].join(" "), ["Claude", "pack"].join(" "),
  ["Claude", "parity"].join(" "), ["claude", "code"].join("-"),
  ["claude", " -p"].join(""), ["PLAYBOOK", "CLAUDE", "BIN"].join("_"),
  ["CLAUDE", "PROJECT", "DIR"].join("_"), ...prohibitedArtifacts,
];
const hits = [];
let scanned = 0;

function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && skippedDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(root, absolute).replaceAll("\\", "/");
    if (relative === excluded) continue;
    if (entry.isDirectory()) visit(absolute);
    else if (entry.isFile() && (relative === ".gitignore" || sourceExtensions.test(relative))) {
      scanned++;
      const text = fs.readFileSync(absolute, "utf8");
      for (const marker of prohibitedMarkers) {
        if (text.includes(marker)) hits.push(`${relative}: ${marker}`);
      }
    }
  }
}

visit(root);
const presentArtifacts = prohibitedArtifacts.filter((item) => fs.existsSync(path.join(root, item)));
console.log(`root=${root}`);
console.log(`excluded=${excluded}`);
console.log(`source_files_scanned=${scanned}`);
console.log(`prohibited_marker_hits=${hits.length}`);
console.log(`prohibited_artifacts_present=${presentArtifacts.length}`);
if (hits.length || presentArtifacts.length) {
  console.log([...hits, ...presentArtifacts.map((item) => `artifact: ${item}`)].join("\n"));
  process.exit(1);
}
