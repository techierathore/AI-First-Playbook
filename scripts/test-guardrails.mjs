import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
const policyUrl = new URL("../harness/opencode/plugin/write-policy.mjs", import.meta.url);
const source = readFileSync(policyUrl, "utf8");
const required = ["normalizePath", "traverses the repository", "isSymbolicLink", "shellWriteTargets", "apply_patch", "verification/", "playbook-miss.mjs"];
const missing = required.filter((term) => !source.includes(term));
if (missing.length) { console.error(`guardrail coverage missing: ${missing.join(", ")}`); process.exit(1); }
for (const copy of ["../.opencode/plugin/write-policy.mjs"]) {
  const url = new URL(copy, import.meta.url);
  if (!existsSync(url)) { console.error(`guardrail policy copy missing: ${copy}`); process.exit(1); }
  if (readFileSync(url, "utf8") !== source) { console.error(`guardrail policy copy drift: ${copy}`); process.exit(1); }
}
for (const carrier of ["../harness/opencode/plugin/spec-guardrails.ts"]) {
  const url = new URL(carrier, import.meta.url);
  if (!existsSync(url)) { console.error(`guardrail carrier missing: ${carrier}`); process.exit(1); }
  if (!readFileSync(url, "utf8").includes("write-policy.mjs")) { console.error(`guardrail carrier does not use shared policy: ${carrier}`); process.exit(1); }
}
for (const agent of ["analyst.md", "builder.md", "orchestrator.md", "verifier.md"]) {
  const canonical = readFileSync(new URL(`../harness/opencode/agent/${agent}`, import.meta.url), "utf8");
  const local = readFileSync(new URL(`../.opencode/agent/${agent}`, import.meta.url), "utf8");
  if (local !== canonical) { console.error(`OpenCode agent copy drift: ${agent}`); process.exit(1); }
}
{
  const canonical = readFileSync(new URL("../harness/opencode/plugin/telemetry.ts", import.meta.url), "utf8");
  const local = readFileSync(new URL("../.opencode/plugin/telemetry.ts", import.meta.url), "utf8");
  if (local !== canonical) { console.error("OpenCode telemetry plugin copy drift"); process.exit(1); }
  for (const requiredTerm of ["randomUUID()", 'kind: "subagent-start"', 'kind: "subagent-end"', 'kind: "tool-start"', 'kind: "tool-end"', "activeMs"]) {
    if (!canonical.includes(requiredTerm)) { console.error(`OpenCode telemetry plugin missing schema-2 capture: ${requiredTerm}`); process.exit(1); }
  }
  if (canonical.includes("input.arguments")) { console.error("OpenCode telemetry plugin persists raw command arguments"); process.exit(1); }
}
const harnessPromptFiles = [
  "commands/verify.md",
  "agents/verifier.md",
  "commands/log-miss.md",
  "commands/implement.md",
  "commands/fix.md",
  "commands/analyze-fix.md",
];
for (const relative of harnessPromptFiles) {
  const canonicalRelative = relative.replace("commands/", "command/").replace("agents/", "agent/");
  const canonical = readFileSync(new URL(`../harness/opencode/${canonicalRelative}`, import.meta.url), "utf8");
  if (canonical.includes("<current-harness>")) { console.error(`OpenCode prompt has unresolved harness placeholder: ${canonicalRelative}`); process.exit(1); }
}

