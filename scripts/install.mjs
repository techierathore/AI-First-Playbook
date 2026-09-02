#!/usr/bin/env node
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, rmdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
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
const includeGuides = args.includes("--with-guides") && !args.includes("--no-docs");
const manageGitignore = !args.includes("--no-gitignore");
const runtimeMappings = [
  ["scripts/playbook-miss.mjs", ".playbook/scripts/playbook-miss.mjs"],
  ["scripts/miss-lib.mjs", ".playbook/scripts/miss-lib.mjs"],
  ["scripts/playbook-telemetry.mjs", ".playbook/scripts/playbook-telemetry.mjs"],
  ["playbook/model-tiers.yml", ".playbook/model-tiers.yml"],
  ["playbook/environment-profile.yml", ".playbook/environment-profile.yml"],
];
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
const managed = new Set();
let ownedBeforeInstall = new Set();
const gitignoreStart = "# >>> AI-First Playbook framework (managed) >>>";
const gitignoreEnd = "# <<< AI-First Playbook framework (managed) <<<";
const frameworkIgnoreRules = [
  "/.opencode/",
  "/.playbook/",
  "/verification/telemetry/events.ndjson",
];
const supportedManagedPaths = new Set();
addMappedFiles(join(sourceRoot, "harness/opencode"), ".opencode", harnessExclusions, join(sourceRoot, "harness/opencode"));
for (const [source, destination] of runtimeMappings) {
  supportedManagedPaths.add(source);
  supportedManagedPaths.add(destination);
}
supportedManagedPaths.add("AGENTS.md");
supportedManagedPaths.add("opencode.json");
supportedManagedPaths.add(".playbook/AGENTS.md");
for (const file of userDocs) {
  supportedManagedPaths.add(`docs/${file}`);
  supportedManagedPaths.add(`.playbook/guides/docs/${file}`);
}
for (const item of operatorAssets) {
  addMappedFiles(join(sourceRoot, item), item);
  addMappedFiles(join(sourceRoot, item), `.playbook/guides/${item}`);
}

function addMappedFiles(source, destination, exclusions = new Set(), base = source) {
  const sourceRelative = relative(base, source).replaceAll("\\", "/");
  if (exclusions.has(sourceRelative)) return;
  if (statSync(source).isDirectory()) {
    for (const child of readdirSync(source)) addMappedFiles(join(source, child), `${destination}/${child}`, exclusions, base);
  } else {
    supportedManagedPaths.add(destination.replaceAll("\\", "/"));
  }
}

function usage() {
  console.log(`AI-First Playbook installer\n\nUsage:\n  cd /path/to/repo && npx @techierathore/ai-first-playbook@latest install [--dry-run] [--force]\n  npx @techierathore/ai-first-playbook@latest install --target=/path/to/repo [--dry-run] [--force]\n  npx @techierathore/ai-first-playbook@latest uninstall --target=/path/to/repo [--dry-run] [--force]\n\nThe target defaults to the current directory. The default payload is only .opencode/ and .playbook/. Add --with-guides to place optional reference material under .playbook/guides/. Existing files are preserved. The installer adds a managed .gitignore block; use --no-gitignore to opt out. --force overwrites only files managed by this package.`);
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

function updateGitignore(remove = false) {
  const path = join(target, ".gitignore");
  assertNoSymlinkPath(path);
  const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
  const block = remove ? "" : [gitignoreStart, ...frameworkIgnoreRules, gitignoreEnd].join("\n");
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
  if (lstatSync(target).isSymbolicLink()) throw new Error(`Refusing symbolic-link target: ${target}`);
  if (!statSync(target).isDirectory()) throw new Error(`Target is not a directory: ${target}`);
}

function managedPath(value) {
  if (typeof value !== "string" || !value || isAbsolute(value)) throw new Error(`Invalid managed path in installation record: ${value}`);
  const normalized = relative(target, resolve(target, value));
  if (!normalized || normalized === ".." || normalized.startsWith(`..${sep}`) || isAbsolute(normalized)) {
    throw new Error(`Managed path escapes the target: ${value}`);
  }
  return normalized.replaceAll("\\", "/");
}

function assertNoSymlinkPath(path) {
  const normalized = relative(target, resolve(path));
  if (normalized === ".." || normalized.startsWith(`..${sep}`) || isAbsolute(normalized)) throw new Error(`Path escapes the target: ${path}`);
  let current = target;
  for (const part of normalized.split(sep).filter(Boolean)) {
    current = join(current, part);
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) throw new Error(`Refusing symbolic link in managed path: ${relative(target, current)}`);
  }
}

function readMarker(markerPath) {
  if (!existsSync(markerPath)) return null;
  assertNoSymlinkPath(markerPath);
  const marker = JSON.parse(readFileSync(markerPath, "utf8"));
  if (marker.package !== packageMetadata.name || !Array.isArray(marker.created)) {
    throw new Error("Existing .playbook/installation.json is not a valid ownership record for this package");
  }
  marker.created = marker.created.map(managedPath);
  const unsupported = marker.created.find((path) => !supportedManagedPaths.has(path));
  if (unsupported) throw new Error(`Installation record contains an unsupported managed path: ${unsupported}`);
  return marker;
}

function pruneEmptyParents(path) {
  let directory = dirname(path);
  while (directory !== target && directory.startsWith(`${target}${sep}`) && existsSync(directory) && readdirSync(directory).length === 0) {
    rmdirSync(directory);
    directory = dirname(directory);
  }
}

function removeManagedFile(item) {
  const path = join(target, managedPath(item));
  assertNoSymlinkPath(path);
  if (!existsSync(path)) return true;
  if (!statSync(path).isFile()) throw new Error(`Managed path is not a file: ${item}`);
  console.log(`remove ${item}`);
  if (!dryRun) {
    rmSync(path);
    pruneEmptyParents(path);
  }
  return true;
}

