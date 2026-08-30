import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FIELD_SINCE, buildAmendRecord, buildFixRecord, buildMissRecord, enrichFixes,
  findLiveDuplicate, fixesByMiss, foldAmends, isBacklog, isLive, nextMissId,
  phaseWindows, resolveOrigin, validateMisses,
} from "./miss-lib.mjs";

const now = new Date("2026-08-29T12:00:00.000Z");
const cli = fileURLToPath(new URL("./playbook-miss.mjs", import.meta.url));
const telemetryCli = fileURLToPath(new URL("./playbook-telemetry.mjs", import.meta.url));
let checks = 0;

function check(name, fn) {
  try {
    fn();
    checks++;
    console.log(`ok ${checks} - ${name}`);
  } catch (error) {
    console.error(`not ok ${checks + 1} - ${name}`);
    throw error;
  }
}

function miss(overrides = {}, options = {}) {
  const args = {
    item_id: "REQ-1", feature: "feature-1", miss_class: "partial-implementation",
    artifact: "src", severity: "major", why_missed: null, origin_phase: "build",
    origin_agent: "builder", origin_run_id: null, actor: "a1", found_by: "verifier",
    found_phase: "verify", found_phase_gate: "FAIL", harness: "opencode", ...overrides,
  };
  const built = buildMissRecord(args, { records: options.records ?? [], windows: options.windows, now: options.now ?? now, project_type: options.project_type ?? null });
  assert.equal(built.errors, undefined, built.errors?.join("; "));
  return built.record;
}

function fix(parent, overrides = {}, records = [parent]) {
  const built = buildFixRecord({ miss_id: parent.miss_id, ...overrides }, { records, now });
  assert.equal(built.errors, undefined, built.errors?.join("; "));
  return built.record;
}

function run(script, args, { cwd, telemetry = false } = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd, encoding: "utf8", env: { ...process.env, PLAYBOOK_TELEMETRY: telemetry ? "1" : "0" },
  });
}

check("nextMissId combines timestamp and injectable entropy and retries existing collisions", () => {
  const suffix = (entropy) => `${now.getTime()}${String(entropy).padStart(20, "0")}`;
  const records = [{ kind: "miss", miss_id: `MISS-20260829-${suffix(7)}` }];
  const id = nextMissId(records, now, { entropy: (attempt) => BigInt(attempt + 7) });
  assert.equal(id, `MISS-20260829-${suffix(8)}`);
  assert.match(id, /^MISS-\d{8}-\d{2,}$/);
});

check("foldAmends completes null without mutating the raw parent and handles merged order", () => {
  const parent = miss();
  const amend = { kind: "miss-amend", ts: now.toISOString(), schema: 1, miss_id: parent.miss_id, field: "why_missed", value: "ambiguous-acceptance" };
  const folded = foldAmends([amend, parent]);
  assert.equal(parent.why_missed, null);
  assert.notEqual(folded.folded[0], parent);
  assert.equal(folded.folded[0].why_missed, "ambiguous-acceptance");
  assert.equal(folded.applied, 1);
});

check("foldAmends never applies an invalid closed-vocabulary amend", () => {
  const parent = miss();
  const invalid = { kind: "miss-amend", ts: now.toISOString(), schema: 1, miss_id: parent.miss_id, field: "why_missed", value: "free text" };
  const valid = { ...invalid, value: "other" };
  const folded = foldAmends([invalid, parent, valid]);
  assert.equal(folded.folded[0].why_missed, "other");
  assert.deepEqual([folded.applied, folded.invalid, folded.ignored], [1, 1, 1]);
  assert.match(validateMisses([invalid, parent, valid]).errors.join("\n"), /outside the why_missed vocabulary/);
});

check("amend builder accepts null completion and rejects overwrite and orphan", () => {
  const parent = miss();
  const first = buildAmendRecord(parent.miss_id, "why_missed", "other", { records: [parent], now });
  assert.ok(first.record);
  const overwrite = buildAmendRecord(parent.miss_id, "why_missed", "ambiguous-acceptance", { records: [parent, first.record], now });
  assert.match(overwrite.errors.join(" "), /never overwrite/);
  const orphan = buildAmendRecord("MISS-20260829-99", "why_missed", "other", { records: [parent], now });
  assert.match(orphan.errors.join(" "), /cannot create/);
  const rawOverwrite = foldAmends([{ ...parent, why_missed: "other" }, first.record]);
  assert.equal(rawOverwrite.ignored, 1);
});

