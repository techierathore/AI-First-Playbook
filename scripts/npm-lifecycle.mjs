#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = process.env.INIT_CWD ? resolve(process.env.INIT_CWD) : null;
const mode = process.argv[2];
const dependencyInstall = ["install", "ci"].includes(process.env.npm_command)
  && target
  && target !== packageRoot;

if (!dependencyInstall) process.exit(0);

const statePath = join(tmpdir(), `aifp-npm-install-${createHash("sha256").update(target).digest("hex").slice(0, 16)}.json`);

if (mode === "prepare") {
  // The cleanup step decides clean-dir vs real-project on its own (after npm has
  // finished placing packages), so we only need to remember the install target.
  writeFileSync(statePath, JSON.stringify({ target }), { mode: 0o600 });
  process.exit(0);
}

if (mode !== "install" || !existsSync(statePath)) {
  console.error("AI-First Playbook npm lifecycle state is missing; use npx @techierathore/ai-first-playbook@latest install");
  process.exit(1);
}

const installed = spawnSync(process.execPath, [join(packageRoot, "scripts/install.mjs"), "install", `--target=${target}`], {
  cwd: target,
  env: process.env,
  stdio: "inherit",
});
if (installed.status !== 0) process.exit(installed.status ?? 1);

const cleanup = spawn(process.execPath, [join(packageRoot, "scripts/npm-cleanup.mjs"), statePath], {
  cwd: target,
  detached: true,
  stdio: "ignore",
  windowsHide: true,
});
cleanup.unref();
console.log("AI-First Playbook installed; removing temporary npm dependency artifacts.");
