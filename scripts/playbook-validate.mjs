import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readMisses, validateMisses } from "./miss-lib.mjs";
import { parseTiersYaml } from "./tier-lib.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const errors = [];
const read = (p) => readFileSync(p.startsWith(root) ? p : join(root, p), "utf8");
const files = (dir, suffix) => readdirSync(join(root, dir)).filter((f) => f.endsWith(suffix));
const verdicts = ["PASS", "FAIL", "PASS (code-audit)", "FAIL (code-audit)", "DATA-GAP", "BLOCKED"];

const removedHarness = ["harness", ["claude", "code"].join("-")].join("/");
const removedConfig = `.${["clau", "de"].join("")}`;
const removedInstructions = ["CLAUDE", ".md"].join("");
const removedMcpConfig = [".mcp", ".json"].join("");
const removedGenerator = ["scripts/harness", "-install.mjs"].join("");
const prohibitedArtifacts = [removedHarness, removedConfig, removedInstructions, removedMcpConfig, removedGenerator];
const prohibitedMarkers = [
  ["Claude", "Code"].join(" "),
  ["Claude", "adapter"].join(" "),
  ["Claude", "binary"].join(" "),
  ["Claude", "harness"].join(" "),
  ["Claude", "hook"].join(" "),
  ["Claude", "pack"].join(" "),
  ["Claude", "parity"].join(" "),
  ["claude", "code"].join("-"),
  ["claude", " -p"].join(""),
  ["PLAYBOOK", "CLAUDE", "BIN"].join("_"),
  ["CLAUDE", "PROJECT", "DIR"].join("_"),
  ...prohibitedArtifacts,
];
const scanExclusions = new Set([
  "docs/OpenCode-Only-Framework-Implementation-Checklist.md",
]);
const ignoredScanDirectories = new Set([".git", "node_modules"]);
const isFrameworkSource = (path) => path === ".gitignore" || /\.(?:js|mjs|ts|json|jsonc|md|ya?ml)$/.test(path);

function openCodeOnlyErrors(scanRoot) {
  const failures = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name);
      const path = relative(scanRoot, absolute).replaceAll("\\", "/");
      if (scanExclusions.has(path) || (entry.isDirectory() && ignoredScanDirectories.has(entry.name))) continue;
      let forbiddenArtifact = false;
      for (const artifact of prohibitedArtifacts) {
        if (path === artifact || path.startsWith(`${artifact}/`)) {
          failures.push(`prohibited integration artifact "${artifact}": ${path}`);
          forbiddenArtifact = true;
          break;
        }
      }
      if (forbiddenArtifact) continue;
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile() && isFrameworkSource(path)) {
        const text = readFileSync(absolute, "utf8");
        for (const marker of prohibitedMarkers) {
          if (text.includes(marker)) failures.push(`prohibited integration marker "${marker}" in ${path}`);
        }
      }
    }
  };
  visit(scanRoot);
  return failures;
}

const scanOnlyArg = process.argv.find((arg) => arg.startsWith("--open-code-only-scan-root="));
if (scanOnlyArg) {
  const scanRoot = resolve(scanOnlyArg.slice(scanOnlyArg.indexOf("=") + 1));
  const scanErrors = openCodeOnlyErrors(scanRoot);
  if (scanErrors.length) {
    console.error(scanErrors.map((error) => `ERROR ${error}`).join("\n"));
    process.exit(1);
  }
  console.log("OpenCode-only source validation passed");
  process.exit(0);
}
errors.push(...openCodeOnlyErrors(root));

