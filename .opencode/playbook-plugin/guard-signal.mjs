/**
 * guard-signal.mjs — how a session learns which Playbook guard plugins loaded.
 *
 * A plugin that did not load cannot announce its own absence, so every guard
 * plugin, once loaded, leaves two marks the session can check from outside:
 *
 *   1. one system-prompt line per plugin, `[playbook-guard] <name> loaded`,
 *      which the standing rules (loaded by OpenCode as instructions, with or
 *      without plugins) tell the agent to look for before anything else;
 *   2. its name in PLAYBOOK_GUARDS for every shell command, which
 *      .playbook/scripts/playbook-guards.mjs reads and reports on.
 *
 * Pure functions only; shared by the OpenCode 1.x (index.ts) and 2.x
 * (server.ts) entry points. The .mjs extension keeps it out of OpenCode's
 * plugin auto-discovery.
 */

/** The guard plugins, in the order opencode.json loads them. */
export const GUARD_PLUGINS = ["telemetry", "spec-guardrails", "yolo"];

export const GUARD_ENV = "PLAYBOOK_GUARDS";

export function guardLine(name) {
  return `[playbook-guard] ${name} loaded`;
}

/** Add `name` to a PLAYBOOK_GUARDS value, keeping the load order. */
export function withGuard(value, name) {
  const present = new Set(String(value ?? "").split(",").map((s) => s.trim()).filter(Boolean));
  present.add(name);
  return [...GUARD_PLUGINS.filter((n) => present.has(n)), ...[...present].filter((n) => !GUARD_PLUGINS.includes(n))].join(",");
}
