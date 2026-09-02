/**
 * miss-lib.mjs — shared library for the miss stream
 * (scripts/playbook-miss.mjs, scripts/playbook-telemetry.mjs --misses,
 * scripts/playbook-validate.mjs).
 *
 * The durable stream is verification/telemetry/misses.ndjson (committed,
 * append-only, never rotated — unlike the transient events.ndjson). Three
 * record kinds: `miss` (opened), `miss-fix` (closed), `miss-amend`
 * (completes a null closed-vocabulary field; never overwrites a value).
 *
 * Contract: docs/Telemetry-Guide.md. Provenance rules that
 * this library enforces mechanically, not by prose:
 *   - an agent may classify, but may never report a number (or a provenance
 *     verdict): origin_model / origin_confidence / every token & cost field
 *     are derived here from the run record, never accepted from the caller;
 *   - attribution is looked up or null — a failed lookup forces null,
 *     overwriting whatever the caller supplied;
 *   - fix_run_id is omitted, never approximated (§0.6);
 *   - closed vocabularies only — the vocabulary IS the privacy control
 *     (§6.2): no titles, no repro steps, no free text.
 */
import { readFileSync, existsSync, appendFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";

export const MISS_SCHEMA = 1;

// ── closed vocabularies (docs/Telemetry-Guide.md §7) ───────────────────────
export const MISS_CLASS = [
  "missed-requirement", "partial-implementation", "wrong-behaviour", "regression",
  "unspecified-gap", "spec-contradiction", "scope-creep", "hallucinated-api",
  "standards-violation", "other",
];
export const ARTIFACTS = [
  "plan", "checklist", "mockup", "src", "tests", "docs", "config",
  "deployment-steps", "other",
];
export const SEVERITIES = ["blocker", "major", "minor"];
// The seventh value, instruction-ignored, is adopted from the solo edition
// (TechieFlow SCHEMA §5.5.6) with an explicitly AGENT-ONLY definition: a
// written rule existed, in a file an AGENT had loaded, and was not honoured.
// It must never be applied to a human actor — the person-facing failure is
// not this field (see docs/Decisions.md, 2026-08-28).
export const WHY_MISSED = [
  "missing-checklist-item", "insufficient-verify-method", "code-audit-limitation",
  "ambiguous-acceptance", "dependency-not-declared", "instruction-ignored", "other",
];
export const PHASES = [
  "plan", "plan-review-gate", "build", "self-review", "verify",
  "verification-results-gate", "fix", "human-acceptance",
  "post-verification-bugs", "production-bugs",
];
export const FOUND_BY = ["verifier", "self-review", "human", "production", "agent-review"];
export const PHASE_GATES = ["PASS", "FAIL", "PASS (code-audit)", "FAIL (code-audit)", "DATA-GAP", "BLOCKED"];
// verdict_after reuses the checklist's own status vocabulary
// (templates/checklist-metadata.yml), never a parallel one.
export const VERDICTS_AFTER = ["pass", "fail", "data-gap", "blocked", "deferred", "abandoned"];
export const HARNESS = ["opencode"];
// Only closed-vocabulary JUDGEMENTS are amendable: a judgement may be
// completed, an observation may not. Everything the emitter/joiner derives
// (model, confidence, tokens, cost, attribution) is excluded outright.
export const AMENDABLE = ["why_missed"];
// A record written before a field existed is not "unassessed" — it is
// dropped from that field's denominator (§0.55). Date = first shipped.
export const FIELD_SINCE = { why_missed: "2026-08-28" };

// Framework phases and harness slash commands are different namespaces. A
// run-window lookup always crosses this table rather than assuming the phase
// name was the command name. Null means there is no exact harness window to
// attribute for that framework phase.
export const PHASE_COMMAND = Object.freeze({
  plan: "feature-plan",
  "plan-review-gate": null,
  build: "implement",
  "self-review": "implement",
  verify: "verify",
  "verification-results-gate": "verify",
  fix: "fix",
  "human-acceptance": null,
  "post-verification-bugs": "analyze-fix",
  "production-bugs": "analyze-fix",
});

export function commandForPhase(phase) {
  return typeof phase === "string" && Object.hasOwn(PHASE_COMMAND, phase) ? PHASE_COMMAND[phase] : null;
}

const TOKEN_RE = /^[a-z0-9][a-z0-9._-]*$/i;
const MISS_ID_RE = /^MISS-\d{8}-\d{2,}$/;
const ISO_TS_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const ENRICHED_FIELDS = ["tokens_in", "tokens_out", "cost_usd", "tokens_scope", "subagents", "model", "tier", "data_quality"];
const MISS_FIELDS = [
  "kind", "ts", "schema", "miss_id", "item_id", "feature", "miss_class", "artifact", "severity",
  "why_missed", "origin_phase", "origin_agent", "origin_run_id", "origin_confidence", "origin_model",
  "actor", "found_by", "found_phase", "found_phase_gate", "project_type", "harness",
];
const FIX_FIELDS = [
  "kind", "ts", "schema", "miss_id", "item_id", "fix_phase", "fix_run_id", "fix_attempt",
  "verdict_after", "reopened", "cost_attribution", "actor",
];
const AMEND_FIELDS = ["kind", "ts", "schema", "miss_id", "field", "value"];

// ── the two "open" predicates (§0.4) — they DELIBERATELY disagree ───────────
// Do not "fix" these to agree; each answers a different question:
//   backlog — "how much work is outstanding?" (the figure a team reads).
//   A deliberately-abandoned defect is a decision, not outstanding work.
//   live — "is this defect still the same live defect?" (--if-new / the
//   collapse check). An abandoned defect that FAILs again must NOT open a
//   second record — it is the same defect. deferred stays open in both.
export function latestVerdict(fixesByMiss, missId) {
  const fixes = fixesByMiss.get(missId) ?? [];
  return fixes.length ? fixes[fixes.length - 1].verdict_after : null;
}
export function isBacklog(fixesByMiss, missId) {
  const v = latestVerdict(fixesByMiss, missId);
  return v !== "pass" && v !== "abandoned";
}
export function isLive(fixesByMiss, missId) {
  return latestVerdict(fixesByMiss, missId) !== "pass";
}

// ── stream I/O ──────────────────────────────────────────────────────────────
export function defaultMissesPath(root = process.cwd()) {
  return join(root, "verification", "telemetry", "misses.ndjson");
}
export function defaultEventsPath(root = process.cwd()) {
  return join(root, "verification", "telemetry", "events.ndjson");
}

/** Parse the stream. Malformed lines are returned (not thrown) so the
 *  validator can report them; writers append, they never rewrite. */
export function readMisses(path) {
  if (!existsSync(path)) return { records: [], malformed: [] };
  const records = [];
  const malformed = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line);
      if (r && typeof r === "object" && !Array.isArray(r)) records.push(r);
      else malformed.push(line);
    } catch {
      malformed.push(line);
    }
  }
  return { records, malformed };
}