function copy(source, destination, exclusions = new Set(), base = source, replacements = []) {
  const sourceRelative = relative(base, source).replaceAll("\\", "/");
  if (exclusions.has(sourceRelative)) return;
  assertNoSymlinkPath(destination);
  if (statSync(source).isDirectory()) {
    if (!existsSync(destination)) { console.log(`create ${relative(target, destination)}`); if (!dryRun) mkdirSync(destination, { recursive: true }); }
    for (const child of readdirSync(source)) copy(join(source, child), join(destination, child), exclusions, base, replacements);
    return;
  }
  const exists = existsSync(destination);
  const destinationRelative = relative(target, destination).replaceAll("\\", "/");
  managed.add(destinationRelative);
  if (exists && (!force || !ownedBeforeInstall.has(destinationRelative))) { console.log(`preserve ${destinationRelative}`); return; }
  console.log(`${exists ? "overwrite" : "create"} ${destinationRelative}`);
  if (!dryRun) {
    mkdirSync(dirname(destination), { recursive: true });
    if (replacements.length) {
      let content = readFileSync(source, "utf8");
      for (const [from, to] of replacements) content = content.replaceAll(from, to);
      writeFileSync(destination, content);
    } else cpSync(source, destination, { force: true });
    if (!exists) created.push(destinationRelative);
  }
}

function copyText(source, destination, replacements) {
  const exists = existsSync(destination);
  const destinationRelative = relative(target, destination).replaceAll("\\", "/");
  assertNoSymlinkPath(destination);
  managed.add(destinationRelative);
  if (exists && (!force || !ownedBeforeInstall.has(destinationRelative))) { console.log(`preserve ${destinationRelative}`); return; }
  let content = readFileSync(source, "utf8");
  for (const [from, to] of replacements) content = content.replaceAll(from, to);
  console.log(`${exists ? "overwrite" : "create"} ${relative(target, destination)}`);
  if (!dryRun) {
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, content);
    if (!exists) created.push(destinationRelative);
  }
}

function install() {
  ensureSafeTarget();
  for (const [source] of runtimeMappings) {
    if (!existsSync(join(sourceRoot, source))) throw new Error(`Package is missing required runtime asset: ${source}`);
  }
  const markerPath = join(target, ".playbook", "installation.json");
  let previouslyCreated = [];
  try { previouslyCreated = readMarker(markerPath)?.created ?? []; }
  catch (error) { throw new Error(`${error.message}; refusing to replace it`); }
  ownedBeforeInstall = new Set(previouslyCreated);
  const harnessSource = join(sourceRoot, "harness/opencode");
  copy(harnessSource, join(target, ".opencode"), harnessExclusions, harnessSource, [
    ["`AGENTS.md` at the repo root", "`.playbook/AGENTS.md`"],
    ["`AGENTS.md`", "`.playbook/AGENTS.md`"],
  ]);
  for (const [source, destination] of runtimeMappings) copy(join(sourceRoot, source), join(target, destination));
  copyText(join(sourceRoot, "AGENTS.md"), join(target, ".playbook", "AGENTS.md"), [
    ["playbook/environment-profile.yml", ".playbook/environment-profile.yml"],
    ["scripts/playbook-miss.mjs", ".playbook/scripts/playbook-miss.mjs"],
  ]);
  if (includeGuides) {
    for (const file of userDocs) copy(join(sourceRoot, "docs", file), join(target, ".playbook", "guides", "docs", file));
    for (const item of operatorAssets) copy(join(sourceRoot, item), join(target, ".playbook", "guides", item));
  }
  const removed = new Set();
  if (force) for (const item of previouslyCreated.filter((path) => !managed.has(path))) {
    if (removeManagedFile(item)) removed.add(item);
  }
  if (manageGitignore) updateGitignore();
  if (!dryRun) {
    const stillOwned = previouslyCreated.filter((path) => !removed.has(path) && existsSync(join(target, path)));
    const marker = {
      package: packageMetadata.name,
      version: packageMetadata.version,
      created: [...new Set([...stillOwned, ...created])],
      installed_at: new Date().toISOString(),
    };
    mkdirSync(join(target, ".playbook"), { recursive: true });
    writeFileSync(markerPath, `${JSON.stringify(marker, null, 2)}\n`);
    const missing = runtimeMappings.map(([, destination]) => destination).filter((item) => !existsSync(join(target, item)));
    if (missing.length) throw new Error(`Telemetry runtime verification failed; missing: ${missing.join(", ")}`);
    console.log(`verified hidden runtime (${runtimeMappings.length} files)`);
  }
  console.log(`${dryRun ? "Would install" : "Installed"} AI-First Playbook in ${target}`);
  if (manageGitignore) console.log("The hidden .opencode/ and .playbook/ framework copies are covered by the managed .gitignore block.");
  console.log("Next: replace placeholders in .playbook/environment-profile.yml, run your approved smoke test, and restart OpenCode.");
}

function remove() {
  ensureSafeTarget();
  const markerPath = join(target, ".playbook", "installation.json");
  if (!existsSync(markerPath)) throw new Error("No .playbook/installation.json found; refusing unmanaged uninstall");
  const marker = readMarker(markerPath);
  if (!force) {
    for (const item of marker.created) console.log(`preserve ${item} (use --force after reviewing local changes)`);
    console.log("No files were removed; rerun with --force after reviewing local changes.");
    return;
  }
  for (const item of marker.created) removeManagedFile(item);
  if (manageGitignore) updateGitignore(true);
  console.log("remove .playbook/installation.json");
  if (!dryRun) {
    rmSync(markerPath);
    pruneEmptyParents(markerPath);
  }
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