check("live and backlog predicates deliberately diverge for abandoned records", () => {
  const parent = miss();
  const failed = fix(parent, { verdict_after: "fail" });
  let byMiss = fixesByMiss([parent, failed]);
  assert.equal(isLive(byMiss, parent.miss_id), true);
  assert.equal(isBacklog(byMiss, parent.miss_id), true);
  const abandoned = fix(parent, { verdict_after: "abandoned" }, [parent, failed]);
  byMiss = fixesByMiss([parent, failed, abandoned]);
  assert.equal(isLive(byMiss, parent.miss_id), true);
  assert.equal(isBacklog(byMiss, parent.miss_id), false);
  assert.equal(findLiveDuplicate([parent, failed, abandoned], parent.item_id, parent.miss_class)?.miss_id, parent.miss_id);
  const passed = fix(parent, { verdict_after: "pass" }, [parent, failed, abandoned]);
  byMiss = fixesByMiss([parent, failed, abandoned, passed]);
  assert.equal(isLive(byMiss, parent.miss_id), false);
  assert.equal(isBacklog(byMiss, parent.miss_id), false);
});

check("fixed/close records derive linkage, attempt, reopened and raw attribution", () => {
  const parent = miss();
  const first = fix(parent, { verdict_after: "pass", fix_run_id: "run-1", item_id: parent.item_id });
  assert.deepEqual([first.item_id, first.fix_attempt, first.reopened, first.cost_attribution], [parent.item_id, 1, false, null]);
  const second = fix(parent, { verdict_after: "fail" }, [parent, first]);
  assert.deepEqual([second.fix_attempt, second.reopened, second.cost_attribution], [2, true, "none"]);
  const mismatch = buildFixRecord({ miss_id: parent.miss_id, item_id: "REQ-2" }, { records: [parent], now });
  assert.match(mismatch.errors.join(" "), /does not match parent/);
});

check("caller-derived numeric and provenance fields are refused", () => {
  const forged = buildMissRecord({
    item_id: "REQ-1", miss_class: "regression", artifact: "src", severity: "major", found_by: "human",
    origin_model: "forged/model", origin_confidence: "linked", tokens_out: 999,
  }, { records: [], now });
  assert.match(forged.errors.join(" "), /origin_model is emitter-derived/);
  assert.match(forged.errors.join(" "), /tokens_out is emitter-derived/);
  const parent = miss();
  const forgedFix = buildFixRecord({ miss_id: parent.miss_id, cost_attribution: "sole", cost_usd: 1 }, { records: [parent], now });
  assert.match(forgedFix.errors.join(" "), /cost_attribution is emitter-derived/);
});

check("origin lookup maps framework phases to commands and failed lookup forces null/inferred", () => {
  const events = [
    { kind: "phase-start", command: "feature-plan", sessionID: "run-1", ts: "2026-08-29T10:00:00Z" },
    { kind: "turn", sessionID: "run-1", messageID: "p", model: "model/plan", tokens: {}, cost: 0 },
    { kind: "phase-end", sessionID: "run-1", ts: "2026-08-29T10:01:00Z" },
    { kind: "phase-start", command: "implement", sessionID: "run-1", ts: "2026-08-29T10:02:00Z" },
    { kind: "turn", sessionID: "run-1", messageID: "b", model: "model/build", tokens: {}, cost: 0 },
    { kind: "phase-end", sessionID: "run-1", ts: "2026-08-29T10:03:00Z" },
  ];
  const windows = phaseWindows(events);
  assert.deepEqual(resolveOrigin({ origin_run_id: "run-1", origin_phase: "plan" }, windows), { origin_model: "model/plan", origin_confidence: "linked" });
  const linked = miss({ origin_run_id: "run-1", origin_phase: "plan" }, { windows });
  assert.equal(linked.origin_model, "model/plan");
  assert.deepEqual(resolveOrigin({ origin_run_id: "run-1", origin_phase: "build", ts: now.toISOString() }, windows), { origin_model: "model/build", origin_confidence: "linked" });
  assert.deepEqual(resolveOrigin({ origin_run_id: "run-1", origin_phase: "human-acceptance", ts: now.toISOString() }, windows), { origin_model: null, origin_confidence: "inferred" });
  assert.deepEqual(resolveOrigin({ origin_run_id: "missing", origin_phase: "build" }, windows), { origin_model: null, origin_confidence: "inferred" });
});