export function appendRecord(path, record) {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(record) + "\n");
}

/** Group miss-fix records per miss_id, in stream order. */
export function fixesByMiss(records) {
  const map = new Map();
  for (const r of records) {
    if (r.kind !== "miss-fix") continue;
    if (!map.has(r.miss_id)) map.set(r.miss_id, []);
    map.get(r.miss_id).push(r);
  }
  return map;
}

/** Fold amendments into their parents, re-checking the null rule while
 *  folding (a merged team stream can carry an amend and a later-written
 *  value in either order). An amend that would overwrite a non-null value
 *  is counted and dropped, never applied. Orphan amends (no parent) are
 *  returned separately — the validator reports them exactly as it reports
 *  orphan miss-fix records. */
export function foldAmends(records) {
  // Clone parents before applying anything: callers commonly validate and
  // report from the same raw array, and folding must never rewrite history in
  // memory any more than the CLI may rewrite it on disk.
  const folded = records.filter((r) => r.kind !== "miss-amend").map((r) => r.kind === "miss" ? { ...r } : r);
  const parents = new Map();
  for (const r of folded) {
    if (r.kind === "miss" && !parents.has(r.miss_id)) parents.set(r.miss_id, r);
  }
  let applied = 0;
  let ignored = 0;
  let invalid = 0;
  let overwrites = 0;
  const orphans = [];
  for (const r of records) {
    if (r.kind !== "miss-amend") continue;
    const parent = parents.get(r.miss_id);
    if (!parent) { orphans.push(r); continue; }
    if (!AMENDABLE.includes(r.field)) { ignored++; invalid++; continue; }
    // Folding is also a trust boundary: malformed, hand-written stream rows
    // are still reported by validateMisses, but can never enter joined output.
    if (r.field === "why_missed" && !WHY_MISSED.includes(r.value)) { ignored++; invalid++; continue; }
    if (parent[r.field] != null) { ignored++; overwrites++; continue; }
    parent[r.field] = r.value;
    applied++;
  }
  return { folded, applied, ignored, invalid, overwrites, orphans };
}

/** The collapse check (§8.2): an open miss on the same item_id with the same
 *  miss_class means the same defect — emit nothing. Uses the STILL-LIVE
 *  predicate (abandoned collapses, pass does not). */
export function findLiveDuplicate(records, itemId, missClass) {
  if (itemId == null) return null;
  const fixes = fixesByMiss(records);
  return (
    records.findLast(
      (r) => r.kind === "miss" && r.item_id === itemId && r.miss_class === missClass && isLive(fixes, r.miss_id),
    ) ?? null
  );
}

export function nextMissId(records, now = new Date()) {
  const day = now.toISOString().slice(0, 10).replaceAll("-", "");
  const prefix = `MISS-${day}-`;
  let highest = 0;
  for (const record of records ?? []) {
    if (record.kind !== "miss" || !record.miss_id?.startsWith(prefix)) continue;
    const suffix = record.miss_id.slice(prefix.length);
    if (!/^\d{2,}$/.test(suffix)) continue;
    const sequence = Number(suffix);
    // Legacy timestamp-plus-entropy IDs exceed Number's safe range and do not
    // participate in the new human-readable daily sequence.
    if (Number.isSafeInteger(sequence)) highest = Math.max(highest, sequence);
  }
  return `${prefix}${String(highest + 1).padStart(2, "0")}`;
}

// ── events.ndjson windows (the only source of numbers; transient by design) ─
export function readEvents(path) {
  return readEventsWithDiagnostics(path).events;
}

export function readEventsWithDiagnostics(path) {
  if (!existsSync(path)) return { events: [], malformed: [] };
  const events = [];
  const malformed = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      if (event && typeof event === "object" && !Array.isArray(event)) events.push(event);
      else malformed.push(line);
    } catch {
      malformed.push(line);
    }
  }
  return { events, malformed };
}

/** One window = a phase-start plus every turn in that session tree until its
 *  phase-end, summed
 *  last-row-per-session+messageID (message.updated fires repeatedly while
 *  streaming). Child-session turns are always in the total; tokens_scope /
 *  subagents split out the child share — same math as the per-phase joiner
 *  in scripts/playbook-telemetry.mjs. Top-level sessions may interleave: each
 *  has its own active window, and a child turn is routed only through its
 *  recursively known parent chain. */
