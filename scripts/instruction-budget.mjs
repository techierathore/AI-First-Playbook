#!/usr/bin/env node
/**
 * instruction-budget.mjs — measure the fixed instruction surface OpenCode
 * loads for each of the ten phases and compare it with the tier maximum
 * (docs/Playbook-Reset-Plan.md §3). Front matter is stripped, as OpenCode
 * does; a retained phase counts the files of the phase it continues.
 * Verifier adapters are conditional (loaded by one sub-verifier each) and are
 * reported separately against the Economy total maximum.
 *
 *   node scripts/instruction-budget.mjs [--json] [--root=<dir>]
 */
import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));
export const TIERS = { economy: [300, 550], standard: [800, 1200], frontier: [1200, 1800] };
const SHARED = ["AGENTS.md", "playbook/environment-profile.yml"];
const H = "harness/opencode";
export const PHASES = [
  { phase: 1, name: "Plan", tier: "frontier", files: [...SHARED, `${H}/command/feature-plan.md`, `${H}/agent/analyst.md`] },
  { phase: 2, name: "Plan review", tier: "frontier", retains: 1 },
  { phase: 3, name: "Build", tier: "standard", files: [...SHARED, `${H}/command/implement.md`, `${H}/agent/orchestrator.md`] },
  { phase: 4, name: "Self-review", tier: "standard", retains: 3 },
  { phase: 5, name: "Verify", tier: "standard", files: [...SHARED, `${H}/agent/verifier.md`, `${H}/command/verify.md`] },
  { phase: 6, name: "Results gate", tier: "standard", retains: 5 },
  { phase: 7, name: "Fix", tier: "standard", files: [...SHARED, `${H}/command/fix.md`, `${H}/agent/orchestrator.md`] },
  { phase: 8, name: "Human acceptance", tier: "human", files: [] },
  { phase: 9, name: "Escaped bugs", tier: "frontier", files: [...SHARED, `${H}/command/analyze-fix.md`, `${H}/agent/analyst.md`] },
  { phase: 10, name: "Production bugs", tier: "sum", runs: [9, 7, 5] },
];

export const bodyWords = (text) => (text.replace(/^---\n[\s\S]*?\n---\n/, "").match(/\S+/g) ?? []).length;

export function measure(root = repo) {
  const words = (f) => bodyWords(readFileSync(join(root, f), "utf8"));
  const result = new Map();
  for (const p of PHASES) {
    if (p.retains) { const r = result.get(p.retains); result.set(p.phase, { ...p, files: r.files, total: r.total, max: r.max }); continue; }
    if (p.runs) {
      const total = p.runs.reduce((s, n) => s + result.get(n).total, 0);
      const max = 5400; // Reset Plan §3: 3,600 / 5,400 across the three runs
      result.set(p.phase, { ...p, files: p.runs.map((n) => `phase ${n}`), total, max });
      continue;
    }
    const total = p.files.reduce((s, f) => s + words(f), 0);
    result.set(p.phase, { ...p, total, max: p.tier === "human" ? 0 : TIERS[p.tier][1] });
  }
  const adapterDir = join(root, H, "templates/verifier");
  const adapters = existsSync(adapterDir) ? readdirSync(adapterDir).filter((f) => f.endsWith(".md")).map((f) => ({ file: `${H}/templates/verifier/${f}`, total: words(`${H}/templates/verifier/${f}`), max: TIERS.economy[1] })) : [];
  return { phases: [...result.values()], adapters };
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.argv.find((a) => a.startsWith("--root="))?.slice(7) ?? repo;
  const { phases, adapters } = measure(root);
  if (process.argv.includes("--json")) console.log(JSON.stringify({ phases, adapters }, null, 2));
  else {
    for (const p of phases) console.log(`${String(p.phase).padStart(2)} ${p.name.padEnd(17)} ${String(p.total).padStart(6)} / ${String(p.max).padStart(5)} ${p.total <= p.max ? "ok" : "OVER"}`);
    for (const a of adapters) console.log(`   adapter ${a.file.split("/").pop().padEnd(18)} ${String(a.total).padStart(4)} / ${a.max} ${a.total <= a.max ? "ok" : "OVER"}`);
  }
  const over = [...phases, ...adapters].filter((p) => p.total > p.max);
  process.exit(over.length ? 1 : 0);
}
