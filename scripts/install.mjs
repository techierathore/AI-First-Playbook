#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, cpSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageMetadata = JSON.parse(readFileSync(join(sourceRoot, "package.json"), "utf8"));
const args = process.argv.slice(2);
const command = args.find((arg) => !arg.startsWith("-"));
const targetArg = args.find((arg) => arg.startsWith("--target="));
const target = resolve(targetArg ? targetArg.slice("--target=".length) : process.cwd());
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");
const uninstall = args.includes("--uninstall") || command === "uninstall";
const includeDocs = !args.includes("--no-docs");
const manageGitignore = !args.includes("--no-gitignore");
const telemetryRuntime = [
  "scripts/playbook-miss.mjs",
  "scripts/miss-lib.mjs",
  "scripts/playbook-telemetry.mjs",
  "playbook/model-tiers.yml",
  "playbook/environment-profile.yml",
];
const copyItems = ["opencode.json", "AGENTS.md", ...telemetryRuntime];
const operatorAssets = [
  "onboarding",
  "phases",
  "templates/checklist-item-template.md",
  "templates/checklist-metadata.yml",
  "templates/deployment-steps-template.md",
  "templates/handoffs",
  "templates/issues-file-template.md",
];
const userDocs = [
  "Adoption-Metrics.md",
  "Brownfield-Case-Study.md",
  "Environment-Profile.md",
  "Getting-Started.md",
  "Greenfield-Case-Study.md",
  "Handoffs.md",
  "Installation.md",
  "OpenCode-WSL-Setup-Guide.md",
  "Operating-Model.md",
  "Release-And-Operations.md",
  "Repository-Structure.md",
  "Security.md",
  "Telemetry-Guide.md",
  "Troubleshooting.md",
  "Usage.md",
  "YOLO-Mode-Guide.md",
];
const harnessExclusions = new Set(["command/update-context.md"]);
const created = [];
const gitignoreStart = "# >>> AI-First Playbook framework (managed) >>>";
const gitignoreEnd = "# <<< AI-First Playbook framework (managed) <<<";
const frameworkIgnoreRules = [
  "/.opencode/",
  "/.playbook/",
  "/AGENTS.md",
  "/opencode.json",
  "/onboarding/",
  "/phases/",
  "/playbook/",
  "/scripts/miss-lib.mjs",
  "/scripts/playbook-miss.mjs",
  "/scripts/playbook-telemetry.mjs",
  "/templates/checklist-item-template.md",
  "/templates/checklist-metadata.yml",
  "/templates/deployment-steps-template.md",
  "/templates/handoffs/",
  "/templates/issues-file-template.md",
  "/verification/telemetry/events.ndjson",
];

function usage() {
  console.log(`AI-First Playbook installer\n\nUsage:\n  cd /path/to/repo && npx @techierathore/ai-first-playbook@latest install [--dry-run] [--force]\n  npx @techierathore/ai-first-playbook@latest install --target=/path/to/repo [--dry-run] [--force]\n  npx @techierathore/ai-first-playbook@latest uninstall --target=/path/to/repo [--dry-run] [--force]\n\nThe target defaults to the current directory. Existing files are preserved. The installer adds a managed .gitignore block for reinstallable framework assets; use --no-gitignore to opt out. --force overwrites only files managed by this package.`);
}

function replaceManagedBlock(content, replacement) {
  const start = content.indexOf(gitignoreStart);
  const end = content.indexOf(gitignoreEnd);
  if ((start === -1) !== (end === -1) || (start !== -1 && end < start)) {
    throw new Error("Existing .gitignore has an invalid AI-First Playbook managed block");
  }
  if (start === -1 && !replacement) return content;
  const withoutBlock = start === -1
    ? content
    : `${content.slice(0, start)}${content.slice(end + gitignoreEnd.length)}`;
  const projectRules = withoutBlock.replace(/\n+$/, "");
  if (!replacement) return projectRules ? `${projectRules}\n` : "";
  return `${projectRules ? `${projectRules}\n\n` : ""}${replacement}\n`;
}

function updateGitignore(remove = false, additionalRules = []) {
  const path = join(target, ".gitignore");
  const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
  const block = remove ? "" : [gitignoreStart, ...frameworkIgnoreRules, ...additionalRules, gitignoreEnd].join("\n");
  const next = replaceManagedBlock(existing, block);
  if (next === existing) return;
  console.log(`${remove ? "update" : existsSync(path) ? "update" : "create"} .gitignore`);
  if (!dryRun) writeFileSync(path, next);
}