export function phaseWindows(events) {
  const orderedEvents = events.map((event, index) => ({ event, index })).sort((a, b) => {
    const aTime = typeof a.event?.ts === "string" ? Date.parse(a.event.ts) : NaN;
    const bTime = typeof b.event?.ts === "string" ? Date.parse(b.event.ts) : NaN;
    if (!Number.isNaN(aTime) && !Number.isNaN(bTime) && aTime !== bTime) return aTime - bTime;
    if (a.event?.captureID === b.event?.captureID
      && Number.isInteger(a.event?.seq) && Number.isInteger(b.event?.seq)) return a.event.seq - b.event.seq;
    return a.index - b.index;
  }).map(({ event }) => event);
  const windows = new Map();
  const all = [];
  const active = new Map();
  const parents = new Map();
  const order = new WeakMap();
  let anon = 0;
  let phaseOrder = 0;
  const tokenBreakdown = (event, quality) => {
    const tokens = event?.tokens ?? {};
    const cache = tokens.cache ?? {};
    const component = (value, name) => {
      if (value == null) {
        if (event?.schema === 2) quality.issues.push(`missing ${name} on turn ${event?.sessionID ?? "unknown"}/${event?.messageID ?? "unknown"}`);
        else quality.legacyMissing = true;
        return 0;
      }
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
      quality.issues.push(`invalid ${name} on turn ${event?.sessionID ?? "unknown"}/${event?.messageID ?? "unknown"}`);
      return 0;
    };
    return {
      input: component(tokens.input, "tokens.input"),
      output: component(tokens.output, "tokens.output"),
      reasoning: component(tokens.reasoning, "tokens.reasoning"),
      cache_read: component(tokens.cache_read ?? cache.read, "tokens.cache_read"),
      cache_write: component(tokens.cache_write ?? cache.write, "tokens.cache_write"),
    };
  };
  const emptyTokens = () => ({ input: 0, output: 0, reasoning: 0, cache_read: 0, cache_write: 0 });
  const addTokens = (target, source) => {
    for (const key of Object.keys(target)) target[key] += source[key];
  };
  const tokensIn = (tokens) => tokens.input + tokens.cache_read + tokens.cache_write;
  const tokensOut = (tokens) => tokens.output + tokens.reasoning;
  const totalTokens = (tokens) => tokensIn(tokens) + tokensOut(tokens);
  const roundedCost = (cost) => Number(cost.toFixed(6));
  const timeMs = (value) => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value !== "string") return null;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  };
  const elapsed = (started, ended) => {
    const startMs = timeMs(started);
    const endMs = timeMs(ended);
    return startMs != null && endMs != null && endMs >= startMs ? endMs - startMs : null;
  };
  const interval = (started, ended) => {
    const startMs = timeMs(started);
    const endMs = timeMs(ended);
    return startMs != null && endMs != null && endMs >= startMs ? [startMs, endMs] : null;
  };
  const unionMs = (intervals) => {
    const sorted = intervals.filter(Boolean).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let total = 0;
    let current = null;
    for (const next of sorted) {
      if (!current || next[0] > current[1]) {
        if (current) total += current[1] - current[0];
        current = [...next];
      } else if (next[1] > current[1]) current[1] = next[1];
    }
    if (current) total += current[1] - current[0];
    return total;
  };
  const legacyExecutionId = (phase) => `legacy-${createHash("sha256")
    .update(JSON.stringify([phase.session_id ?? null, phase.command ?? null, phase.started_at ?? null, phase.order]))
    .digest("hex").slice(0, 32)}`;
  const summarizeTurns = (turns) => {
    const tokens = emptyTokens();
    const models = new Map();
    const quality = { issues: [], legacyMissing: false };
    let cost = 0;
    let observedCost = 0;
    let missingCost = 0;
    let invalidCost = 0;
    let zeroUnverifiedCost = 0;
    let activeMs = 0;
    let observedActive = 0;
    let missingActive = 0;
    const activeIntervals = [];
    for (const event of turns) {
      const eventTokens = tokenBreakdown(event, quality);
      addTokens(tokens, eventTokens);
      if (event.cost == null) missingCost++;
      else if (typeof event.cost === "number" && Number.isFinite(event.cost) && event.cost >= 0) {
        cost += event.cost;
        observedCost++;
        if (event.cost === 0 && totalTokens(eventTokens) > 0) zeroUnverifiedCost++;
      } else {
        invalidCost++;
        quality.issues.push(`invalid cost on turn ${event?.sessionID ?? "unknown"}/${event?.messageID ?? "unknown"}`);
      }
      const eventInterval = interval(event.activeStartedAt, event.activeEndedAt);
      const eventActive = eventInterval ? eventInterval[1] - eventInterval[0] : null;
      if (eventActive == null) missingActive++;
      else {
        activeMs += eventActive;
        activeIntervals.push(eventInterval);
        observedActive++;
      }
      if (typeof event.model !== "string" || !event.model.length) continue;
      if (!models.has(event.model)) {
        models.set(event.model, {
          model: event.model, turns: 0, tokens: emptyTokens(), cost: 0,
          observedCost: 0, missingCost: 0, invalidCost: 0, zeroUnverifiedCost: 0,
          activeMs: 0, observedActive: 0,
        });
      }
      const model = models.get(event.model);
      model.turns++;
      addTokens(model.tokens, eventTokens);
      if (event.cost == null) model.missingCost++;
      else if (typeof event.cost === "number" && Number.isFinite(event.cost) && event.cost >= 0) {
        model.cost += event.cost;
        model.observedCost++;
        if (event.cost === 0 && totalTokens(eventTokens) > 0) model.zeroUnverifiedCost++;
      } else model.invalidCost++;
      if (eventActive != null) { model.activeMs += eventActive; model.observedActive++; }
    }
    const statusForCost = ({ turns: count, invalid, missing, observed, zeroUnverified, total }) => !count
      ? "unavailable"
      : (invalid
        ? "invalid"
        : (missing
          ? (observed ? "partial" : "unavailable")
          : (zeroUnverified ? (total === 0 ? "zero-unverified" : "partial") : "complete")));
    const modelRows = [...models.values()].sort((a, b) => a.model.localeCompare(b.model)).map((model) => {
      const costStatus = statusForCost({
        turns: model.turns,
        invalid: model.invalidCost,
        missing: model.missingCost,
        observed: model.observedCost,
        zeroUnverified: model.zeroUnverifiedCost,
        total: model.cost,
      });
      return {
        model: model.model,
        turns: model.turns,
        tokens: model.tokens,
        tokens_in: tokensIn(model.tokens),
        tokens_out: tokensOut(model.tokens),
        cost_usd: ["complete", "zero-unverified"].includes(costStatus) ? roundedCost(model.cost) : null,
        cost_status: costStatus,
        active_ms: model.observedActive ? model.activeMs : null,
      };
    });
    const dominant = [...modelRows].sort((a, b) => b.turns - a.turns || a.model.localeCompare(b.model))[0]?.model ?? null;
    const costStatus = statusForCost({
      turns: turns.length,
      invalid: invalidCost,
      missing: missingCost,
      observed: observedCost,
      zeroUnverified: zeroUnverifiedCost,
      total: cost,
    });
    return {
      turns: turns.length,
      tokens,
      tokens_in: tokensIn(tokens),
      tokens_out: tokensOut(tokens),
      cost_usd: ["complete", "zero-unverified"].includes(costStatus) ? roundedCost(cost) : null,
      costStatus,
      issues: quality.issues,
      legacyMissing: quality.legacyMissing,
      activeMs,
      activeIntervals,
      observedActive,
      missingActive,
      models: modelRows,
      model: dominant,
    };
  };
  // Parent rows can arrive after an earlier child update in a merged event
  // stream. Learn every non-null edge first so routing is deterministic.
  for (const e of orderedEvents) {
    if (["turn", "subagent-start", "subagent-end", "tool-start", "tool-end"].includes(e.kind) && e.sessionID != null && e.parentID != null) {
      parents.set(e.sessionID, e.parentID);
    }
  }
  const childFor = (p, event) => {
    const sessionID = event.sessionID;
    if (sessionID == null || sessionID === p.session_id) return null;
    if (!p.children.has(sessionID)) {
      p.children.set(sessionID, {
        session_id: sessionID,
        parent_id: event.parentID ?? parents.get(sessionID) ?? null,
        started_at: null,
        ended_at: null,
        agent: null,
      });
    }
    const child = p.children.get(sessionID);
    if (child.parent_id == null && event.parentID != null) child.parent_id = event.parentID;
    if (child.agent == null && typeof event.agent === "string") child.agent = event.agent;
    return child;
  };
  const finalize = (p, endReason, endedAt = null) => {
    const turns = [...p.byMessage.values()];
    const summary = summarizeTurns(turns);
    const childTurns = new Map();
    for (const event of turns) {
      const child = childFor(p, event);
      if (!child) continue;
      if (!childTurns.has(event.sessionID)) childTurns.set(event.sessionID, []);
      childTurns.get(event.sessionID).push(event);
    }
    const childTokenSummary = summarizeTurns([...childTurns.values()].flat());
    const sessions = [...p.children.values()].sort((a, b) => String(a.session_id).localeCompare(String(b.session_id))).map((child) => {
      const childSummary = summarizeTurns(childTurns.get(child.session_id) ?? []);
      const childElapsed = elapsed(child.started_at, child.ended_at);
      return {
        session_id: child.session_id,
        parent_id: child.parent_id,
        ...(child.agent == null ? {} : { agent: child.agent }),
        started_at: child.started_at,
        ended_at: child.ended_at,
        elapsed_ms: childElapsed,
        complete: child.started_at != null && child.ended_at != null && childElapsed != null,
        turns: childSummary.turns,
        tokens: childSummary.tokens,
        tokens_in: childSummary.tokens_in,
        tokens_out: childSummary.tokens_out,
        cost_usd: childSummary.cost_usd,
        cost_status: childSummary.costStatus,
        models: childSummary.models,
      };
    });
    const contributorIds = new Set(sessions.filter((session) => totalTokens(session.tokens) > 0).map((session) => session.session_id));
    let observedTools = 0;
    let incompleteTools = 0;
    const toolIntervals = [];
    for (const tool of p.tools.values()) {
      const toolInterval = interval(tool.started_at, tool.ended_at);
      if (toolInterval == null) incompleteTools++;
      else {
        toolIntervals.push(toolInterval);
        observedTools++;
      }
    }
    const observed = summary.observedActive + observedTools;
    const incomplete = summary.missingActive > 0 || incompleteTools > 0;
    const coverage = observed === 0 ? "unavailable" : (incomplete || endReason === "eof" ? "partial" : "complete");
    const complete = endReason !== "eof";
    const phaseElapsed = complete ? elapsed(p.started_at, endedAt) : null;
    const issues = [...summary.issues];
    if (p.source_schema === 2 && summary.turns === 0) issues.push("no finalized assistant turns observed");
    const phaseStartMs = timeMs(p.started_at);
    const phaseEndMs = complete ? timeMs(endedAt) : null;
    const clipToPhase = ([start, end]) => {
      const clippedStart = phaseStartMs == null ? start : Math.max(start, phaseStartMs);
      const clippedEnd = phaseEndMs == null ? end : Math.min(end, phaseEndMs);
      return clippedEnd >= clippedStart ? [clippedStart, clippedEnd] : null;
    };
    const assistantIntervals = summary.activeIntervals.map(clipToPhase).filter(Boolean);
    const clippedToolIntervals = toolIntervals.map(clipToPhase).filter(Boolean);
    const assistantElapsedMs = assistantIntervals.reduce((sum, current) => sum + current[1] - current[0], 0);
    const clippedToolElapsedMs = clippedToolIntervals.reduce((sum, current) => sum + current[1] - current[0], 0);
    const observedActiveMs = unionMs([...assistantIntervals, ...clippedToolIntervals]);
    const w = {
      schema: 2,
      kind: "phase-metric",
      phase_execution_id: p.phase_execution_id ?? legacyExecutionId(p),
      command: p.command,
      session_id: p.session_id,
      started_at: p.started_at,
      ended_at: complete ? endedAt : null,
      elapsed_ms: phaseElapsed,
      complete,
      end_reason: endReason,
      model: summary.model,
      models: summary.models,
      tokens: summary.tokens,
      tokens_in: summary.tokens_in,
      tokens_out: summary.tokens_out,
      cost_usd: summary.cost_usd,
      turns: summary.turns,
      observed_active_effort: {
        assistant_elapsed_ms: assistantElapsedMs,
        tool_elapsed_ms: clippedToolElapsedMs,
        observed_active_ms: observedActiveMs,
        coverage,
      },
      data_quality: {
        valid: issues.length === 0,
        issues: [...new Set(issues)],
        token_status: issues.some((issue) => issue.startsWith("invalid tokens."))
          ? "invalid"
          : (!complete || issues.some((issue) => issue.startsWith("missing tokens.") || issue === "no finalized assistant turns observed")
            ? "incomplete"
            : (summary.legacyMissing ? "legacy-unverified" : "complete")),
        cost_status: !complete && ["complete", "zero-unverified"].includes(summary.costStatus)
          ? "partial"
          : summary.costStatus,
      },
      tokens_scope: contributorIds.size ? "tree" : "main",
      subagents: {
        count: contributorIds.size,
        spawned: sessions.length,
        contributors: contributorIds.size,
        tokens: childTokenSummary.tokens,
        tokens_in: childTokenSummary.tokens_in,
        tokens_out: childTokenSummary.tokens_out,
        cost_usd: childTokenSummary.cost_usd,
        cost_status: childTokenSummary.costStatus,
        sessions,
      },
    };
    if (!windows.has(p.session_id)) windows.set(p.session_id, []);
    windows.get(p.session_id).push(w);
    all.push(w);
    order.set(w, p.order);
  };
  const ownerFor = (sessionId) => {
    if (active.has(sessionId)) return active.get(sessionId);
    const seen = new Set();
    let cursor = sessionId;
    while (cursor != null && !seen.has(cursor)) {
      seen.add(cursor);
      cursor = parents.get(cursor);
      if (active.has(cursor)) return active.get(cursor);
    }
    return null;
  };
  for (const e of orderedEvents) {
    if (e.kind === "phase-start") {
      const prior = active.get(e.sessionID);
      if (prior) finalize(prior, "superseded", e.ts ?? null);
      active.set(e.sessionID, {
        command: e.command,
        session_id: e.sessionID,
        phase_execution_id: typeof e.phaseExecutionID === "string" && e.phaseExecutionID.length
          ? e.phaseExecutionID
          : (typeof e.phase_execution_id === "string" && e.phase_execution_id.length ? e.phase_execution_id : null),
        started_at: e.ts ?? null,
        source_schema: e.schema ?? null,
        byMessage: new Map(),
        children: new Map(),
        tools: new Map(),
        order: phaseOrder++,
      });
    } else if (e.kind === "turn") {
      const owner = ownerFor(e.sessionID);
      if (owner) {
        // message ids are session-local; two child sessions may legitimately
        // use the same id and both must remain in the phase total.
        const key = e.messageID == null ? `anon-${anon++}` : JSON.stringify([e.sessionID ?? null, e.messageID]);
        owner.byMessage.set(key, e);
      }
    } else if (e.kind === "subagent-start" || e.kind === "subagent-end") {
      const owner = ownerFor(e.sessionID);
      if (owner) {
        const child = childFor(owner, e);
        if (child && e.kind === "subagent-start" && child.started_at == null) child.started_at = e.ts ?? null;
        if (child && e.kind === "subagent-end" && child.ended_at == null) child.ended_at = e.ts ?? null;
      }
    } else if (e.kind === "tool-start") {
      const owner = ownerFor(e.sessionID);
      if (owner) {
        childFor(owner, e);
        const key = e.callID == null ? `anon-${anon++}` : JSON.stringify([e.sessionID ?? null, e.callID]);
        if (!owner.tools.has(key)) owner.tools.set(key, { started_at: e.ts ?? null, ended_at: null });
      }
    } else if (e.kind === "tool-end") {
      const owner = ownerFor(e.sessionID);
      const key = JSON.stringify([e.sessionID ?? null, e.callID]);
      const tool = owner?.tools.get(key);
      if (tool && tool.ended_at == null) tool.ended_at = e.ts ?? null;
    } else if (e.kind === "phase-end") {
      const current = active.get(e.sessionID);
      if (!current) continue;
      finalize(current, "idle", e.ts ?? null);
      active.delete(e.sessionID);
    }
  }
  for (const current of active.values()) finalize(current, "eof");
  return {
    bySession: windows,
    all,
    pick(sessionId, frameworkPhase = null, atOrBefore = null) {
      const list = sessionId != null ? windows.get(sessionId) : null;
      if (!list || !list.length) return null;
      const command = frameworkPhase == null ? null : commandForPhase(frameworkPhase);
      if (frameworkPhase != null && command == null) return null;
      const cutoff = atOrBefore == null ? Infinity : Date.parse(atOrBefore);
      if (Number.isNaN(cutoff)) return null;
      const candidates = list.filter((w) =>
        (command == null || w.command === command)
        && Date.parse(w.started_at) <= cutoff
      );
      return candidates.reduce((latest, w) => {
        if (!latest) return w;
        const delta = Date.parse(w.started_at) - Date.parse(latest.started_at);
        return delta > 0 || (delta === 0 && order.get(w) > order.get(latest)) ? w : latest;
      }, null);
    },
  };
}