// ── OpenCode-only validator: deny integration artifacts without rejecting
// ordinary provider/model identifiers used by OpenCode. ──────────────────────
{
  const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { spawnSync } = await import("node:child_process");
  const sandbox = mkdtempSync(join(tmpdir(), "playbook-open-code-only-"));
  const fixture = join(sandbox, "fixture");
  const validator = fileURLToPath(new URL("./playbook-validate.mjs", import.meta.url));
  const runScan = () => spawnSync(process.execPath, [validator, `--open-code-only-scan-root=${fixture}`], { encoding: "utf8" });
  const reset = () => { rmSync(fixture, { recursive: true, force: true }); mkdirSync(join(fixture, "src"), { recursive: true }); };
  const fail = (message, result) => {
    console.error(`OpenCode-only validator check failed: ${message}\n${result?.stdout ?? ""}${result?.stderr ?? ""}`);
    process.exit(1);
  };
  try {
    reset();
    writeFileSync(join(fixture, "src", "models.yml"), "model: anthropic/claude-sonnet-5\n");
    let result = runScan();
    if (result.status !== 0) fail("ordinary OpenCode model ID was rejected", result);

    reset();
    mkdirSync(join(fixture, "docs"), { recursive: true });
    writeFileSync(join(fixture, "docs", "OpenCode-Only-Framework-Implementation-Checklist.md"), `Deliberate historical ${["Claude", "Code"].join(" ")} wording.\n`);
    result = runScan();
    if (result.status !== 0) fail("active checklist's deliberate historical wording was rejected", result);

    const markers = [
      ["Claude", "Code"].join(" "),
      ["Claude", "adapter"].join(" "),
      ["Claude", "binary"].join(" "),
      ["Claude", "harness"].join(" "),
      ["Claude", "hook"].join(" "),
      ["Claude", "pack"].join(" "),
      ["Claude", "parity"].join(" "),
      ["claude", "code"].join("-"),
      ["claude", " -p"].join(""),
      ["PLAYBOOK", "CLAUDE", "BIN"].join("_"),
      ["CLAUDE", "PROJECT", "DIR"].join("_"),
      ["harness", ["claude", "code"].join("-")].join("/"),
      `.${["clau", "de"].join("")}`,
      ["CLAUDE", ".md"].join(""),
      [".mcp", ".json"].join(""),
    ];
    for (const marker of markers) {
      reset();
      writeFileSync(join(fixture, "src", "integration.mjs"), `export default ${JSON.stringify(marker)};\n`);
      result = runScan();
      if (result.status === 0 || !result.stderr.includes(marker)) fail(`marker was not named and rejected: ${marker}`, result);
    }

    const artifacts = [
      ["harness", ["claude", "code"].join("-")].join("/"),
      `.${["clau", "de"].join("")}`,
      ["CLAUDE", ".md"].join(""),
      [".mcp", ".json"].join(""),
      ["scripts/harness", "-install.mjs"].join(""),
    ];
    for (const artifact of artifacts) {
      reset();
      const artifactPath = join(fixture, ...artifact.split("/"));
      if (/\.[a-z]+$/i.test(artifact)) {
        mkdirSync(join(artifactPath, ".."), { recursive: true });
        writeFileSync(artifactPath, "integration fixture\n");
      } else {
        mkdirSync(artifactPath, { recursive: true });
      }
      result = runScan();
      if (result.status === 0 || !result.stderr.includes(artifact)) fail(`artifact was not named and rejected: ${artifact}`, result);
    }
    console.log("OpenCode-only negative validation passed");
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
}
const { evaluateToolCall } = await import(policyUrl);
const guardrailFail = (message) => { console.error(`guardrail policy behavioral check failed: ${message}`); process.exit(1); };
const decision = (tool, args, isVerifier = true) => evaluateToolCall({ tool, args, isVerifier });

const allowedEmitterCalls = [
  "node scripts/playbook-miss.mjs open --miss-class=partial-implementation --artifact=src --severity=major --found-by=verifier --found-phase=verify --found-phase-gate=FAIL --if-new",
  [
    "PLAYBOOK_TELEMETRY=1 node scripts/playbook-miss.mjs open --if-new \\",
    "  --miss-class=wrong-behaviour --artifact=source-code \\",
    "  --severity=major --item-id=REQ-014 --feature=checkout \\",
    "  --why-missed=insufficient-verify-method --origin-phase=build \\",
    "  --origin-agent=builder --origin-run-id=build-20260829-01 \\",
    "  --found-by=verifier --found-phase=verification-results-gate \\",
    '  --found-phase-gate="FAIL (code-audit)" --harness=opencode',
  ].join("\n"),
  "PLAYBOOK_TELEMETRY=1 node scripts/playbook-miss.mjs close --miss-id=MISS-20260829-01 --verdict-after=pass --fix-phase=fix",
  "PLAYBOOK_TELEMETRY=1 node scripts/playbook-miss.mjs amend MISS-20260829-01 why_missed insufficient-verify-method",
  "node scripts/playbook-miss.mjs list --item-id=REQ-014 --open",
];
for (const [gate, quote] of [
  ["PASS", '"'],
  ["FAIL", "'"],
  ["PASS (code-audit)", '"'],
  ["FAIL (code-audit)", "'"],
  ["DATA-GAP", '"'],
  ["BLOCKED", "'"],
]) {
  allowedEmitterCalls.push(`node scripts/playbook-miss.mjs open --found-phase-gate=${quote}${gate}${quote}`);
}
for (const command of allowedEmitterCalls) {
  if (decision("bash", { command })) guardrailFail(`approved miss emitter call was denied: ${command}`);
}

const deniedShellCalls = [
  "PLAYBOOK_TELEMETRY=1 node scripts/playbook-miss.mjs open --miss-class=other --misses=tmp/misses.ndjson",
  'node scripts/playbook-miss.mjs open --miss-class=other --found-phase-gate="BLOCKED by user"',
  'node scripts/playbook-miss.mjs open --artifact="source-code" --found-phase-gate=FAIL',
  'node scripts/playbook-miss.mjs open --found-phase-gate="FAIL"suffix',
  "node scripts/playbook-miss.mjs list --misses=verification/telemetry/misses.ndjson",
  "node scripts/playbook-miss.mjs open\n  --found-phase-gate=FAIL",
  "node scripts/playbook-miss.mjs open \\ \n  --found-phase-gate=FAIL",
  "node scripts/playbook-miss.mjs next-id && touch src/app.ts",
  "node scripts/playbook-miss.mjs next-id; node scripts/anything.mjs",
  "node scripts/playbook-miss.mjs next-id | tee verification/out.txt",
  "node scripts/playbook-miss.mjs open --artifact=$(touch src/app.ts)",
  "node scripts/playbook-miss.mjs open --artifact=${HOME}",
  "node scripts/anything.mjs",
  "node scripts/playbook-miss.mjs arbitrary-opaque-command",
  "node ./scripts/playbook-miss.mjs next-id",
];
for (const command of deniedShellCalls) {
  if (!decision("bash", { command })) guardrailFail(`unsafe or opaque shell shape was allowed: ${command}`);
}

const previousChecklist = process.env.PLAYBOOK_CHECKLIST;
process.env.PLAYBOOK_CHECKLIST = "docs/Feature-Implementation-Checklist.md";
try {
  const deniedWrites = [
    "Feature-Gap-Report.md",
    "src/app.ts",
    "config/appsettings.json",
    "verification/telemetry/misses.ndjson",
    "docs/Other-Implementation-Checklist.md",
  ];
  for (const filePath of deniedWrites) {
    if (!decision("write", { filePath })) guardrailFail(`verifier write was allowed: ${filePath}`);
  }
  for (const filePath of ["verification/feature/run-1/probe.cs", "docs/Feature-Implementation-Checklist.md", "deploy/feature/probe.sh"]) {
    if (decision("write", { filePath })) guardrailFail(`existing permitted verifier write was denied: ${filePath}`);
  }
  if (decision("bash", { command: "touch verification/feature/run-1/probe.txt" })) guardrailFail("permitted verification shell target was denied");
  if (!decision("bash", { command: "npm test" })) guardrailFail("opaque verifier shell command was allowed");
  if (decision("write", { filePath: "src/app.ts" }, false)) guardrailFail("non-verifier source write was denied");
  if (!decision("write", { filePath: "Feature-Gap-Report.md" }, false)) guardrailFail("forbidden report was allowed for non-verifier");
} finally {
  if (previousChecklist === undefined) delete process.env.PLAYBOOK_CHECKLIST;
  else process.env.PLAYBOOK_CHECKLIST = previousChecklist;
}
console.log("guardrail policy coverage passed");

// ── YOLO policy: git writes denied, everything else allowed, limit parsing ──
{
  const yoloUrl = new URL("../harness/opencode/plugin/yolo-policy.mjs", import.meta.url);
  for (const carrier of ["../harness/opencode/plugin/yolo.ts", "./playbook-yolo.mjs"]) {
    const url = new URL(carrier, import.meta.url);
    if (!existsSync(url)) { console.error(`yolo carrier missing: ${carrier}`); process.exit(1); }
    if (!readFileSync(url, "utf8").includes("yolo-policy.mjs")) { console.error(`yolo carrier does not use shared policy: ${carrier}`); process.exit(1); }
  }
  const y = await import(yoloUrl);
  const fail = (msg) => { console.error(`yolo policy check failed: ${msg}`); process.exit(1); };
  const denied = ["git commit -m x", "cd src && git push origin main", "git add .", "git -C /r tag v1", "npm test; git reset --hard", "git branch -D feature", "git stash", "git checkout -- .", "gh pr create --fill", "git rebase -i HEAD~3"];
  const allowed = ["git status", "git log --oneline -5", "git diff HEAD", "git show abc123", "git blame file.cs", "git branch", "git stash list", "GIT_PAGER=cat git diff --stat", "rm -rf build/", "rmdir /s old", "dotnet build", "git fetch origin"];
  for (const c of denied) if (y.yoloDecision({ tool: "bash", args: { command: c } }).decision !== "deny") fail(`should deny: ${c}`);
  for (const c of allowed) if (y.yoloDecision({ tool: "bash", args: { command: c } }).decision !== "allow") fail(`should allow: ${c}`);
  if (y.yoloDecision({ tool: "write", args: { filePath: "x.md" } }).decision !== "allow") fail("file writes must be allowed");
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
      // third phase reaches EOF without idle — elapsed remains unknown
      { kind: "phase-start", command: "implement", sessionID: "ses_parent", ts: "2026-08-21T00:02:00Z" },
    ];
    writeFileSync(join(dir, "events.ndjson"), rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
    const script = new URL("./playbook-telemetry.mjs", import.meta.url);
    const out = execFileSync(process.execPath, [fileURLToPath(script), "--events=events.ndjson"], { cwd: dir, encoding: "utf8" });
    const [verify, fix, eof] = out.trim().split("\n").map((l) => JSON.parse(l));
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
    for (const k of ["schema", "kind", "phase_execution_id", "started_at", "ended_at", "elapsed_ms", "complete", "end_reason", "tokens", "models", "observed_active_effort", "data_quality"]) {
      if (!(k in verify)) fail(`schema-2 field missing: ${k}`);
    }
    if (verify.timestamp !== verify.ended_at || !verify.complete) fail(`completed timestamp ${verify.timestamp}`);
    if (eof.complete || eof.end_reason !== "eof" || eof.ended_at !== null || eof.elapsed_ms !== null) fail(`EOF metric ${JSON.stringify(eof)}`);
    if (eof.timestamp !== eof.started_at) fail(`EOF timestamp ${eof.timestamp}`);
    console.log("telemetry subagent accounting passed");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
