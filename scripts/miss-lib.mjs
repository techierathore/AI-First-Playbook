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
 * Design: docs/Miss-Telemetry-AI-First-Playbook.md. Provenance rules that
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
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";

export const MISS_SCHEMA = 1;

// ── closed vocabularies (docs/Miss-Telemetry-AI-First-Playbook.md §4.1) ─────
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
export const HARNESS = ["opencode", "claude-code"];
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
const ENRICHED_FIELDS = ["tokens_in", "tokens_out", "cost_usd", "tokens_scope", "subagents", "model", "tier"];
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

export function nextMissId(records, now = new Date(), { entropy = () => randomBytes(8), maxAttempts = 100 } = {}) {
  const day = now.toISOString().slice(0, 10).replaceAll("-", "");
  const prefix = `MISS-${day}-`;
  const existing = new Set((records ?? []).filter((r) => r.kind === "miss").map((r) => r.miss_id));
  const timestamp = String(now.getTime());
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const raw = entropy(attempt);
    let n;
    if (typeof raw === "bigint") n = raw;
    else if (typeof raw === "number" && Number.isSafeInteger(raw)) n = BigInt(raw);
    else if (typeof raw === "string" && /^\d+$/.test(raw)) n = BigInt(raw);
    else if (raw instanceof Uint8Array) {
      const hex = Buffer.from(raw).toString("hex");
      n = BigInt(`0x${hex || "0"}`);
    } else throw new TypeError("miss id entropy must be a non-negative integer or byte array");
    if (n < 0n) throw new TypeError("miss id entropy must be non-negative");
    const candidate = `${prefix}${timestamp}${String(n).padStart(20, "0")}`;
    if (!existing.has(candidate)) return candidate;
  }
  throw new Error(`could not allocate a collision-free miss id after ${maxAttempts} attempts`);
}

// ── events.ndjson windows (the only source of numbers; transient by design) ─
export function readEvents(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
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
  const windows = new Map();
  const all = [];
  const active = new Map();
  const parents = new Map();
  const order = new WeakMap();
  let anon = 0;
  let phaseOrder = 0;
  // Parent rows can arrive after an earlier child update in a merged event
  // stream. Learn every non-null edge first so routing is deterministic.
  for (const e of events) {
    if (e.kind === "turn" && e.sessionID != null && e.parentID != null) parents.set(e.sessionID, e.parentID);
  }
  const finalize = (p) => {
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
      const isChild = e.sessionID != null && p.session_id != null && e.sessionID !== p.session_id;
      if (isChild) {
        childSessions.add(e.sessionID ?? e.parentID);
        sub_tokens_out += out;
        sub_cost += e.cost ?? 0;
      }
    }
    const model = Object.entries(p.models).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const w = {
      command: p.command, session_id: p.session_id, started: p.started, ended: p.ended ?? p.started,
      model, tokens_in: p.tokens_in, tokens_out: p.tokens_out, cost_usd: Number(p.cost_usd.toFixed(6)),
      turns: p.turns,
      tokens_scope: childSessions.size ? "tree" : "main",
      subagents: { count: childSessions.size, tokens_out: sub_tokens_out, cost_usd: Number(sub_cost.toFixed(6)) },
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
  for (const e of events) {
    if (e.kind === "phase-start") {
      const prior = active.get(e.sessionID);
      if (prior) finalize(prior);
      active.set(e.sessionID, {
        command: e.command, session_id: e.sessionID, started: e.ts,
        byMessage: new Map(), order: phaseOrder++,
      });
    } else if (e.kind === "turn") {
      const owner = ownerFor(e.sessionID);
      if (owner) {
        // message ids are session-local; two child sessions may legitimately
        // use the same id and both must remain in the phase total.
        const key = e.messageID == null ? `anon-${anon++}` : JSON.stringify([e.sessionID ?? null, e.messageID]);
        owner.byMessage.set(key, e);
      }
    } else if (e.kind === "phase-end") {
      const current = active.get(e.sessionID);
      if (!current) continue;
      current.ended = e.ts;
      finalize(current);
      active.delete(e.sessionID);
    }
  }
  for (const current of active.values()) finalize(current);
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
        && Date.parse(w.started) <= cutoff
      );
      return candidates.reduce((latest, w) => {
        if (!latest) return w;
        const delta = Date.parse(w.started) - Date.parse(latest.started);
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
  if (w) return { origin_model: w.model, origin_confidence: "linked" };
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

export function buildMissRecord(args, { records = [], windows, now = new Date(), project_type = null, idEntropy } = {}) {
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
      miss_id: nextMissId(records, now, { entropy: idEntropy }),
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
  );
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
        cost_usd: apportioned(w.subagents?.cost_usd ?? 0, 6),
      } : null,
      model: w ? w.model : null,
    };
  });
}
