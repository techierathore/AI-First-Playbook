#!/usr/bin/env node
/**
 * playbook-yolo.mjs — the YOLO supervisor: run a playbook phase or an
 * end-to-end goal unattended, auto-approving everything except git history,
 * and when the provider's usage limit (5-hour window, weekly cap, 429) stops
 * the run, wait for the reset time (+ buffer) and resume the same session —
 * until the agent prints the completion sentinel.
 *
 * Usage
 *   node scripts/playbook-yolo.mjs --cwd=/repo --agent=orchestrator \
 *        --goal "Feature X: implement the checklist, verify, fix until every item PASSes"
 *   node scripts/playbook-yolo.mjs --cwd=/repo \
 *        --prompt "/implement docs/X-Implementation-Checklist.md"
 *   node scripts/playbook-yolo.mjs status [--cwd=/repo]        # what a run is waiting for
 *   node scripts/playbook-yolo.mjs resume [--cwd=/repo]        # pick up after a VM reboot
 *
 * Options
 *   --cwd=<repo>                     (default: current directory)
 *   --prompt "<text>" | --goal "<text>"   one is required for `run`
 *   --agent=<name>                   OpenCode agent (default orchestrator)
 *   --model=<id>                     pass-through model override
 *   --buffer=<min>                   added to the parsed reset time     (default 15)
 *   --default-wait=<min>             wait when no reset time parsed      (default 60, doubles each time, max 24h)
 *   --max-cycles=<n>                 hard cap on restarts                (default 200)
 *   --max-nudges=<n>                 consecutive "you stopped early" restarts before giving up (default 8)
 *   --dry-run                        print the command that would run and exit
 *
 * Exit codes: 0 complete · 3 blocked (agent reported PLAYBOOK_RUN_BLOCKED) ·
 *             4 gave up (max cycles / nudges) · 5 fatal (auth, binary missing) · 2 usage
 *
 * State lives in <cwd>/verification/yolo/ — state.json (session id, cycle,
 * retryAt), cycles/<n>.log (full OpenCode output) and rate-limit.json (written by
 * the OpenCode plugin when it sees the error first-hand). Nothing here touches
 * git: the supervisor sets PLAYBOOK_YOLO=1 and the OpenCode plugin denies git
 * writes mechanically (harness/opencode/plugin/yolo-policy.mjs).
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { rateLimitPlan, runOutcome, hasYoloToken, SENTINEL_COMPLETE, SENTINEL_BLOCKED, DEFAULT_BUFFER_MINUTES, DEFAULT_UNPARSED_WAIT_MINUTES, MAX_WAIT_MINUTES } from "../harness/opencode/plugin/yolo-policy.mjs";

// ── args ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const valueOptions = new Set([
  "cwd", "prompt", "goal", "agent", "model", "buffer", "default-wait", "max-cycles", "max-nudges",
]);
const flagOptions = new Set(["dry-run"]);
const positional = [];
for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (!arg.startsWith("--")) { positional.push(arg); continue; }
  const [name, inline] = arg.slice(2).split("=", 2);
  if (!valueOptions.has(name) && !flagOptions.has(name)) usage(`unknown option '--${name}'`);
  if (flagOptions.has(name)) {
    if (inline !== undefined) usage(`--${name} does not take a value`);
    continue;
  }
  if (inline === undefined) {
    if (argv[i + 1] === undefined || argv[i + 1].startsWith("--")) usage(`--${name} needs a value`);
    i++;
  }
}
const commands = new Set(["status", "resume", "run"]);
if (positional[0] && !commands.has(positional[0])) usage(`unknown command '${positional[0]}'`);
if (positional.length > 1) usage(`unexpected positional argument '${positional[1]}'`);
const subcommand = positional[0] ?? "run";
const opt = (name, dflt) => {
  const i = argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i === -1) return dflt;
  const a = argv[i];
  if (a.includes("=")) return a.slice(a.indexOf("=") + 1);
  const next = argv[i + 1];
  return next !== undefined && !next.startsWith("--") ? next : true;
};
const cwd = resolve(String(opt("cwd", process.cwd())));
const prompt = opt("prompt", null);
const goal = opt("goal", null);
const agent = String(opt("agent", "orchestrator"));
const model = opt("model", null);
const bufferMinutes = Number(opt("buffer", DEFAULT_BUFFER_MINUTES));
const defaultWaitMinutes = Number(opt("default-wait", DEFAULT_UNPARSED_WAIT_MINUTES));
const maxCycles = Number(opt("max-cycles", 200));
const maxNudges = Number(opt("max-nudges", 8));
const dryRun = argv.includes("--dry-run");

if (subcommand === "run" && typeof prompt !== "string" && typeof goal !== "string") usage("run needs --prompt or --goal");

function usage(msg) {
  if (msg) console.error(`playbook-yolo: ${msg}`);
  console.error("usage: node scripts/playbook-yolo.mjs [run|status|resume] --cwd=<repo> (--prompt \"…\" | --goal \"…\") [--agent=…] [--model=…] [--buffer=15] [--dry-run]");
  process.exit(2);
}

// ── state ───────────────────────────────────────────────────────────────────
const stateDir = join(cwd, "verification", "yolo");
const stateFile = join(stateDir, "state.json");
const limitFile = join(stateDir, "rate-limit.json");
const cyclesDir = join(stateDir, "cycles");
const loadState = () => (existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, "utf8")) : null);
const saveState = (s) => { mkdirSync(stateDir, { recursive: true }); writeFileSync(stateFile, JSON.stringify(s, null, 2) + "\n"); };
const ts = () => new Date().toISOString();
const say = (line) => { const msg = `[yolo ${ts()}] ${line}`; console.log(msg); try { mkdirSync(stateDir, { recursive: true }); appendFileSync(join(stateDir, "supervisor.log"), msg + "\n"); } catch { /* best effort */ } };