/** Resolve the origin half of a `miss` record. Never trusts the caller: the
 *  model is forced to null when the lookup fails, overwriting whatever was
 *  supplied — an agent naming its own confidence is the same hazard as an
 *  agent naming its own model, one level up (§0.3). */
export function resolveOrigin({ origin_run_id, origin_phase, ts = null }, windows) {
  const w = origin_run_id != null ? windows?.pick(origin_run_id, origin_phase ?? null, ts) : null;
  if (w?.complete && w?.data_quality?.valid !== false && w.model) {
    return { origin_model: w.model, origin_confidence: "linked" };
  }
  if (origin_run_id != null || origin_phase != null) return { origin_model: null, origin_confidence: "inferred" };
  return { origin_model: null, origin_confidence: "unknown" };
}

// ── record builders (the only writers; validated here, written append-only) ─
function checkVocab(errors, field, value, vocab, { optional = false } = {}) {
  if (value == null) {
    if (!optional) errors.push(`${field} is required (one of: ${vocab.join(", ")})`);
    return;
  }
  if (value === "") {
    errors.push(`${field} must not be empty`);
    return;
  }
  if (!vocab.includes(value)) errors.push(`${field}: '${value}' is not in the closed vocabulary (${vocab.join(", ")})`);
}
function checkToken(errors, field, value, { optional = false } = {}) {
  if (value == null) {
    if (!optional) errors.push(`${field} is required`);
    return;
  }
  if (value === "") {
    errors.push(`${field} must not be empty`);
    return;
  }
  if (typeof value !== "string" || !TOKEN_RE.test(value)) {
    errors.push(`${field}: '${value}' is not a short kebab token (no free text — the privacy ceiling is ids and paths)`);
  }
}

