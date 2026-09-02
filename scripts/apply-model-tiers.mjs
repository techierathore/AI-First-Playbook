#!/usr/bin/env node
/**
 * apply-model-tiers.mjs — stamp per-phase model tiers into OpenCode frontmatter.
 *
 * Reads playbook/model-tiers.yml and writes/updates the `model:` field in the
 * YAML frontmatter of harness/opencode/command/*.md and
 * harness/opencode/agent/*.md (plus the repo's own .opencode/ mirror when the
 * same files exist there). Idempotent: re-running with a changed tier map
 * updates the stamps in place. OpenCode gives command-frontmatter `model:`
 * the highest precedence, so this is the entire OpenCode half of routing.
 *
 * Honours the map's top-level `enabled:` flag (OFF by default):
 *   enabled: true   → stamp every mapped file with its tier's model
 *   enabled: false  → REMOVE the `model:` field from every mapped file, so
 *                     routing is fully reversible and the OpenCode session
 *                     model applies again
 * A tier of `inherit` (or `none`) leaves that one file unrouted even when ON.
 *
 * Usage:
 *   node scripts/apply-model-tiers.mjs            # stamp (or strip, if disabled)
 *   node scripts/apply-model-tiers.mjs --check    # verify stamps match the map + flag (CI)
 *   node scripts/apply-model-tiers.mjs --print    # print the resolved OpenCode map
 *
 * The one-command front end is scripts/playbook-routing.mjs (status | on | off |
 * set-tier | set-model | set-escalation | bind) — it edits the map and calls
 * applyTiers() from here, so the two never disagree.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseTiersYaml, resolveModel, stampFrontmatter, removeFrontmatterField, readFrontmatterField, routingEnabled, UNROUTED_TIERS } from "./tier-lib.mjs";

export const root = fileURLToPath(new URL("..", import.meta.url));
export const tiersPath = join(root, "playbook/model-tiers.yml");

/** Primary targets (always expected to exist) and optional mirrors (skipped when absent). */
const TARGETS = [
  { dir: "harness/opencode/command", key: "commands", required: true },
  { dir: "harness/opencode/agent", key: "agents", required: true },
  { dir: ".opencode/command", key: "commands", required: false },
  { dir: ".opencode/agent", key: "agents", required: false },
];

export function loadConfig() {
  return parseTiersYaml(readFileSync(tiersPath, "utf8"));
}

/**
 * Apply (or check) the tier map. Returns { enabled, changed, problems, stamped, stripped, files }.
 * `files` lists every mapped file with its current vs expected model — used by `status`.
 */
export function applyTiers({ check = false, config = loadConfig(), log = () => {} } = {}) {
  const enabled = routingEnabled(config);
  const problems = [];
  const files = [];
  let stamped = 0, stripped = 0;

  for (const { dir, key, required } of TARGETS) {
    if (!required && !existsSync(join(root, dir))) continue;
    for (const [name, tier] of Object.entries(config[key] ?? {})) {
      const rel = `${dir}/${name}.md`;
      const file = join(root, rel);
      if (!existsSync(file)) { if (required) problems.push(`${rel}: file missing for tier map entry`); continue; }
      let expected = null;
      if (enabled && !UNROUTED_TIERS.has(tier)) {
        try { expected = resolveModel(config.tiers, tier); }
        catch (e) { problems.push(`${rel}: ${e.message}`); continue; }
      }
      const text = readFileSync(file, "utf8");
      const current = readFrontmatterField(text, "model");
      files.push({ file: rel, name, tier, current, expected });
      if (current === expected) continue;
      if (check) {
        problems.push(expected
          ? `${rel}: model is '${current ?? "(unset)"}', tier map says '${expected}'`
          : `${rel}: model is '${current}' but routing is ${enabled ? `'${tier}' (unrouted)` : "disabled"} — expected no model: stamp`);
        continue;
      }
      if (expected) {
        writeFileSync(file, stampFrontmatter(text, "model", expected));
        log(`stamped ${rel} → model: ${expected} (${tier})`);
        stamped++;
      } else {
        writeFileSync(file, removeFrontmatterField(text, "model"));
        log(`stripped ${rel} (model: ${current} removed)`);
        stripped++;
      }
    }
  }
  return { enabled, changed: stamped + stripped, stamped, stripped, problems, files };
}

export function printResolved(config) {
  const resolved = { enabled: routingEnabled(config), commands: {}, agents: {} };
  const res = (tier) => (UNROUTED_TIERS.has(tier) ? null : resolveModel(config.tiers, tier));
  for (const [name, tier] of Object.entries(config.commands ?? {})) resolved.commands[name] = res(tier);
  for (const [name, tier] of Object.entries(config.agents ?? {})) resolved.agents[name] = res(tier);
  return resolved;
}

// ── CLI ─────────────────────────────────────────────────────────────────────
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const unknown = args.filter((arg) => !["--check", "--print"].includes(arg));
  if (unknown.length) {
    console.error(`unknown option '${unknown[0]}' — OpenCode routing accepts only --check or --print`);
    process.exit(2);
  }
  const check = args.includes("--check");
  const print = args.includes("--print");
  const config = loadConfig();

  if (print) {
    console.log(JSON.stringify(printResolved(config), null, 2));
    process.exit(0);
  }

  const r = applyTiers({ check, config, log: console.log });
  if (r.problems.length) { console.error(r.problems.map((p) => `ERROR ${p}`).join("\n")); process.exit(1); }
  if (check) console.log(`model tier stamps match the tier map (routing ${r.enabled ? "ON" : "OFF"})`);
  else console.log(`done (routing ${r.enabled ? "ON" : "OFF"}; ${r.stamped} stamped, ${r.stripped} stripped)`);
}