if (subcommand === "status") {
  const s = loadState();
  if (!s) { console.log("no YOLO run recorded under", stateDir); process.exit(0); }
  console.log(JSON.stringify(s, null, 2));
  if (s.retryAt && new Date(s.retryAt) > new Date()) console.log(`waiting for limit reset — retry at ${s.retryAt} (${Math.round((new Date(s.retryAt) - Date.now()) / 60000)} min)`);
  process.exit(0);
}

// ── prompt assembly ─────────────────────────────────────────────────────────
const RULES =
  `YOLO mode is ON for this run (unattended; AGENTS.md "YOLO mode" applies in full):\n` +
  `- Never stop to ask a question or wait for approval. Make the sensible decision yourself, record it under "## YOLO Decisions" in the checklist, and keep going.\n` +
  `- Every in-command approval gate (wave plan, smoke-test start, deployment steps, deletes) is pre-approved.\n` +
  `- You may delete files/folders and run read-only git. You must NEVER commit, stage, push, tag or rewrite history — that is denied mechanically; report \`git status\` instead.\n` +
  `- A phase is finished only when EVERY item in scope is done (build: all items implemented, built, self-tested and moved to to-verify; verify: every item has a verdict; fix: every FAIL addressed). Never hand back "run this phase again for the remaining items".\n` +
  `- If the provider's usage limit stops you, a supervisor will resume this same session after the reset; on resume, re-read the checklist Status Table and continue from the first unfinished item — do not redo finished work.\n` +
  `- When everything is done print, as the very last line: \`${SENTINEL_COMPLETE}: <one-line summary>\`. If a genuine external blocker remains after you have finished everything else, print \`${SENTINEL_BLOCKED}: <what is missing and who must supply it>\` instead.\n`;

function initialPrompt() {
  if (typeof goal === "string") {
    const body =
      `Goal: ${goal}\n\n` +
      `Run the playbook end to end against this goal: plan only if no implementation checklist exists yet (/feature-plan), then /implement the ENTIRE checklist, then /verify, then loop /fix → /verify until every item is PASS (or a documented external blocker remains). Use the playbook commands; do not improvise a different process.\n\n` + RULES;
    return body;
  }
  const p = String(prompt);
  const withToken = hasYoloToken(p) ? p : p.replace(/^(\/\S+)(\s|$)/, "$1 YOLO$2");
  return `${withToken}\n\n${RULES}`;
}
const resumeAfterLimit = () => `The usage-limit window has reset. Continue the YOLO run from where it stopped: re-read the checklist Status Table, resume at the first unfinished item, and finish everything. ${RULES}`;
const nudge = (n) => `You stopped without printing ${SENTINEL_COMPLETE} or ${SENTINEL_BLOCKED} (attempt ${n}). YOLO mode: do not ask — decide, record the decision, and continue until every item in scope is finished. ${RULES}`;