function rejectCallerFields(args, errors, fields) {
  for (const field of fields) {
    if (Object.hasOwn(args, field)) errors.push(`${field} is emitter-derived and must not be supplied by the caller`);
  }
}

function isIsoTimestamp(value) {
  if (typeof value !== "string") return false;
  const match = value.match(ISO_TS_RE);
  if (!match || Number.isNaN(Date.parse(value))) return false;
  const [, year, month, day, hour, minute, second] = match.map(Number);
  if (hour > 23 || minute > 59 || second > 59) return false;
  const calendar = new Date(Date.UTC(year, month - 1, day));
  return calendar.getUTCFullYear() === year && calendar.getUTCMonth() === month - 1 && calendar.getUTCDate() === day;
}

export function buildMissRecord(args, { records = [], windows, now = new Date(), project_type = null } = {}) {
  const errors = [];
  rejectCallerFields(args, errors, [
    "kind", "ts", "schema", "miss_id", "origin_model", "origin_confidence", "cost_attribution",
    "fix_attempt", "reopened", ...ENRICHED_FIELDS,
  ]);
  checkVocab(errors, "miss_class", args.miss_class, MISS_CLASS);
  checkVocab(errors, "artifact", args.artifact, ARTIFACTS);
  checkVocab(errors, "severity", args.severity, SEVERITIES);
  checkVocab(errors, "why_missed", args.why_missed ?? null, WHY_MISSED, { optional: true });
  checkVocab(errors, "origin_phase", args.origin_phase ?? null, PHASES, { optional: true });
  checkVocab(errors, "found_by", args.found_by, FOUND_BY);
  checkVocab(errors, "found_phase", args.found_phase ?? null, PHASES, { optional: true });
  checkVocab(errors, "found_phase_gate", args.found_phase_gate ?? null, PHASE_GATES, { optional: true });
  checkVocab(errors, "harness", args.harness ?? "opencode", HARNESS, { optional: true });
  checkToken(errors, "item_id", args.item_id ?? null, { optional: true });
  checkToken(errors, "feature", args.feature ?? null, { optional: true });
  checkToken(errors, "origin_agent", args.origin_agent ?? null, { optional: true });
  checkToken(errors, "actor", args.actor ?? null, { optional: true });
  checkToken(errors, "origin_run_id", args.origin_run_id ?? null, { optional: true });
  if (args.why_missed === "instruction-ignored" && args.origin_agent == null) {
    errors.push("origin_agent is required when why_missed is instruction-ignored (agent-only)");
  }
  if (project_type != null) checkToken(errors, "project_type", project_type);
  if (errors.length) return { errors };
  const ts = now.toISOString();
  const { origin_model, origin_confidence } = resolveOrigin(
    { origin_run_id: args.origin_run_id ?? null, origin_phase: args.origin_phase ?? null, ts },
    windows,
  );
  return {
    record: {
      kind: "miss", ts, schema: MISS_SCHEMA,
      miss_id: nextMissId(records, now),
      item_id: args.item_id ?? null,
      feature: args.feature ?? null,
      miss_class: args.miss_class, artifact: args.artifact, severity: args.severity,
      why_missed: args.why_missed ?? null,
      origin_phase: args.origin_phase ?? null, origin_agent: args.origin_agent ?? null,
      origin_run_id: args.origin_run_id ?? null,
      origin_confidence, origin_model,
      actor: args.actor ?? null,
      found_by: args.found_by, found_phase: args.found_phase ?? null,
      found_phase_gate: args.found_phase_gate ?? null,
      project_type, harness: args.harness ?? "opencode",
    },
  };
}