check("phaseWindows isolates interleaved roots, follows recursive parents and dedupes by session plus message", () => {
  const events = [
    { kind: "phase-start", command: "implement", sessionID: "root-a", ts: "2026-08-29T10:00:00Z" },
    { kind: "turn", sessionID: "root-a", parentID: null, messageID: "same", model: "model/a", tokens: { output: 1 }, cost: 0.01 },
    { kind: "phase-start", command: "verify", sessionID: "root-b", ts: "2026-08-29T10:00:10Z" },
    { kind: "turn", sessionID: "root-b", parentID: null, messageID: "same", model: "model/b", tokens: { output: 4 }, cost: 0.04 },
    { kind: "turn", sessionID: "root-a", parentID: null, messageID: "same", model: "model/a", tokens: { output: 2 }, cost: 0.02 },
    { kind: "turn", sessionID: "child-a", parentID: "root-a", messageID: "same", model: "model/a-child", tokens: { output: 3 }, cost: 0.03 },
    // The grandchild precedes its parent's turn; the parent pre-pass still
    // resolves the complete root-b chain without assigning it to root-a.
    { kind: "turn", sessionID: "grandchild-b", parentID: "child-b", messageID: "g", model: "model/b-child", tokens: { output: 5 }, cost: 0.05 },
    { kind: "turn", sessionID: "child-b", parentID: "root-b", messageID: "c", model: "model/b-child", tokens: { output: 6 }, cost: 0.06 },
    { kind: "turn", sessionID: "unrelated", parentID: null, messageID: "u", model: "model/unrelated", tokens: { output: 100 }, cost: 1 },
    { kind: "phase-end", sessionID: "root-a", ts: "2026-08-29T10:01:00Z" },
    { kind: "phase-end", sessionID: "root-b", ts: "2026-08-29T10:01:10Z" },
  ];
  const windows = phaseWindows(events);
  const a = windows.pick("root-a", "build", now.toISOString());
  const b = windows.pick("root-b", "verify", now.toISOString());
  assert.deepEqual([a.tokens_out, a.turns, a.subagents.count], [5, 2, 1]);
  assert.deepEqual([b.tokens_out, b.turns, b.subagents.count], [15, 3, 2]);
  assert.equal(windows.all.reduce((sum, w) => sum + w.tokens_out, 0), 20);
});

check("assessment and escape notes are computed after amendments and respect FIELD_SINCE", () => {
  const current = miss({ found_by: "human" });
  const old = { ...miss({ item_id: "REQ-old", found_by: "human" }, { now: new Date("2026-08-27T12:00:00Z") }), miss_id: "MISS-20260827-01" };
  const amend = buildAmendRecord(current.miss_id, "why_missed", "other", { records: [current, old], now }).record;
  assert.ok(validateMisses([current, old]).notes.includes("escapes_missing_why: 1 of 1 eligible escape(s) arrived with no why_missed"));
  const result = validateMisses([current, old, amend]);
  assert.ok(result.notes.includes("why_missed: 1 of 1 assessed"));
  assert.ok(result.notes.some((n) => n.includes(`predate the field (since ${FIELD_SINCE.why_missed})`)));
  assert.ok(result.notes.includes("escapes_missing_why: 0 of 1 eligible escape(s) arrived with no why_missed"));
});

check("validation rejects duplicates, orphans, missing values, bad types and raw enrichment", () => {
  const parent = miss();
  const duplicate = { ...parent };
  const orphanFix = { ...fix(parent), miss_id: "MISS-20260829-99", item_id: "REQ-99" };
  const orphanAmend = { kind: "miss-amend", ts: now.toISOString(), schema: 1, miss_id: "MISS-20260829-98", field: "why_missed", value: "other" };
  const invalid = { ...parent, miss_class: null, tokens_out: 10, ts: "yesterday" };
  const badAttribution = { ...fix(parent, { fix_run_id: "run-1" }), cost_attribution: "sole" };
  const result = validateMisses([parent, duplicate, orphanFix, orphanAmend, invalid, badAttribution]);
  const text = result.errors.join("\n");
  assert.match(text, /duplicate miss_id/);
  assert.match(text, /orphan miss-fix/);
  assert.match(text, /orphan miss-amend/);
  assert.match(text, /miss_class is required/);
  assert.match(text, /derived field 'tokens_out'/);
  assert.match(text, /ts is not ISO-8601/);
  assert.match(text, /raw cost_attribution must be null/);
});