// ── OpenCode launcher ──────────────────────────────────────────────────────
function childEnv() {
  const env = { ...process.env, PLAYBOOK_YOLO: "1" };
  // Windows binaries launched from WSL only see variables listed in WSLENV.
  if (process.platform === "linux" && /microsoft/i.test(readSafe("/proc/version"))) {
    const keep = new Set((env.WSLENV ?? "").split(":").filter(Boolean));
    for (const k of ["PLAYBOOK_YOLO", "PLAYBOOK_TZ", "PLAYBOOK_TELEMETRY", "PLAYBOOK_CHECKLIST"]) keep.add(k);
    env.WSLENV = [...keep].join(":");
  }
  return env;
}
function readSafe(p) { try { return readFileSync(p, "utf8"); } catch { return ""; } }

function buildCommand(text, sessionId) {
  const bin = process.env.PLAYBOOK_OPENCODE_BIN || "opencode";
  const args = ["run", "--auto", "--format", "json"];
  if (agent) args.push("--agent", agent);
  if (model) args.push("--model", String(model));
  if (sessionId) args.push("--session", sessionId);
  args.push(text);
  return { bin, args };
}

function runOnce(text, sessionId, cycle) {
  const { bin, args } = buildCommand(text, sessionId);
  mkdirSync(cyclesDir, { recursive: true });
  const logFile = join(cyclesDir, `${String(cycle).padStart(3, "0")}.log`);
  say(`cycle ${cycle}: ${bin} ${args.slice(0, -1).join(" ")} "<prompt ${text.length} chars>"${sessionId ? ` (resuming ${sessionId})` : ""}`);
  if (dryRun) { console.log([bin, ...args].map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(" ")); process.exit(0); }
  return new Promise((done) => {
    let out = "";
    let child;
    try {
      child = spawn(bin, args, { cwd, env: childEnv(), stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32" });
    } catch (err) {
      return done({ code: 127, out: String(err) });
    }
    const sink = (chunk) => { const s = chunk.toString(); out += s; process.stdout.write(s); appendFileSync(logFile, s); };
    child.stdout.on("data", sink);
    child.stderr.on("data", sink);
    child.on("error", (err) => { out += `\n${err.message}`; done({ code: 127, out }); });
    child.on("close", (code) => done({ code: code ?? 1, out }));
  });
}

// ── output parsing ──────────────────────────────────────────────────────────
function extractSessionId(out) {
  const m = out.match(/"sessionID"\s*:\s*"(ses_[A-Za-z0-9]+)"/); // OpenCode JSON events
  return m ? m[1] : null;
}
function extractResultText(out) {
  // OpenCode JSON output carries assistant text in text parts.
  const parts = [...out.matchAll(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => JSON.parse(`"${m[1]}"`));
  return parts.length ? parts.join("\n") : out;
}
function pluginLimitRecord(sinceMs) {
  try {
    if (!existsSync(limitFile)) return null;
    const rec = JSON.parse(readFileSync(limitFile, "utf8"));
    return new Date(rec.detectedAt).getTime() >= sinceMs ? rec : null;
  } catch { return null; }
}
const fatal = (out) => /invalid api key|not logged in|authentication|unauthorized|please run \/login|command not found|ENOENT|is not recognized as/i.test(out);

// ── waiting ─────────────────────────────────────────────────────────────────
async function waitUntil(retryAt, why) {
  const total = retryAt.getTime() - Date.now();
  say(`${why} — sleeping until ${retryAt.toISOString()} (${Math.round(total / 60000)} min). Restart the agent at that time.`);
  while (Date.now() < retryAt.getTime()) {
    const left = retryAt.getTime() - Date.now();
    await new Promise((r) => setTimeout(r, Math.min(left, 10 * 60000)));
    if (Date.now() < retryAt.getTime()) say(`⏳ still waiting for the limit window — ${Math.round((retryAt.getTime() - Date.now()) / 60000)} min left (retry at ${retryAt.toISOString()})`);
  }
}

// ── main loop ───────────────────────────────────────────────────────────────
async function main() {
  let state = subcommand === "resume" ? loadState() : null;
  if (subcommand === "resume" && !state) usage("nothing to resume — no verification/yolo/state.json");
  if (state && state.harness !== "opencode") usage("saved YOLO state is not an OpenCode run");
  if (!state) {
    state = { harness: "opencode", cwd, startedAt: ts(), cycle: 0, sessionId: null, nextPrompt: initialPrompt(), nudges: 0, unparsedWaits: 0, retryAt: null, status: "running" };
  } else {
    say(`resuming run started ${state.startedAt} (cycle ${state.cycle}, session ${state.sessionId ?? "none"})`);
    if (state.retryAt && new Date(state.retryAt) > new Date()) await waitUntil(new Date(state.retryAt), "resume: earlier limit still in force");
  }

  while (state.cycle < maxCycles) {
    state.cycle += 1; state.status = "running"; state.retryAt = null; saveState(state);
    const startedMs = Date.now();
    const { code, out } = await runOnce(state.nextPrompt, state.sessionId, state.cycle);
    state.sessionId = extractSessionId(out) ?? state.sessionId;
    const result = extractResultText(out);
    const outcome = runOutcome(result) === "unknown" ? runOutcome(out) : runOutcome(result);

    if (outcome === "complete") { state.status = "complete"; state.finishedAt = ts(); saveState(state); say(`✅ ${SENTINEL_COMPLETE} after ${state.cycle} cycle(s). Working tree is ready for your review and commit.`); return 0; }
    if (outcome === "blocked") { state.status = "blocked"; state.finishedAt = ts(); saveState(state); say(`⛔ ${SENTINEL_BLOCKED} — the agent finished everything it could; see the checklist for what it needs from you.`); return 3; }

    // usage / rate limit?
    const plugin = pluginLimitRecord(startedMs);
    const plan = plugin
      ? { retryAt: new Date(plugin.retryAt), parsed: plugin.parsed, resetAt: plugin.resetAt ? new Date(plugin.resetAt) : null }
      : rateLimitPlan(out, { bufferMinutes, defaultWaitMinutes: Math.min(defaultWaitMinutes * 2 ** state.unparsedWaits, MAX_WAIT_MINUTES) });
    if (plan) {
      state.unparsedWaits = plan.parsed ? 0 : state.unparsedWaits + 1;
      state.status = "waiting-for-limit"; state.retryAt = plan.retryAt.toISOString(); state.nextPrompt = resumeAfterLimit(); saveState(state);
      await waitUntil(plan.retryAt, plan.parsed ? `usage limit hit (reset ${plan.resetAt?.toISOString()} + ${bufferMinutes} min buffer)` : `usage limit hit, reset time not stated — waiting ${Math.round(plan.waitMs / 60000)} min`);
      state.nudges = 0;
      continue;
    }

    if (fatal(out)) { state.status = "fatal"; saveState(state); say(`💥 fatal OpenCode error (exit ${code}) — fix the environment/auth and run \`resume\`.`); return 5; }

    // ended without a sentinel: asked a question, hit context end, or crashed — nudge it on
    state.nudges += 1;
    if (state.nudges > maxNudges) { state.status = "gave-up"; saveState(state); say(`🛑 ${maxNudges} consecutive runs ended without a sentinel (last exit ${code}). Check cycles/ logs; run \`resume\` after addressing the cause.`); return 4; }
    state.nextPrompt = nudge(state.nudges); saveState(state);
    say(`run ended without ${SENTINEL_COMPLETE} (exit ${code}); nudging (${state.nudges}/${maxNudges}) in 30s`);
    await new Promise((r) => setTimeout(r, 30000));
  }
  state.status = "gave-up"; saveState(state); say(`🛑 reached --max-cycles=${maxCycles}`); return 4;
}

main().then((code) => process.exit(code)).catch((err) => { say(`💥 ${err?.stack ?? err}`); process.exit(5); });