export function buildFixRecord(args, { records = [], now = new Date() } = {}) {
  const errors = [];
  rejectCallerFields(args, errors, [
    "kind", "ts", "schema", "fix_attempt", "reopened", "cost_attribution", "origin_model", "origin_confidence",
    ...ENRICHED_FIELDS,
  ]);
  const parent = records.findLast((r) => r.kind === "miss" && r.miss_id === args.miss_id);
  if (!parent) errors.push(`no miss record with miss_id '${args.miss_id}' — open the miss first, then close it`);
  if (typeof args.miss_id !== "string" || !MISS_ID_RE.test(args.miss_id)) errors.push(`bad miss_id '${args.miss_id}'`);
  checkVocab(errors, "verdict_after", args.verdict_after ?? "pass", VERDICTS_AFTER, { optional: true });
  checkVocab(errors, "fix_phase", args.fix_phase ?? "fix", PHASES, { optional: true });
  checkToken(errors, "actor", args.actor ?? null, { optional: true });
  checkToken(errors, "fix_run_id", args.fix_run_id ?? null, { optional: true });
  if (parent && args.item_id != null && args.item_id !== parent.item_id) {
    errors.push(`item_id '${args.item_id}' does not match parent ${args.miss_id} item_id '${parent.item_id}'`);
  }
  if (errors.length) return { errors };
  const prior = (records ?? []).filter((r) => r.kind === "miss-fix" && r.miss_id === args.miss_id);
  // reopened = this miss had already reached pass and failed again — a
  // plain fail→fix→pass loop is attempt 2, not a re-opening.
  const reopened = prior.some((r) => r.verdict_after === "pass");
  const fix_run_id = args.fix_run_id ?? null; // omitted, never approximated (§0.6)
  return {
    record: {
      kind: "miss-fix", ts: now.toISOString(), schema: MISS_SCHEMA,
      miss_id: args.miss_id, item_id: parent ? parent.item_id : (args.item_id ?? null),
      fix_phase: args.fix_phase ?? "fix",
      ...(fix_run_id != null ? { fix_run_id } : {}),
      fix_attempt: prior.length + 1,
      verdict_after: args.verdict_after ?? "pass",
      reopened,
      // "none" is final when there is no run to point at; with a run id the
      // joiner derives sole / shared:<n> at read time (all closes for the
      // same run may not be on the stream yet at write time).
      cost_attribution: fix_run_id != null ? null : "none",
      actor: args.actor ?? null,
    },
  };
}