check("instruction-ignored is agent-only", () => {
  const invalid = buildMissRecord({ miss_class: "standards-violation", artifact: "src", severity: "major", why_missed: "instruction-ignored", found_by: "human" }, { records: [], now });
  assert.match(invalid.errors.join(" "), /origin_agent is required/);
  const parent = miss({ why_missed: "instruction-ignored", origin_agent: "builder" });
  assert.equal(validateMisses([parent]).errors.length, 0);
  const handWritten = { ...parent, origin_agent: null };
  assert.match(validateMisses([handWritten]).errors.join(" "), /agent-only/);
});

check("shared fix windows are divided equally and missing windows enrich as none", () => {
  const one = miss({ item_id: "REQ-1" });
  const two = { ...miss({ item_id: "REQ-2" }), miss_id: "MISS-20260829-02" };
  const f1 = fix(one, { fix_run_id: "run-shared" });
  const f2 = fix(two, { fix_run_id: "run-shared" }, [one, two]);
  const sharedWindow = {
    tokens_in: 101, tokens_out: 41, cost_usd: 0.3, tokens_scope: "tree", model: "model/fix",
    subagents: { count: 1, tokens_out: 9, cost_usd: 0.06 },
  };
  const window = {
    pick(id) {
      return id === "run-shared" ? sharedWindow : null;
    },
  };
  const enriched = enrichFixes([one, f1, two, f2], window).filter((r) => r.kind === "miss-fix");
  for (const row of enriched) {
    assert.equal(row.cost_attribution, "shared:2");
    assert.deepEqual([row.tokens_in, row.tokens_out, row.cost_usd], [50.5, 20.5, 0.15]);
    assert.deepEqual(row.subagents, { count: 1, tokens_out: 4.5, cost_usd: 0.03 });
  }
  const none = enrichFixes([fix(one, { fix_run_id: "gone" })], { pick: () => null })[0];
  assert.equal(none.cost_attribution, "none");
  assert.equal(none.tokens_out, null);
  assert.equal(none.subagents, null);
});

check("fix enrichment honors fix_phase, timestamp and exact repeated window identity", () => {
  const events = [
    { kind: "phase-start", command: "implement", sessionID: "reused", ts: "2026-08-29T09:00:00Z" },
    { kind: "turn", sessionID: "reused", messageID: "i", model: "model/implement", tokens: { output: 90 }, cost: 0.9 },
    { kind: "phase-end", sessionID: "reused", ts: "2026-08-29T09:10:00Z" },
    { kind: "phase-start", command: "verify", sessionID: "reused", ts: "2026-08-29T10:00:00Z" },
    { kind: "turn", sessionID: "reused", messageID: "v1", model: "model/verify-1", tokens: { input: 20, output: 10 }, cost: 0.1 },
    { kind: "phase-end", sessionID: "reused", ts: "2026-08-29T10:10:00Z" },
    { kind: "phase-start", command: "verify", sessionID: "reused", ts: "2026-08-29T11:00:00Z" },
    { kind: "turn", sessionID: "reused", messageID: "v2", model: "model/verify-2", tokens: { input: 40, output: 20 }, cost: 0.2 },
    { kind: "turn", sessionID: "verify-child", parentID: "reused", messageID: "vc", model: "model/verify-child", tokens: { output: 4 }, cost: 0.04 },
    { kind: "phase-end", sessionID: "reused", ts: "2026-08-29T11:10:00Z" },
    { kind: "phase-start", command: "fix", sessionID: "reused", ts: "2026-08-29T12:00:00Z" },
    { kind: "turn", sessionID: "reused", messageID: "f", model: "model/fix", tokens: { input: 60, output: 30 }, cost: 0.3 },
    { kind: "phase-end", sessionID: "reused", ts: "2026-08-29T12:10:00Z" },
  ];
  const parents = [
    miss({ item_id: "REQ-v1" }),
    { ...miss({ item_id: "REQ-v2" }), miss_id: "MISS-20260829-02" },
    { ...miss({ item_id: "REQ-v3" }), miss_id: "MISS-20260829-03" },
    { ...miss({ item_id: "REQ-f" }), miss_id: "MISS-20260829-04" },
  ];
  const closes = [
    { ...fix(parents[0], { fix_run_id: "reused", fix_phase: "verify" }), ts: "2026-08-29T10:05:00Z" },
    { ...fix(parents[1], { fix_run_id: "reused", fix_phase: "verification-results-gate" }, parents), ts: "2026-08-29T11:05:00Z" },
    { ...fix(parents[2], { fix_run_id: "reused", fix_phase: "verify" }, parents), ts: "2026-08-29T11:06:00Z" },
    { ...fix(parents[3], { fix_run_id: "reused", fix_phase: "fix" }, parents), ts: "2026-08-29T12:05:00Z" },
  ];
  const enriched = enrichFixes(closes, phaseWindows(events));
  assert.deepEqual(enriched.map((r) => r.cost_attribution), ["sole", "shared:2", "shared:2", "sole"]);
  assert.deepEqual(enriched.map((r) => r.model), ["model/verify-1", "model/verify-2", "model/verify-2", "model/fix"]);
  assert.deepEqual([enriched[0].tokens_out, enriched[1].tokens_out, enriched[3].tokens_out], [10, 12, 30]);
  assert.equal(enriched[1].subagents.count, 1);
  assert.equal(enriched[2].subagents.count, 1);
  assert.equal(enriched[1].subagents.tokens_out, 2);
});