function ensureSafeTarget() {
  if (target === sourceRoot) throw new Error("Refusing to install into the framework source directory");
  if (target === "/" || target === resolve(process.env.HOME || "/")) throw new Error("Refusing to install into a filesystem or home root");
  if (!existsSync(target)) {
    if (!dryRun) mkdirSync(target, { recursive: true });
    return;
  }
  if (!statSync(target).isDirectory()) throw new Error(`Target is not a directory: ${target}`);
}

function copy(source, destination, exclusions = new Set(), base = source) {
  const sourceRelative = relative(base, source).replaceAll("\\", "/");
  if (exclusions.has(sourceRelative)) return;
  if (statSync(source).isDirectory()) {
    if (!existsSync(destination)) { console.log(`create ${relative(target, destination)}`); if (!dryRun) mkdirSync(destination, { recursive: true }); }
    for (const child of readdirSync(source)) copy(join(source, child), join(destination, child), exclusions, base);
    return;
  }
  const exists = existsSync(destination);
  if (exists && !force) { console.log(`preserve ${relative(target, destination)}`); return; }
  console.log(`${exists ? "overwrite" : "create"} ${relative(target, destination)}`);
  if (!dryRun) {
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(source, destination, { force: true });
    if (!exists) created.push(relative(target, destination));
  }
}

function install() {
  ensureSafeTarget();
  for (const item of telemetryRuntime) {
    if (!existsSync(join(sourceRoot, item))) throw new Error(`Package is missing required telemetry runtime: ${item}`);
  }
  const markerPath = join(target, ".playbook", "installation.json");
  let previouslyCreated = [];
  if (existsSync(markerPath)) {
    try { previouslyCreated = JSON.parse(readFileSync(markerPath, "utf8")).created ?? []; }
    catch { throw new Error("Existing .playbook/installation.json is invalid; refusing to replace its ownership record"); }
  }
  const harnessSource = join(sourceRoot, "harness/opencode");
  copy(harnessSource, join(target, ".opencode"), harnessExclusions, harnessSource);
  for (const item of copyItems) copy(join(sourceRoot, item), join(target, item));
  if (includeDocs) {
    for (const file of userDocs) copy(join(sourceRoot, "docs", file), join(target, "docs", file));
    for (const item of operatorAssets) copy(join(sourceRoot, item), join(target, item));
  }
  const ownedFiles = new Set([...previouslyCreated, ...created]);
  const ownedDocRules = userDocs
    .filter((file) => ownedFiles.has(`docs/${file}`))
    .map((file) => `/docs/${file}`);
  if (manageGitignore) updateGitignore(false, ownedDocRules);
  if (!dryRun) {
    const marker = {
      package: packageMetadata.name,
      version: packageMetadata.version,
      created: [...new Set([...previouslyCreated, ...created])],
      installed_at: new Date().toISOString(),
    };
    mkdirSync(join(target, ".playbook"), { recursive: true });
    writeFileSync(markerPath, `${JSON.stringify(marker, null, 2)}\n`);
    const missing = telemetryRuntime.filter((item) => !existsSync(join(target, item)));
    if (missing.length) throw new Error(`Telemetry runtime verification failed; missing: ${missing.join(", ")}`);
    console.log(`verified telemetry runtime (${telemetryRuntime.length} files)`);
  }
  console.log(`${dryRun ? "Would install" : "Installed"} AI-First Playbook in ${target}`);
  if (manageGitignore) console.log("Framework assets, including installed framework docs, are ignored; project-created docs and verification evidence remain trackable.");
  const smokeTest = includeDocs ? "run the smoke test in docs/Troubleshooting.md, and " : "run your approved smoke test, and ";
  console.log(`Next: replace placeholders in playbook/environment-profile.yml, ${smokeTest}restart OpenCode.`);
}

function remove() {
  ensureSafeTarget();
  const markerPath = join(target, ".playbook", "installation.json");
  if (!existsSync(markerPath)) throw new Error("No .playbook/installation.json found; refusing unmanaged uninstall");
  const marker = JSON.parse(readFileSync(markerPath, "utf8"));
  for (const item of marker.created || []) {
    const path = join(target, item);
    if (existsSync(path) && force) {
      console.log(`remove ${item}`);
      if (!dryRun) rmSync(path, { recursive: true, force: true });
    } else console.log(`preserve ${item} (use --force after reviewing local changes)`);
  }
  if (manageGitignore) updateGitignore(true);
  if (!dryRun) rmSync(join(target, ".playbook"), { recursive: true, force: true });
}

try {
  if (command && !["install", "uninstall"].includes(command)) throw new Error(`Unknown command: ${command}`);
  if (args.includes("--help") || args.includes("-h")) usage();
  else if (uninstall) remove();
  else install();
} catch (error) {
  console.error(`Install failed: ${error.message}`);
  process.exit(1);
}
