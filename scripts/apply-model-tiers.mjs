#!/usr/bin/env node
/**
 * apply-model-tiers.mjs — stamp per-phase model tiers into OpenCode frontmatter.
 *
 * Reads playbook/model-tiers.yml and writes/updates the `model:` field in the
 * YAML frontmatter of harness/opencode/command/*.md and
 * harness/opencode/agent/*.md. Idempotent: re-running with a changed tier map
 * updates the stamps in place. OpenCode gives command-frontmatter `model:`
 * the highest precedence, so this is the entire OpenCode half of routing.
 *
 * Usage:
 *   node scripts/apply-model-tiers.mjs            # stamp
 *   node scripts/apply-model-tiers.mjs --check    # verify stamps match the map (CI)
 *   node scripts/apply-model-tiers.mjs --harness=claude-code --print
 *                                                 # resolve map for another harness
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseTiersYaml, resolveModel, stampFrontmatter, readFrontmatterField } from "./tier-lib.mjs";

const root = new URL("..", import.meta.url).pathname;
const args = process.argv.slice(2);
const check = args.includes("--check");
const print = args.includes("--print");
const harness = (args.find((a) => a.startsWith("--harness=")) || "--harness=opencode").slice("--harness=".length);

const config = parseTiersYaml(readFileSync(join(root, "playbook/model-tiers.yml"), "utf8"));

if (print) {
  const resolved = { commands: {}, agents: {} };
  for (const [name, tier] of Object.entries(config.commands)) resolved.commands[name] = resolveModel(config.tiers, tier, harness);
  for (const [name, tier] of Object.entries(config.agents)) resolved.agents[name] = resolveModel(config.tiers, tier, harness);
  console.log(JSON.stringify(resolved, null, 2));
  process.exit(0);
}

const problems = [];
let stamped = 0;

function apply(dir, entries) {
  for (const [name, tier] of Object.entries(entries)) {
    const file = join(root, dir, `${name}.md`);
    if (!existsSync(file)) { problems.push(`${dir}/${name}.md: file missing for tier map entry`); continue; }
    const model = resolveModel(config.tiers, tier, "opencode");
    const text = readFileSync(file, "utf8");
    const current = readFrontmatterField(text, "model");
    if (current === model) continue;
    if (check) { problems.push(`${dir}/${name}.md: model is '${current ?? "(unset)"}', tier map says '${model}'`); continue; }
    writeFileSync(file, stampFrontmatter(text, "model", model));
    console.log(`stamped ${dir}/${name}.md → model: ${model} (${tier})`);
    stamped++;
  }
}

apply("harness/opencode/command", config.commands);
apply("harness/opencode/agent", config.agents);

if (problems.length) { console.error(problems.map((p) => `ERROR ${p}`).join("\n")); process.exit(1); }
console.log(check ? "model tier stamps match the tier map" : `done (${stamped} file(s) updated)`);