export function buildAmendRecord(missId, field, value, { records = [], now = new Date() } = {}) {
  const errors = [];
  const parent = foldAmends(records ?? []).folded.findLast((r) => r.kind === "miss" && r.miss_id === missId);
  if (!parent) errors.push(`no miss record with miss_id '${missId}' — an amend completes a record, it cannot create one`);
  if (typeof missId !== "string" || !MISS_ID_RE.test(missId)) errors.push(`bad miss_id '${missId}'`);
  if (!AMENDABLE.includes(field)) errors.push(`field '${field}' is not amendable (only closed-vocabulary judgements: ${AMENDABLE.join(", ")})`);
  if (field === "why_missed") checkVocab(errors, "value", value, WHY_MISSED);
  if (parent && AMENDABLE.includes(field) && parent[field] != null) {
    errors.push(`${missId}.${field} is already '${parent[field]}' — an amend may complete a null field, never overwrite a value`);
  }
  if (errors.length) return { errors };
  return { record: { kind: "miss-amend", ts: now.toISOString(), schema: MISS_SCHEMA, miss_id: missId, field, value } };
}

// ── validation (used by scripts/playbook-validate.mjs and the joiner) ───────
export function validateMisses(records) {
  const errors = [];
  const notes = [];
  const missIds = new Set();
  const parentById = new Map();
  const fixSequence = new Map();
  const requireFields = (r, fields) => {
    for (const f of fields) if (!Object.hasOwn(r, f)) errors.push(`${r.kind} ${r.miss_id ?? ""}: required field '${f}' is missing`);
  };
  const rejectUnknownFields = (r, fields) => {
    const allowed = new Set(fields);
    for (const f of Object.keys(r)) {
      if (allowed.has(f)) continue;
      if (ENRICHED_FIELDS.includes(f)) errors.push(`${r.kind} ${r.miss_id ?? ""}: derived field '${f}' is allowed only on enriched output, never in the raw stream`);
      else errors.push(`${r.kind} ${r.miss_id ?? ""}: unknown field '${f}'`);
    }
  };
  for (const r of records) {
    if (r.kind !== "miss") continue;
    if (missIds.has(r.miss_id)) errors.push(`duplicate miss_id '${r.miss_id}'`);
    else {
      missIds.add(r.miss_id);
      parentById.set(r.miss_id, r);
    }
  }
  for (const r of records) {
    if (r.schema !== MISS_SCHEMA) errors.push(`${r.kind} ${r.miss_id ?? ""}: schema must be ${MISS_SCHEMA}`);
    if (!isIsoTimestamp(r.ts)) errors.push(`${r.kind} ${r.miss_id ?? ""}: ts is not ISO-8601`);
    if (r.kind === "miss") {
      requireFields(r, MISS_FIELDS);
      rejectUnknownFields(r, MISS_FIELDS);
      if (!MISS_ID_RE.test(r.miss_id ?? "")) errors.push(`miss: bad miss_id '${r.miss_id}'`);
      const vocab = [
        ["miss_class", MISS_CLASS], ["artifact", ARTIFACTS], ["severity", SEVERITIES],
        ["why_missed", WHY_MISSED], ["origin_phase", PHASES], ["found_by", FOUND_BY],
        ["found_phase", PHASES], ["found_phase_gate", PHASE_GATES], ["harness", HARNESS],
        ["origin_confidence", ["linked", "inferred", "unknown"]],
      ];
      const requiredVocab = new Set(["miss_class", "artifact", "severity", "found_by", "origin_confidence", "harness"]);
      for (const [f, v] of vocab) {
        if (r[f] == null) {
          if (requiredVocab.has(f)) errors.push(`miss ${r.miss_id}: ${f} is required`);
        } else if (typeof r[f] !== "string" || !v.includes(r[f])) errors.push(`miss ${r.miss_id}: ${f}='${r[f]}' is outside the closed vocabulary`);
      }
      for (const f of ["item_id", "feature", "origin_agent", "origin_run_id", "actor", "project_type"]) {
        if (r[f] != null && (typeof r[f] !== "string" || !TOKEN_RE.test(r[f]))) errors.push(`miss ${r.miss_id}: ${f} must be null or a short token`);
      }
      if (r.origin_model != null && (typeof r.origin_model !== "string" || !r.origin_model.length)) errors.push(`miss ${r.miss_id}: origin_model must be null or a non-empty string`);
      if (r.origin_confidence !== "linked" && r.origin_model != null) errors.push(`miss ${r.miss_id}: origin_model must be null unless origin_confidence is linked`);
      if (r.origin_confidence === "linked" && r.origin_run_id == null) errors.push(`miss ${r.miss_id}: linked origin_confidence requires origin_run_id`);
      if (r.origin_confidence === "inferred" && r.origin_phase == null && r.origin_run_id == null) errors.push(`miss ${r.miss_id}: inferred origin_confidence requires origin_phase or origin_run_id`);
      if (r.origin_confidence === "unknown" && (r.origin_phase != null || r.origin_run_id != null)) errors.push(`miss ${r.miss_id}: unknown origin_confidence requires null origin_phase and origin_run_id`);
      if (r.why_missed === "instruction-ignored" && r.origin_agent == null) errors.push(`miss ${r.miss_id}: instruction-ignored requires a non-null origin_agent (agent-only)`);
    } else if (r.kind === "miss-fix") {
      requireFields(r, FIX_FIELDS.filter((f) => f !== "fix_run_id"));
      rejectUnknownFields(r, FIX_FIELDS);
      if (!missIds.has(r.miss_id)) errors.push(`orphan miss-fix: ${r.miss_id} matches no miss record`);
      if (!MISS_ID_RE.test(r.miss_id ?? "")) errors.push(`miss-fix: bad miss_id '${r.miss_id}'`);
      if (!VERDICTS_AFTER.includes(r.verdict_after)) errors.push(`miss-fix ${r.miss_id}: verdict_after='${r.verdict_after}' is not a checklist status`);
      if (!PHASES.includes(r.fix_phase)) errors.push(`miss-fix ${r.miss_id}: fix_phase='${r.fix_phase}' is outside the closed vocabulary`);
      if (!Number.isInteger(r.fix_attempt) || r.fix_attempt < 1) errors.push(`miss-fix ${r.miss_id}: fix_attempt must be a positive integer`);
      if (typeof r.reopened !== "boolean") errors.push(`miss-fix ${r.miss_id}: reopened must be boolean`);
      if (r.item_id != null && (typeof r.item_id !== "string" || !TOKEN_RE.test(r.item_id))) errors.push(`miss-fix ${r.miss_id}: item_id must be null or a short token`);
      if (Object.hasOwn(r, "fix_run_id") && r.fix_run_id == null) errors.push(`miss-fix ${r.miss_id}: null fix_run_id must be omitted`);
      if (r.fix_run_id != null && (typeof r.fix_run_id !== "string" || !TOKEN_RE.test(r.fix_run_id))) errors.push(`miss-fix ${r.miss_id}: fix_run_id must be omitted or a short token`);
      if (r.actor != null && (typeof r.actor !== "string" || !TOKEN_RE.test(r.actor))) errors.push(`miss-fix ${r.miss_id}: actor must be null or a short token`);
      const parent = parentById.get(r.miss_id);
      if (parent && r.item_id !== parent.item_id) errors.push(`miss-fix ${r.miss_id}: item_id '${r.item_id}' does not match parent item_id '${parent.item_id}'`);
      const prior = fixSequence.get(r.miss_id) ?? [];
      if (r.fix_attempt !== prior.length + 1) errors.push(`miss-fix ${r.miss_id}: fix_attempt ${r.fix_attempt} is out of sequence (expected ${prior.length + 1})`);
      const expectedReopened = prior.some((f) => f.verdict_after === "pass");
      if (r.reopened !== expectedReopened) errors.push(`miss-fix ${r.miss_id}: reopened must be ${expectedReopened}`);
      prior.push(r);
      fixSequence.set(r.miss_id, prior);
      if (r.fix_run_id != null && r.cost_attribution !== null) errors.push(`miss-fix ${r.miss_id}: raw cost_attribution must be null when fix_run_id is present`);
      if (r.fix_run_id == null && r.cost_attribution !== "none") errors.push(`miss-fix ${r.miss_id}: raw cost_attribution must be 'none' when fix_run_id is absent`);
    } else if (r.kind === "miss-amend") {
      requireFields(r, AMEND_FIELDS);
      rejectUnknownFields(r, AMEND_FIELDS);
      if (!missIds.has(r.miss_id)) errors.push(`orphan miss-amend: ${r.miss_id} matches no miss record`);
      if (!MISS_ID_RE.test(r.miss_id ?? "")) errors.push(`miss-amend: bad miss_id '${r.miss_id}'`);
      else if (!AMENDABLE.includes(r.field)) errors.push(`miss-amend ${r.miss_id}: field '${r.field}' is not amendable`);
      else if (r.field === "why_missed" && !WHY_MISSED.includes(r.value)) errors.push(`miss-amend ${r.miss_id}: value '${r.value}' is outside the why_missed vocabulary`);
    } else {
      errors.push(`unknown kind '${r.kind}' — the stream declares miss, miss-fix and miss-amend only`);
    }
  }
  // §0.2: null means "not assessed", never a zero — every distribution over
  // why_missed is denominated on records that carry it.
  const folded = foldAmends(records);
  const misses = folded.folded.filter((r) => r.kind === "miss");
  const sinceCutoff = FIELD_SINCE.why_missed;
  const eligible = misses.filter((r) => Date.parse(r.ts ?? "") >= Date.parse(`${sinceCutoff}T00:00:00Z`));
  const predates = misses.length - eligible.length;
  const assessed = eligible.filter((r) => r.why_missed != null).length;
  notes.push(`why_missed: ${assessed} of ${eligible.length} assessed`);
  if (predates > 0) notes.push(`why_missed: ${predates} record(s) predate the field (since ${sinceCutoff}) — dropped from the denominator`);
  const escapes = eligible.filter((r) => r.found_by === "human" || r.found_by === "production");
  const escapesMissingWhy = escapes.filter((r) => r.why_missed == null);
  notes.push(`escapes_missing_why: ${escapesMissingWhy.length} of ${escapes.length} eligible escape(s) arrived with no why_missed`);
  if (folded.applied) notes.push(`amendments_applied: ${folded.applied}`);
  if (folded.orphans.length) errors.push(`orphan miss-amend: ${folded.orphans.length} amend record(s) match no parent miss`);
  if (folded.overwrites) errors.push(`miss-amend: ${folded.overwrites} amend record(s) would overwrite a non-null field — invalid by the append-only rule`);
  const fixes = fixesByMiss(records);
  const backlog = misses.filter((m) => isBacklog(fixes, m.miss_id)).length;
  notes.push(`lifecycle: ${misses.length} miss record(s); ${backlog} in the backlog (outstanding-work predicate)`);
  return { errors, notes };
}

