#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, cpSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageMetadata = JSON.parse(readFileSync(join(sourceRoot, "package.json"), "utf8"));
const args = process.argv.slice(2);
const targetArg = args.find((arg) => arg.startsWith("--target="));
const target = resolve(targetArg ? targetArg.slice("--target=".length) : process.cwd());
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");
const uninstall = args.includes("--uninstall");
const includeDocs = !args.includes("--no-docs");
const telemetryRuntime = [
  "scripts/playbook-miss.mjs",
  "scripts/miss-lib.mjs",
  "scripts/playbook-telemetry.mjs",
  "playbook/model-tiers.yml",
  "playbook/environment-profile.yml",
];
const copyItems = [".opencode", "opencode.json", "Context-Prompt.md", "AGENTS.md", ...telemetryRuntime];
if (includeDocs) copyItems.push("docs", "onboarding");
const created = [];

function usage() {
  console.log(`AI-First Playbook installer\n\nUsage:\n  npx @techierathore/ai-first-playbook --target=/path/to/repo [--dry-run] [--force]\n  npx @techierathore/ai-first-playbook --uninstall --target=/path/to/repo\n\nBy default existing files are preserved. --force overwrites only files managed by this package.`);
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

function copy(source, destination) {
  if (statSync(source).isDirectory()) {
    if (!existsSync(destination)) { console.log(`create ${relative(target, destination)}`); if (!dryRun) mkdirSync(destination, { recursive: true }); }
    for (const child of readdirSync(source)) copy(join(source, child), join(destination, child));
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
  for (const item of copyItems) copy(join(sourceRoot, item === ".opencode" ? "harness/opencode" : item), join(target, item));
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
  console.log("Next: replace placeholders in playbook/environment-profile.yml, run the smoke test in docs/Troubleshooting.md, and restart OpenCode.");
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
  if (!dryRun) rmSync(join(target, ".playbook"), { recursive: true, force: true });
}

try {
  if (args.includes("--help") || args.includes("-h")) usage();
  else if (uninstall) remove();
  else install();
} catch (error) {
  console.error(`Install failed: ${error.message}`);
  process.exit(1);
}
