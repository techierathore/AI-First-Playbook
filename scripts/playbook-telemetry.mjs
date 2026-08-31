#!/usr/bin/env node
/**
 * playbook-telemetry.mjs — join harness telemetry with framework artifacts
 * into the final per-phase records.
 *
 * Harness-sourced fields (model, tokens, cost) come from
 * verification/telemetry/events.ndjson, written by the telemetry.ts plugin
 * (OpenCode) — enable with PLAYBOOK_TELEMETRY=1. Framework-sourced fields
 * (attempt, gate verdict, project_type) are parsed deterministically from the
 * checklist and playbook/environment-profile.yml — identical in any harness.
 * See docs/Telemetry-Hooks.md.
 *
 * Usage:
 *   node scripts/playbook-telemetry.mjs --checklist=path/to/Checklist.md \
 *        [--events=verification/telemetry/events.ndjson] [--tiers=playbook/model-tiers.yml]
 *   node scripts/playbook-telemetry.mjs --misses \
 *        [--misses-file=verification/telemetry/misses.ndjson] [--events=...]
 *
 * Emits one schema-2 NDJSON record per phase execution on stdout. Stable
 * identity, wall time, observed active effort, token/model breakdowns and
 * child lifecycle details accompany the compatibility fields below.
 *
 * Subagent accounting: every turn in the active phase session tree is summed,
 * including child sessions linked through their recorded parent chain while
 * excluding unrelated interleaved roots. `tokens_scope` says whether that happened
 * ("tree" — at least one child-session turn was summed; "main" — only the
 * phase's own session). `subagents.count` remains the contributing-child
 * compatibility count; `spawned`, `contributors` and `sessions` distinguish
 * every child launched from children that produced token-bearing turns.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  readMisses, readEventsWithDiagnostics, foldAmends, phaseWindows, enrichFixes, validateMisses, defaultMissesPath,
} from "./miss-lib.mjs";

const root = process.cwd();
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => {
  const i = a.indexOf("=");
  return i === -1 ? [a.slice(2), true] : [a.slice(2, i), a.slice(i + 1)];
}));

const inputPath = (value, fallback) => resolve(root, typeof value === "string" && value.length ? value : fallback);
const eventsPath = inputPath(args.events, "verification/telemetry/events.ndjson");
const checklistPath = typeof args.checklist === "string" && args.checklist.length ? resolve(root, args.checklist) : null;
const profilePath = resolve(root, "playbook/environment-profile.yml");
const tiersPath = inputPath(args.tiers, "playbook/model-tiers.yml");

// ── framework-sourced fields ────────────────────────────────────────────────

function projectType() {
  if (!existsSync(profilePath)) return null;
  const m = readFileSync(profilePath, "utf8").match(/^project_type:\s*["']?([^"'\n#]+)/m);
  const value = m ? m[1].trim() : null;
  return value && !/^<replace(?:[:>])/i.test(value) ? value : null;
}

function checklistFacts() {
  if (!checklistPath || !existsSync(checklistPath)) return { attempt: null, gate_verdict: null };
  const text = readFileSync(checklistPath, "utf8");
  const attempt = (text.match(/^###\s+Run on /gm) || []).length || null;
  const verdicts = [...text.matchAll(/\*\*Verifier Result\*\*[^:]*:\s*(PASS \(code-audit\)|FAIL \(code-audit\)|DATA-GAP|BLOCKED|PASS|FAIL)/g)].map((m) => m[1]);
  let gate_verdict = null;
  if (verdicts.length) {
    if (verdicts.includes("BLOCKED")) gate_verdict = "BLOCKED";
    else if (verdicts.includes("FAIL") || verdicts.includes("FAIL (code-audit)")) gate_verdict = "FAIL";
    else if (verdicts.includes("DATA-GAP")) gate_verdict = "DATA-GAP";
    else if (verdicts.includes("PASS (code-audit)")) gate_verdict = "PASS (code-audit)";
    else gate_verdict = "PASS";
  }
  return { attempt, gate_verdict };
}

function tierForModel(model) {
  if (!existsSync(tiersPath) || !model) return null;
  const text = readFileSync(tiersPath, "utf8");
  let currentTier = null;
  let inTiers = false;
  for (const raw of text.split("\n")) {
    const line = raw.replace(/#.*$/, "");
    if (/^tiers:/.test(line)) { inTiers = true; continue; }
    if (/^\S/.test(line) && !/^tiers:/.test(line)) inTiers = false;
    if (!inTiers) continue;
    const tier = line.match(/^  ([\w-]+):/);
    if (tier) { currentTier = tier[1]; continue; }
    const val = line.match(/^    [\w-]+:\s*["']?([^"'\n]+)["']?/);
    if (val && val[1].trim() === model) return currentTier;
  }
  return null;
}

// ── miss mode: join the durable miss stream with the transient windows ──────
// The joiner only ever reads. misses.ndjson is append-only and events.ndjson
// is transient/rotatable, so numbers are joined at read time and never
// written back. cost_attribution is derived here (sole / shared:<n> from how
// many closes resolve to the same exact phase window) and downgraded to
// "none" when no window resolves — missing beats invented.

if (args.misses) {
  const missesPath = inputPath(args["misses-file"], defaultMissesPath(root));
  if (!existsSync(missesPath)) {
    console.error(`no miss stream at ${missesPath} — open one with scripts/playbook-miss.mjs (docs/Telemetry-Guide.md §7)`);
    process.exit(1);
  }
  const raw = readMisses(missesPath);
  if (raw.malformed.length) console.error(`warning: ${raw.malformed.length} malformed line(s) skipped in ${missesPath}`);
  const { folded, applied } = foldAmends(raw.records);
  const eventInput = readEventsWithDiagnostics(eventsPath);
  if (eventInput.malformed.length) console.error(`warning: ${eventInput.malformed.length} malformed event line(s) skipped in ${eventsPath}`);
  const windows = phaseWindows(eventInput.events);
  const enriched = enrichFixes(folded, windows);
  for (const r of enriched) {
    const output = r.kind === "miss-fix" ? { ...r, tier: r.model ? tierForModel(r.model) : null } : r;
    console.log(JSON.stringify(output));
  }
  const { errors, notes } = validateMisses(raw.records);
  for (const n of notes) console.error(`  ${n}`);
  for (const e of errors) console.error(`  INVALID: ${e}`);
  console.error(`misses: ${folded.length} record(s) from ${missesPath} (${applied} amendment(s) applied, ${errors.length} invalid)`);
  process.exit(0);
}

// ── harness-sourced fields ──────────────────────────────────────────────────

if (!existsSync(eventsPath)) {
  console.error(`no telemetry events at ${eventsPath} — run with PLAYBOOK_TELEMETRY=1 (see docs/Telemetry-Hooks.md)`);
  process.exit(1);
}

const eventInput = readEventsWithDiagnostics(eventsPath);
if (eventInput.malformed.length) console.error(`warning: ${eventInput.malformed.length} malformed event line(s) skipped in ${eventsPath}`);
const events = eventInput.events;

const { attempt, gate_verdict } = checklistFacts();
const project_type = projectType();

// Reuse the miss joiner's phase windows so message de-duplication, phase
// boundaries and subagent accounting cannot drift between the two outputs.
const phases = phaseWindows(events).all;

for (const p of phases) {
  const model = p.model;
  console.log(JSON.stringify({
    schema: p.schema,
    kind: p.kind,
    phase_execution_id: p.phase_execution_id,
    phase: p.command,
    started_at: p.started_at,
    ended_at: p.ended_at,
    elapsed_ms: p.elapsed_ms,
    complete: p.complete,
    end_reason: p.end_reason,
    model,
    models: p.models,
    tier: tierForModel(model),
    tokens: p.tokens,
    tokens_in: p.tokens_in,
    tokens_out: p.tokens_out,
    cost_usd: p.cost_usd,
    attempt,
    gate_verdict,
    project_type,
    timestamp: p.complete ? p.ended_at : p.started_at,
    session_id: p.session_id,
    harness: "opencode",
    granularity: "message",
    turns: p.turns,
    observed_active_effort: p.observed_active_effort,
    data_quality: p.data_quality,
    tokens_scope: p.tokens_scope,
    subagents: p.subagents,
  }));
}