check("CLI reads always work, writes are opt-in, --if-new collapses and --fixed closes", () => {
  const dir = mkdtempSync(join(tmpdir(), "playbook-misses-cli-"));
  try {
    const stream = join(dir, "absolute-misses.ndjson");
    let result = run(cli, ["next-id", `--misses=${stream}`], { cwd: dir });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /MISS-\d{8}-\d{2,}/);
    result = run(cli, ["open", `--misses=${stream}`, "--miss-class=regression", "--artifact=src", "--severity=major", "--found-by=verifier", "--item-id=REQ-1"], { cwd: dir });
    assert.equal(result.status, 0);
    assert.equal(existsSync(stream), false);
    const openArgs = ["open", `--misses=${stream}`, "--miss-class=regression", "--artifact=src", "--severity=major", "--found-by=verifier", "--item-id=REQ-1", "--if-new"];
    result = run(cli, openArgs, { cwd: dir, telemetry: true });
    assert.equal(result.status, 0);
    result = run(cli, openArgs, { cwd: dir, telemetry: true });
    assert.match(result.stdout, /collapsed:/);
    assert.equal(readFileSync(stream, "utf8").trim().split("\n").length, 1);
    const firstId = JSON.parse(readFileSync(stream, "utf8").trim()).miss_id;
    result = run(cli, ["close", `--misses=${stream}`, `--miss-id=${firstId}`], { cwd: dir, telemetry: true });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /closed/);
    result = run(cli, ["open", `--misses=${stream}`, "--miss-class=wrong-behaviour", "--artifact=src", "--severity=minor", "--found-by=self-review", "--item-id=REQ-2", "--fixed"], { cwd: dir, telemetry: true });
    assert.equal(result.status, 0);
    assert.equal(readFileSync(stream, "utf8").trim().split("\n").length, 4);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

check("placeholder project_type becomes null and tier appears only on enriched fixes", () => {
  const dir = mkdtempSync(join(tmpdir(), "playbook-misses-join-"));
  try {
    mkdirSync(join(dir, "playbook"));
    writeFileSync(join(dir, "playbook", "environment-profile.yml"), 'project_type: "<replace: stack>"\n');
    const stream = join(dir, "misses.ndjson");
    let result = run(cli, ["open", `--misses=${stream}`, "--miss-class=regression", "--artifact=src", "--severity=major", "--found-by=verifier", "--item-id=REQ-1", "--fixed", "--fix-run-id=run-1"], { cwd: dir, telemetry: true });
    assert.equal(result.status, 0);
    const raw = readFileSync(stream, "utf8").trim().split("\n").map(JSON.parse);
    assert.equal(raw[0].project_type, null);
    const events = join(dir, "events.ndjson");
    writeFileSync(events, [
      { kind: "phase-start", command: "fix", sessionID: "run-1", ts: "2026-08-29T10:00:00Z" },
      { kind: "turn", sessionID: "run-1", messageID: "m1", model: "model/fix", tokens: { input: 10, output: 4 }, cost: 0.01 },
      { kind: "phase-end", sessionID: "run-1", ts: "2026-08-29T10:01:00Z" },
    ].map(JSON.stringify).join("\n") + "\n");
    result = run(telemetryCli, ["--misses", `--misses-file=${stream}`, `--events=${events}`], { cwd: dir });
    assert.equal(result.status, 0, result.stderr);
    const output = result.stdout.trim().split("\n").map(JSON.parse);
    assert.equal(Object.hasOwn(output[0], "tier"), false);
    assert.equal(Object.hasOwn(output[1], "tier"), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

console.log(`miss telemetry checks passed (${checks})`);
