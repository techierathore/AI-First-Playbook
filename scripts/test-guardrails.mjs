import { readFileSync, existsSync } from "node:fs";
const policyUrl = new URL("../harness/opencode/plugin/write-policy.mjs", import.meta.url);
const source = readFileSync(policyUrl, "utf8");
const required = ["normalizePath", "traverses the repository", "isSymbolicLink", "shellWriteTargets", "apply_patch", "verification/"];
const missing = required.filter((term) => !source.includes(term));
if (missing.length) { console.error(`guardrail coverage missing: ${missing.join(", ")}`); process.exit(1); }
for (const carrier of ["../harness/opencode/plugin/spec-guardrails.ts", "../harness/claude-code/hooks/spec-guardrails-hook.mjs"]) {
  const url = new URL(carrier, import.meta.url);
  if (!existsSync(url)) { console.error(`guardrail carrier missing: ${carrier}`); process.exit(1); }
  if (!readFileSync(url, "utf8").includes("write-policy.mjs")) { console.error(`guardrail carrier does not use shared policy: ${carrier}`); process.exit(1); }
}
const { evaluateToolCall } = await import(policyUrl);
const blocked = evaluateToolCall({ tool: "write", args: { filePath: "Feature-Gap-Report.md" }, isVerifier: true });
const allowed = evaluateToolCall({ tool: "write", args: { filePath: "verification/feature/run-1/probe.cs" }, isVerifier: true });
if (!blocked || allowed) { console.error("guardrail policy behavioral check failed"); process.exit(1); }
console.log("guardrail policy coverage passed");

// ── YOLO policy: git writes denied, everything else allowed, limit parsing ──
{
  const yoloUrl = new URL("../harness/opencode/plugin/yolo-policy.mjs", import.meta.url);
  for (const carrier of ["../harness/opencode/plugin/yolo.ts", "../harness/claude-code/hooks/yolo-hook.mjs", "./playbook-yolo.mjs"]) {
    const url = new URL(carrier, import.meta.url);
    if (!existsSync(url)) { console.error(`yolo carrier missing: ${carrier}`); process.exit(1); }
    if (!readFileSync(url, "utf8").includes("yolo-policy.mjs")) { console.error(`yolo carrier does not use shared policy: ${carrier}`); process.exit(1); }
  }
  const y = await import(yoloUrl);
  const fail = (msg) => { console.error(`yolo policy check failed: ${msg}`); process.exit(1); };
  const denied = ["git commit -m x", "cd src && git push origin main", "git add .", "git -C /r tag v1", "npm test; git reset --hard", "git branch -D feature", "git stash", "git checkout -- .", "gh pr create --fill", "git rebase -i HEAD~3"];
  const allowed = ["git status", "git log --oneline -5", "git diff HEAD", "git show abc123", "git blame file.cs", "git branch", "git stash list", "GIT_PAGER=cat git diff --stat", "rm -rf build/", "rmdir /s old", "dotnet build", "git fetch origin"];
  for (const c of denied) if (y.yoloDecision({ tool: "Bash", args: { command: c } }).decision !== "deny") fail(`should deny: ${c}`);
  for (const c of allowed) if (y.yoloDecision({ tool: "Bash", args: { command: c } }).decision !== "allow") fail(`should allow: ${c}`);
  if (y.yoloDecision({ tool: "Write", args: { file_path: "x.md" } }).decision !== "allow") fail("file writes must be allowed");
  if (!y.isYoloEnv({ PLAYBOOK_YOLO: "1" }) || y.isYoloEnv({})) fail("isYoloEnv");
  if (!y.hasYoloToken("/implement YOLO docs/x.md") || !y.hasYoloToken("*YOLO* please") || y.hasYoloToken("yoloswag mode")) fail("hasYoloToken");
  const now = new Date("2026-08-21T10:00:00Z"); const env = { PLAYBOOK_TZ: "UTC" };
  const cases = [
    ["You've hit your session limit · resets 3:45pm", "2026-08-21T16:00:00.000Z"],
    ["You've hit your weekly limit · resets Mon 12:00am", "2026-08-22T10:00:00.000Z"], // capped at 24h, re-checked daily
    ["rate limit: resets at 2:30pm (America/Los_Angeles)", "2026-08-21T21:45:00.000Z"],
    ["rate_limit_error retry-after: 120", "2026-08-21T10:17:00.000Z"],
    ["Rate limited, resets in 2 hours 13 minutes", "2026-08-21T12:28:00.000Z"],
    ["429 anthropic-ratelimit-input-tokens-reset: 2026-08-21T15:30:00Z", "2026-08-21T15:45:00.000Z"],
    ["You have reached your API usage limits. You will regain access on 2026-09-01 at 00:00 UTC.", "2026-08-22T10:00:00.000Z"],
  ];
  for (const [text, retry] of cases) {
    const plan = y.rateLimitPlan(text, { now, env });
    if (!plan) fail(`not recognised as a limit: ${text}`);
    if (plan.retryAt.toISOString() !== retry) fail(`${text} → retry ${plan.retryAt.toISOString()}, expected ${retry}`);
  }
  const unparsed = y.rateLimitPlan("usage limit reached, try later", { now, env });
  if (!unparsed || unparsed.parsed || unparsed.waitMs !== 60 * 60000) fail("unparsed limit should wait the default 60 min");
  if (y.rateLimitPlan("error CS1002: ; expected", { now, env })) fail("compiler error misread as a limit");
  if (y.runOutcome("done\nPLAYBOOK_RUN_COMPLETE: 19/19 items to-verify") !== "complete") fail("complete sentinel");
  if (y.runOutcome("PLAYBOOK_RUN_BLOCKED: KeyVault secret missing") !== "blocked") fail("blocked sentinel");
  if (y.runOutcome("still working") !== "unknown") fail("unknown outcome");
  console.log("yolo policy checks passed");
}