/** Enrich folded miss-fix records with the cost half at read time. The joiner
 *  only ever reads — misses.ndjson is append-only and events.ndjson is
 *  transient, so numbers are joined, never stored back. A window that cannot
 *  be resolved downgrades cost_attribution to "none": missing beats invented. */
export function enrichFixes(folded, windows) {
  const selected = folded.map((r) =>
    r.kind === "miss-fix" && r.fix_run_id != null
      ? windows?.pick(r.fix_run_id, r.fix_phase ?? null, r.ts) ?? null
      : null
  ).map((window) => !window?.complete || window?.data_quality?.valid === false ? null : window);
  const windowCount = new Map();
  for (const w of selected) if (w) windowCount.set(w, (windowCount.get(w) ?? 0) + 1);
  return folded.map((r, index) => {
    if (r.kind !== "miss-fix") return r;
    const w = selected[index];
    const n = w ? windowCount.get(w) : 0;
    const cost_attribution = w ? (n === 1 ? "sole" : `shared:${n}`) : "none";
    const divisor = w && n > 1 ? n : 1;
    const apportioned = (value, digits = null) => {
      if (typeof value !== "number") return value;
      const divided = value / divisor;
      return digits == null ? divided : Number(divided.toFixed(digits));
    };
    return {
      ...r,
      cost_attribution,
      tokens_in: w ? apportioned(w.tokens_in) : null,
      tokens_out: w ? apportioned(w.tokens_out) : null,
      cost_usd: w ? apportioned(w.cost_usd, 6) : null,
      tokens_scope: w ? w.tokens_scope : null,
      subagents: w ? {
        count: w.subagents?.count ?? 0,
        tokens_out: apportioned(w.subagents?.tokens_out ?? 0),
        cost_usd: apportioned(w.subagents?.cost_usd ?? null, 6),
      } : null,
      model: w ? w.model : null,
      data_quality: w ? w.data_quality ?? null : null,
    };
  });
}
