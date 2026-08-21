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
 *
 * Emits one NDJSON record per phase execution on stdout:
 *   {"phase","model","tier","tokens_in","tokens_out","cost_usd","attempt",
 *    "gate_verdict","project_type","timestamp","session_id","harness","granularity",
 *    "turns","tokens_scope","subagents"}
 *
 * Subagent accounting: every turn row between phase-start and phase-end is
 * summed into the totals regardless of sessionID, so child (subagent) session
 * tokens are always included. `tokens_scope` says whether that happened
 * ("tree" — at least one child-session turn was summed; "main" — only the
 * phase's own session) and `subagents` rolls the child share up as
 * {count, tokens_out, cost_usd}. A turn is a child turn when its `parentID`
 * is set (plugin-recorded) or its sessionID differs from the phase session.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => {
  const i = a.indexOf("=");
  return i === -1 ? [a.slice(2), true] : [a.slice(2, i), a.slice(i + 1)];
}));

const eventsPath = join(root, args.events ?? "verification/telemetry/events.ndjson");
const checklistPath = args.checklist ? join(root, args.checklist) : null;
const profilePath = join(root, "playbook/environment-profile.yml");
const tiersPath = join(root, args.tiers ?? "playbook/model-tiers.yml");

// ── framework-sourced fields ────────────────────────────────────────────────

function projectType() {
  if (!existsSync(profilePath)) return null;
  const m = readFileSync(profilePath, "utf8").match(/^project_type:\s*["']?([^"'\n#]+)/m);
  return m ? m[1].trim() : null;
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

// ── harness-sourced fields ──────────────────────────────────────────────────

if (!existsSync(eventsPath)) {
  console.error(`no telemetry events at ${eventsPath} — run with PLAYBOOK_TELEMETRY=1 (see docs/Telemetry-Hooks.md)`);
  process.exit(1);
}

const events = readFileSync(eventsPath, "utf8").split("\n").filter(Boolean).map((l) => {
  try { return JSON.parse(l); } catch { return null; }
}).filter(Boolean);

const { attempt, gate_verdict } = checklistFacts();
const project_type = projectType();

// One phase execution = a phase-start row plus every turn row for its session.
// message.updated fires repeatedly per message while it streams, so keep only
// the LAST turn row per messageID — its tokens/cost are the final values.
const phases = [];
let current = null;
let anon = 0;
function finalize(p) {
  p.models = {};
  p.tokens_in = 0; p.tokens_out = 0; p.cost_usd = 0; p.turns = 0;
  const childSessions = new Set();
  let sub_tokens_out = 0, sub_cost = 0;
  for (const e of p.byMessage.values()) {
    const t = e.tokens ?? {};
    const cache = t.cache ?? {};
    const out = (t.output ?? 0) + (t.reasoning ?? 0);
    p.turns++;
    p.tokens_in += (t.input ?? 0) + (cache.read ?? 0) + (cache.write ?? 0);
    p.tokens_out += out;
    p.cost_usd += e.cost ?? 0;
    if (e.model) p.models[e.model] = (p.models[e.model] ?? 0) + 1;
    const isChild = (e.parentID != null) || (e.sessionID != null && p.session_id != null && e.sessionID !== p.session_id);
    if (isChild) {
      childSessions.add(e.sessionID ?? e.parentID);
      sub_tokens_out += out;
      sub_cost += e.cost ?? 0;
    }
  }
  p.tokens_scope = childSessions.size ? "tree" : "main";
  p.subagents = { count: childSessions.size, tokens_out: sub_tokens_out, cost_usd: Number(sub_cost.toFixed(6)) };
  delete p.byMessage;
  phases.push(p);
}
for (const e of events) {
  if (e.kind === "phase-start") {
    if (current) finalize(current);
    current = { command: e.command, session_id: e.sessionID, started: e.ts, byMessage: new Map() };
  } else if (e.kind === "turn" && current) {
    current.byMessage.set(e.messageID ?? `anon-${anon++}`, e);
  } else if (e.kind === "phase-end" && current && e.sessionID === current.session_id) {
    current.ended = e.ts;
    finalize(current);
    current = null;
  }
}
if (current) finalize(current);

for (const p of phases) {
  const model = Object.entries(p.models).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  console.log(JSON.stringify({
    phase: p.command,
    model,
    tier: tierForModel(model),
    tokens_in: p.tokens_in,
    tokens_out: p.tokens_out,
    cost_usd: Number(p.cost_usd.toFixed(6)),
    attempt,
    gate_verdict,
    project_type,
    timestamp: p.ended ?? p.started,
    session_id: p.session_id,
    harness: "opencode",
    granularity: "message",
    turns: p.turns,
    tokens_scope: p.tokens_scope,
    subagents: p.subagents,
  }));
}