// ── telemetry joiner: subagent accounting ───────────────────────────────────
// Fixture: one parent session + one child (subagent) session inside a single
// phase. Totals must include the child; tokens_scope/subagents must attribute it.
{
  const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { execFileSync } = await import("node:child_process");
  const dir = mkdtempSync(join(tmpdir(), "playbook-telemetry-"));
  try {
    const rows = [
      { kind: "phase-start", command: "verify", sessionID: "ses_parent", ts: "2026-08-21T00:00:00Z" },
      { kind: "turn", sessionID: "ses_parent", parentID: null, messageID: "m1", model: "anthropic/claude-sonnet-5", tokens: { input: 100, output: 10, reasoning: 0, cache: { read: 0, write: 0 } }, cost: 0.01, ts: "2026-08-21T00:00:01Z" },
      { kind: "turn", sessionID: "ses_child", parentID: "ses_parent", messageID: "m2", model: "anthropic/claude-haiku-4-5", tokens: { input: 50, output: 5, reasoning: 2, cache: { read: 0, write: 0 } }, cost: 0.002, ts: "2026-08-21T00:00:02Z" },
      { kind: "turn", sessionID: "ses_child", parentID: "ses_parent", messageID: "m2", model: "anthropic/claude-haiku-4-5", tokens: { input: 50, output: 7, reasoning: 3, cache: { read: 0, write: 0 } }, cost: 0.003, ts: "2026-08-21T00:00:03Z" },
      { kind: "turn", sessionID: "ses_parent", parentID: null, messageID: "m3", model: "anthropic/claude-sonnet-5", tokens: { input: 200, output: 20, reasoning: 0, cache: { read: 0, write: 0 } }, cost: 0.02, ts: "2026-08-21T00:00:04Z" },
      { kind: "phase-end", sessionID: "ses_parent", ts: "2026-08-21T00:00:05Z" },
      // second phase: main session only — scope must be "main"
      { kind: "phase-start", command: "fix", sessionID: "ses_parent", ts: "2026-08-21T00:01:00Z" },
      { kind: "turn", sessionID: "ses_parent", parentID: null, messageID: "m4", model: "anthropic/claude-sonnet-5", tokens: { input: 10, output: 1, reasoning: 0, cache: { read: 0, write: 0 } }, cost: 0.001, ts: "2026-08-21T00:01:01Z" },
      { kind: "phase-end", sessionID: "ses_parent", ts: "2026-08-21T00:01:02Z" },
    ];
    writeFileSync(join(dir, "events.ndjson"), rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
    const script = new URL("./playbook-telemetry.mjs", import.meta.url);
    const out = execFileSync(process.execPath, [script.pathname, "--events=events.ndjson"], { cwd: dir, encoding: "utf8" });
    const [verify, fix] = out.trim().split("\n").map((l) => JSON.parse(l));
    const fail = (msg) => { console.error(`telemetry subagent check failed: ${msg}\n${out}`); process.exit(1); };
    if (verify.phase !== "verify" || fix.phase !== "fix") fail("phase order");
    if (verify.tokens_out !== 40) fail(`total tokens_out ${verify.tokens_out} (expected 40: parent 30 + child 10, last row per messageID)`);
    if (verify.tokens_in !== 350) fail(`total tokens_in ${verify.tokens_in}`);
    if (verify.cost_usd !== 0.033) fail(`total cost_usd ${verify.cost_usd}`);
    if (verify.turns !== 3) fail(`turns ${verify.turns}`);
    if (verify.tokens_scope !== "tree") fail(`tokens_scope ${verify.tokens_scope}`);
    if (verify.subagents?.count !== 1 || verify.subagents.tokens_out !== 10 || verify.subagents.cost_usd !== 0.003) fail(`subagents rollup ${JSON.stringify(verify.subagents)}`);
    if (fix.tokens_scope !== "main" || fix.subagents?.count !== 0 || fix.subagents.tokens_out !== 0) fail(`main-only phase ${fix.tokens_scope} ${JSON.stringify(fix.subagents)}`);
    for (const k of ["phase", "model", "tier", "tokens_in", "tokens_out", "cost_usd", "attempt", "gate_verdict", "project_type", "timestamp", "session_id", "harness", "granularity", "turns"]) {
      if (!(k in verify)) fail(`existing field missing: ${k}`);
    }
    console.log("telemetry subagent accounting passed");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