if (!statSync(join(root, "opencode.json"))) errors.push("missing opencode.json");
for (const required of ["docs/Installation.md", "docs/Getting-Started.md", "docs/Greenfield-Case-Study.md", "docs/Brownfield-Case-Study.md", "scripts/install.mjs"]) {
  if (!statSync(join(root, required), { throwIfNoEntry: false })) errors.push(`missing ${required}`);
}
for (const required of [".github/workflows/release.yml", ".github/workflows/validate.yml"]) {
  if (!existsSync(join(root, required))) errors.push(`missing ${required}`);
}
if (existsSync(join(root, ".github/workflows/release.yml"))) {
  const releaseWorkflow = read(".github/workflows/release.yml");
  const releaseContract = [
    ["release:\n    types: [published]", "published GitHub Release trigger"],
    ["workflow_dispatch:", "manual recovery trigger"],
    ["github.event.release.tag_name || inputs.tag", "release-tag source"],
    ['npm version "$release_version" --no-git-tag-version --allow-same-version', "tag-derived package version"],
    ["id-token: write", "npm OIDC permission"],
    ["npm publish --access public --provenance --tag", "public npm publish step"],
    ["if: github.event_name == 'release'", "release-only whitespace check that does not block historical recovery"],
    ["actions/checkout@v7", "Node.js 24-compatible checkout action"],
    ["actions/setup-node@v7", "Node.js 24-compatible setup-node action"],
  ];
  for (const [text, purpose] of releaseContract) {
    if (!releaseWorkflow.includes(text)) errors.push(`release.yml: missing ${purpose}`);
  }
  if (/^\s*environment:/m.test(releaseWorkflow)) errors.push("release.yml: environment gates make npm publication wait for approval");
}
if (existsSync(join(root, ".github/workflows/validate.yml"))) {
  const validationWorkflow = read(".github/workflows/validate.yml");
  for (const test of ["npm run test:misses", "npm run test:install"]) {
    if (!validationWorkflow.includes(test)) errors.push(`validate.yml: missing ${test}`);
  }
  for (const action of ["actions/checkout@v7", "actions/setup-node@v7"]) {
    if (!validationWorkflow.includes(action)) errors.push(`validate.yml: missing Node.js 24-compatible ${action}`);
  }
}
for (const name of readdirSync(join(root, "docs"))) {
  if (/^[A-Z0-9_-]+\.md$/.test(name)) errors.push(`docs/${name}: use Pascal/kebab-case, not all caps`);
}
const config = JSON.parse(read("opencode.json"));
if (!Array.isArray(config.plugin) || !config.plugin.includes("./.opencode/plugin/spec-guardrails.ts")) errors.push("plugin is not explicitly registered");
if (!Array.isArray(config.plugin) || !config.plugin.includes("./.opencode/plugin/yolo.ts")) errors.push("yolo plugin is not explicitly registered in opencode.json");
if (config.plugin?.indexOf("./.opencode/plugin/spec-guardrails.ts") > config.plugin?.indexOf("./.opencode/plugin/yolo.ts")) errors.push("opencode.json: spec-guardrails.ts must be registered before yolo.ts (forbidden writes are blocked before YOLO can allow them)");
for (const f of ["harness/opencode/plugin/yolo-policy.mjs", "harness/opencode/plugin/yolo.ts", "scripts/playbook-yolo.mjs", "docs/YOLO-Mode-Guide.md"]) {
  if (!existsSync(join(root, f))) errors.push(`missing ${f}`);
}
if (!read("AGENTS.md").includes("## YOLO mode")) errors.push("AGENTS.md: missing the '## YOLO mode' standing rules");
if (!read("templates/agents-md-template.md").includes("## YOLO mode")) errors.push("templates/agents-md-template.md: missing the '## YOLO mode' standing rules");
for (const f of files("harness/opencode/command", ".md")) {
  const text = read(join("harness/opencode/command", f));
  if (!text.startsWith("---")) errors.push(`${f}: missing frontmatter`);
}
const specs = new Set(files("templates/commands", ".md").filter((f) => f !== "README.md"));
const runnable = new Set(files("harness/opencode/command", ".md"));
for (const f of specs) if (!runnable.has(f)) errors.push(`missing runnable command for ${f}`);
for (const f of runnable) if (!specs.has(f)) errors.push(`missing command spec for ${f}`);
for (const f of readdirSync(join(root, "diagrams"))) {
  if (f.endsWith(".mmd") && !/^([\s\S]*)$/.test(read(join("diagrams", f)))) errors.push(`${f}: unreadable Mermaid source`);
}
for (const f of ["README.md", "phases/06-verification-results-gate.md", "templates/checklist-item-template.md"]) {
  const text = read(f);
  for (const v of verdicts) if (f.includes("checklist") && v === "DATA-GAP" && !text.includes(v)) errors.push(`${f}: missing ${v}`);
}
for (const f of readdirSync(join(root, "harness/opencode/command"))) {
  if (!f.endsWith(".md")) continue;
  const text = read(join("harness/opencode/command", f));
  if (/(curl\s+[^\n]*-u\s+|\s-P\s+(<[^>]+>|\S+))/.test(text)) errors.push(`${f}: credential-bearing command example`);
}

