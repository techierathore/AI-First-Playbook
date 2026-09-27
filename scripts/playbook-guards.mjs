#!/usr/bin/env node
/**
 * playbook-guards.mjs — are the Playbook's guard plugins loaded?
 *
 *   node .playbook/scripts/playbook-guards.mjs           inside an OpenCode session (shell tool)
 *   node .playbook/scripts/playbook-guards.mjs --config  before a session: check .opencode/opencode.json
 *
 * A plugin that did not load cannot say so itself. Each guard plugin, once
 * loaded, adds its name to PLAYBOOK_GUARDS for every shell command it sees
 * (guard-signal.mjs), so inside a session a missing name means that plugin is
 * not running. Outside a session the config is checked instead: OpenCode 2
 * skips a plugin configured as a single file ("configured plugin path must be
 * a directory"), so every plugin must be a directory with index.ts
 * (OpenCode 1) and server.ts (OpenCode 2), listed in load order.
 *
 * Prints one line and exits 0 when all guards are present; otherwise prints a
 * loud banner naming what is missing and why, and exits 3.
 */
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const GUARD_PLUGINS = ["telemetry", "spec-guardrails", "yolo"];

/** Problems with the plugin entries of <root>/.opencode/opencode.json. */
export function configProblems(root) {
  const configPath = join(root, ".opencode", "opencode.json");
  if (!existsSync(configPath)) return [`${configPath} does not exist: the Playbook is not installed here`];
  let config;
  try { config = JSON.parse(readFileSync(configPath, "utf8")); } catch (error) { return [`.opencode/opencode.json is not valid JSON: ${error.message}`]; }
  const entries = Array.isArray(config.plugin) ? config.plugin : [];
  const problems = [];
  const names = [];
  for (const entry of entries) {
    const spec = String(Array.isArray(entry) ? entry[0] : entry);
    const path = resolve(join(root, ".opencode"), spec);
    const name = spec.replace(/\/+$/, "").split("/").pop().replace(/\.(ts|js|mjs)$/, "");
    if (!GUARD_PLUGINS.includes(name)) continue;
    names.push(name);
    if (!existsSync(path)) { problems.push(`plugin ${spec} does not exist`); continue; }
    if (!statSync(path).isDirectory()) { problems.push(`plugin ${spec} is a file; OpenCode 2 loads a configured plugin only as a directory`); continue; }
    for (const file of ["index.ts", "server.ts"]) if (!existsSync(join(path, file))) problems.push(`plugin ${spec} has no ${file} (${file === "index.ts" ? "OpenCode 1" : "OpenCode 2"} entry)`);
  }
  const missing = GUARD_PLUGINS.filter((n) => !names.includes(n));
  if (missing.length) problems.push(`.opencode/opencode.json does not load ${missing.join(", ")}`);
  else if (names.join(",") !== GUARD_PLUGINS.join(",")) problems.push(`plugins load as ${names.join(", ")}, not ${GUARD_PLUGINS.join(", ")}`);
  return problems;
}

/** Guard plugins absent from a PLAYBOOK_GUARDS value. */
export function missingGuards(value) {
  const present = String(value ?? "").split(",").map((s) => s.trim());
  return GUARD_PLUGINS.filter((n) => !present.includes(n));
}

export function banner(missing, causes) {
  return [
    `!!! PLAYBOOK GUARDS NOT LOADED: ${missing.join(", ")} !!!`,
    "This session is UNGUARDED: the Verifier write boundary, the git-history block and YOLO's git denial may all be off.",
    ...causes.map((c) => `cause: ${c}`),
    "fix: run `npx @techierathore/ai-first-playbook install --force` in the project, then restart OpenCode (supported: 1.18.32, 2.0.18).",
    "Write nothing until a human has fixed this.",
  ].join("\n");
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const root = resolve(args.find((a) => a.startsWith("--root="))?.slice(7) ?? process.cwd());
  const problems = configProblems(root);
  if (args.includes("--config")) {
    if (problems.length) {
      console.log(banner(GUARD_PLUGINS, problems));
      process.exit(3);
    }
    console.log(`playbook-guards: .opencode/opencode.json loads ${GUARD_PLUGINS.join(", ")} as directories, in order`);
    process.exit(0);
  }
  const missing = missingGuards(process.env.PLAYBOOK_GUARDS);
  if (missing.length) {
    console.log(banner(missing, problems.length ? problems : ["the missing plugins did not mark this shell (PLAYBOOK_GUARDS), so OpenCode did not load them"]));
    process.exit(3);
  }
  console.log(`playbook-guards: loaded ${GUARD_PLUGINS.join(", ")}`);
}
