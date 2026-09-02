#!/usr/bin/env node
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = process.env.INIT_CWD ? resolve(process.env.INIT_CWD) : null;
const npmCommand = process.env.npm_command;

// npx must remain side-effect free until the requested CLI command runs.
if (!target || !["install", "ci"].includes(npmCommand) || process.env.npm_config_global === "true") process.exit(0);
if (target === packageRoot) process.exit(0);

const result = spawnSync(process.execPath, [join(packageRoot, "scripts/install.mjs"), "install", `--target=${target}`], {
  cwd: target,
  env: process.env,
  stdio: "inherit",
});

if (result.error) {
  console.error(`AI-First Playbook: automatic project installation failed: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