// ── miss stream (verification/telemetry/misses.ndjson — durable, committed) ─
// Vocabulary and linkage checks run whenever the stream exists (absent is a
// valid opt-in state). The §0.2 reporting judgements — why_missed "n of N
// assessed" (null is "not assessed", never a zero), FIELD_SINCE drops and
// escapes_missing_why — plus orphan miss-fix / miss-amend detection and the
// append-only amend invariant all live in miss-lib.mjs, so the emitter, the
// joiner and this validator can never disagree on a definition.
const missRuntime = ["scripts/miss-lib.mjs", "scripts/playbook-miss.mjs", "scripts/playbook-telemetry.mjs"];
const missCommands = ["harness/opencode/command/log-miss.md", "templates/commands/log-miss.md"];
for (const f of [...missRuntime, ...missCommands]) {
  if (!existsSync(join(root, f))) errors.push(`missing ${f} — the miss-stream contract (docs/Miss-Telemetry-AI-First-Playbook.md)`);
}
for (const f of ["scripts/playbook-miss.mjs", "scripts/playbook-telemetry.mjs", "scripts/playbook-validate.mjs"]) {
  if (existsSync(join(root, f)) && !/from\s+["']\.\/miss-lib\.mjs["']/.test(read(f))) {
    errors.push(`${f}: miss stream logic must flow through scripts/miss-lib.mjs`);
  }
}

const itemTemplate = read("templates/checklist-item-template.md");
if (!/"misses"\s*:\s*\[\s*\]/.test(itemTemplate)) errors.push("templates/checklist-item-template.md: metadata example must include a misses array");
const metadata = read("templates/checklist-metadata.yml");
const metadataRequired = metadata.match(/^required:\s*\[([^\]]*)\]/m)?.[1] ?? "";
if (!/(^|,)\s*misses\s*(,|$)/.test(metadataRequired) || !/^misses:\s*$/m.test(metadata)) {
  errors.push("templates/checklist-metadata.yml: required item metadata must define misses");
}

const ignoreLines = read(".gitignore").split("\n")
  .map((line) => line.trim()).filter((line) => line && !line.startsWith("#"))
  .map((line) => line.replace(/^\//, ""));
if (!ignoreLines.includes("verification/telemetry/events.ndjson")) {
  errors.push(".gitignore: ignore verification/telemetry/events.ndjson selectively");
}
if (ignoreLines.some((line) => /^verification\/telemetry\/(?:\*{1,2})?\/?$/.test(line))) {
  errors.push(".gitignore: do not ignore the broad verification/telemetry directory; misses.ndjson is durable");
}
if (ignoreLines.includes("verification/telemetry/misses.ndjson")) {
  errors.push(".gitignore: verification/telemetry/misses.ndjson must remain durable and committable");
}

const tierConfig = parseTiersYaml(read("playbook/model-tiers.yml"));
if (!tierConfig.commands?.["log-miss"]) errors.push("playbook/model-tiers.yml: commands must assign log-miss a tier");

const missesPath = join(root, "verification/telemetry/misses.ndjson");
if (existsSync(missesPath)) {
  const { records, malformed } = readMisses(missesPath);
  for (const line of malformed) errors.push(`misses.ndjson: unparseable line: ${line.slice(0, 80)} — the stream is append-only; correct forward with a new record, never an edit`);
  const { errors: missErrors, notes } = validateMisses(records);
  for (const e of missErrors) errors.push(`misses.ndjson: ${e}`);
  for (const n of notes) console.log(`misses: ${n}`);
}

if (errors.length) { console.error(errors.map((e) => `ERROR ${e}`).join("\n")); process.exit(1); }
console.log("playbook validation passed");
