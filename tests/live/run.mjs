// Live OpenCode probes with a scripted model. A real `opencode run` process
// loads the installed Playbook in a disposable project; the "model" is
// tests/live/mock-model.mjs, which answers with planted tool calls. The
// plugins, permissions and tools are OpenCode's own, so this observes the
// live hook inputs the offline probes can only imitate.
//   node tests/live/run.mjs PB-04 [--record]   Verifier boundary incl. the safe test command
//   node tests/live/run.mjs PB-19 [--record]   Verifier product-write block and git denial, normal and YOLO
// --record rewrites tests/live/transcripts/<ID>-*.log (redacted).
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assert, repoRoot, requirementId, runCases, ungraded } from "../lib.mjs";
import { startMockModel } from "./mock-model.mjs";
import { opencodeInfo, runArgs, tools } from "../opencode.mjs";
import { redact } from "../../scripts/miss-lib.mjs";

const id = requirementId("PB-04");
const record = process.argv.includes("--record");
const oc = opencodeInfo();
if (!oc) ungraded(id, "opencode is not on PATH (set PLAYBOOK_OPENCODE_BIN)");
const { bin } = oc;
const T = tools(oc);

const cleanup = [];
process.on("exit", () => { for (const dir of cleanup) rmSync(dir, { recursive: true, force: true }); });

function makeTarget() {
  // OpenCode names the project by its real path (macOS: /private/var/...), and
  // a model writes to the paths OpenCode reports; /var/... is "external" to it.
  const target = realpathSync(mkdtempSync(join(tmpdir(), "pb-live-")));
  cleanup.push(target);
  writeFileSync(join(target, "package.json"), JSON.stringify({ name: "pb-live", version: "1.0.0", scripts: { test: "node --test" } }));
  mkdirSync(join(target, "src"));
  writeFileSync(join(target, "src/app.js"), "export const add = (a, b) => a + b;\n");
  mkdirSync(join(target, "docs"));
  writeFileSync(join(target, "docs/Demo-Implementation-Checklist.md"), "# Demo checklist\n\n- [ ] REQ-001 add numbers\n");
  const git = (...args) => spawnSync("git", ["-c", "user.name=probe", "-c", "user.email=probe@example.invalid", ...args], { cwd: target, encoding: "utf8" });
  git("init", "-q");
  const install = spawnSync(process.execPath, [join(repoRoot, "scripts/install.mjs"), "install", `--target=${target}`], { encoding: "utf8" });
  if (install.status !== 0) throw new Error(`install failed: ${install.stderr}`);
  git("add", "-A");
  git("commit", "-qm", "baseline");
  return { target, git };
}

let lastRequests = [];
// Text of the system messages and of the tool results the scripted model received.
const seen = (role) => lastRequests.flatMap((r) => (r.body.messages ?? []).filter((m) => m.role === role).map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content)))).join("\n");

async function probe(name, target, script, runArgs, env = {}) {
  runArgs = typeof runArgs === "function" ? runArgs(oc) : runArgs;
  const mock = await startMockModel(script);
  writeFileSync(join(target, "opencode.json"), JSON.stringify({
    $schema: "https://opencode.ai/config.json",
    provider: { mock: { npm: "@ai-sdk/openai-compatible", name: "Scripted", options: { baseURL: `http://127.0.0.1:${mock.port}/v1`, apiKey: "none" }, models: { scripted: { name: "scripted", tool_call: true } } } },
    model: "mock/scripted", small_model: "mock/scripted", autoupdate: false, share: "disabled",
  }));
  const out = await new Promise((resolve) => {
    const child = spawn(bin, runArgs, {
      cwd: target, stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PWD: target, OPENCODE_DISABLE_AUTOUPDATE: "1", ...env },
    });
    let text = "";
    child.stdout.on("data", (d) => (text += d));
    child.stderr.on("data", (d) => (text += d));
    const timer = setTimeout(() => child.kill("SIGKILL"), 120000);
    child.on("exit", (code) => { clearTimeout(timer); resolve({ code, text }); });
  });
  mock.server.close();
  if (record) {
    const keep = out.text.split("\n")
      .filter((l) => /BLOCKED|Wrote file|Write |Edit |Bash |\$ |tool|probe finished|agent=|permission/i.test(l) && !/service=bus/.test(l))
      .map((l) => redact(l.replaceAll(target, "<target>").replace(/\u001b\[[0-9;]*m/g, ""), 400));
    mkdirSync(join(repoRoot, "tests/live/transcripts"), { recursive: true });
    writeFileSync(join(repoRoot, "tests/live/transcripts", `${id}-${name}.log`), `# recorded ${new Date().toISOString()} with OpenCode ${spawnSync(bin, ["--version"], { encoding: "utf8" }).stdout.trim()} and the scripted model\n${keep.join("\n")}\n`);
  }
  assert(mock.steps() === script.length, `${name}: OpenCode consumed ${mock.steps()} of ${script.length} scripted tool calls (exit ${out.code})`);
  lastRequests = mock.requests;
  return out.text;
}

// /verify runs the verifier as a subagent. OpenCode 1 starts the command with
// `run --command verify`; OpenCode 2's `run` has no command flag, so the
// primary agent dispatches the same verifier subagent with the scripted
// subagent call, and the verifier's first turn plays the planted steps.
const verifyArgs = oc.major < 2
  ? ["run", "--model", "mock/scripted", "--print-logs", "--command", "verify", "docs/Demo-Implementation-Checklist.md"]
  : runArgs(oc, { agent: "build", message: "/verify docs/Demo-Implementation-Checklist.md" });
function verifySteps(target, steps) {
  if (oc.major < 2) return steps;
  const [first, ...rest] = steps;
  return [
    { tool: T.subagent, args: { agent: "verifier", description: "verify", prompt: "Verify docs/Demo-Implementation-Checklist.md" } },
    { ...first, fresh: true },
    ...rest,
  ];
}

const cases = {
  "PB-04": [
    ["live /verify: the verifier subagent cannot write product source; evidence writes succeed", async () => {
      const { target } = makeTarget();
      const text = await probe("verify-write", target, verifySteps(target, [
        T.write(join(target, "src/app.js"), "tampered\n"),
        T.write(join(target, "verification/demo/run-1/probe.txt"), "evidence\n"),
      ]), verifyArgs);
      assert(readFileSync(join(target, "src/app.js"), "utf8").startsWith("export const add"), "src/app.js was modified by the verifier");
      assert(/BLOCKED write of forbidden path/.test(text), "no block reached the live log");
      assert(existsSync(join(target, "verification/demo/run-1/probe.txt")), "permitted evidence write did not happen");
    }],
    ["live /verify: the verifier may run the project's test command", async () => {
      const { target } = makeTarget();
      const text = await probe("verify-npm-test", target, verifySteps(target, [{ tool: T.shell, args: { command: "npm test", description: "run tests" } }]), verifyArgs);
      assert(!/BLOCKED bash/.test(text), "npm test was blocked for the verifier");
    }],
  ],
  "PB-19": [
    ["live /verify: the verifier subagent cannot write product source; evidence writes succeed", async () => {
      const { target } = makeTarget();
      const text = await probe("verify-write", target, verifySteps(target, [
        T.write(join(target, "src/app.js"), "tampered\n"),
        T.write(join(target, "verification/demo/run-1/probe.txt"), "evidence\n"),
      ]), verifyArgs);
      assert(readFileSync(join(target, "src/app.js"), "utf8").startsWith("export const add"), "src/app.js was modified by the verifier");
      assert(/BLOCKED write of forbidden path/.test(text), "no block reached the live log");
      assert(existsSync(join(target, "verification/demo/run-1/probe.txt")), "permitted evidence write did not happen");
    }],
    ["live normal mode: an orchestrator `git commit` leaves history unchanged", async () => {
      const { target, git } = makeTarget();
      const before = git("rev-list", "--count", "HEAD").stdout.trim();
      writeFileSync(join(target, "src/app.js"), "export const add = (a, b) => b + a;\n");
      const text = await probe("normal-commit", target, [{ tool: T.shell, args: { command: "git add -A && git commit -m wip", description: "commit" } }], runArgs(oc, { agent: "orchestrator", message: "commit the change" }), { PLAYBOOK_YOLO: "" });
      assert(git("rev-list", "--count", "HEAD").stdout.trim() === before, "a commit was created in normal mode");
      assert(/BLOCKED git history write/.test(text), "no block in normal mode");
    }],
    ["live YOLO mode: `git commit` stays denied by yolo.ts even with PLAYBOOK_GIT_APPROVED=1", async () => {
      const { target, git } = makeTarget();
      const before = git("rev-list", "--count", "HEAD").stdout.trim();
      writeFileSync(join(target, "src/app.js"), "export const add = (a, b) => b + a;\n");
      const text = await probe("yolo-commit", target, [{ tool: T.shell, args: { command: "git commit -am wip", description: "commit" } }], runArgs(oc, { agent: "orchestrator", message: "YOLO commit the change" }), { PLAYBOOK_YOLO: "1", PLAYBOOK_GIT_APPROVED: "1" });
      assert(git("rev-list", "--count", "HEAD").stdout.trim() === before, "a commit was created in YOLO mode");
      assert(/BLOCKED git write in YOLO mode/.test(text), "yolo.ts did not block the commit");
    }],
  ],
  "PB-45": [
    ["a guarded session: the standing rules and the three guard lines reach the model in load order, and the in-session check passes", async () => {
      const { target } = makeTarget();
      await probe("guarded", target, [{ tool: T.shell, args: { command: "node .playbook/scripts/playbook-guards.mjs", description: "guards" } }], runArgs(oc, { agent: "orchestrator", message: "start" }));
      const system = seen("system");
      const lines = system.match(/\[playbook-guard\] [a-z-]+ loaded/g) ?? [];
      assert([...new Set(lines)].join(",") === "[playbook-guard] telemetry loaded,[playbook-guard] spec-guardrails loaded,[playbook-guard] yolo loaded", `guard lines ${[...new Set(lines)].join(",")}`);
      assert(/playbook-guards: loaded telemetry, spec-guardrails, yolo/.test(seen("tool")), `in-session check: ${seen("tool").slice(0, 300)}`);
      // The standing rules must reach the model too (OpenCode 1 searches instructions up from the
      // project; OpenCode 2.0.18 ignores `instructions`, so spec-guardrails supplies them).
      assert(/# Team Playbook Standing Rules/.test(system) && /## Guard plugins/.test(system), "the standing rules did not reach the model");
    }],
    ["an unguarded session: no guard line reaches the model, the Playbook agent's prompt tells it to say so first, and the in-session check prints NOT LOADED with the cause", async () => {
      const { target } = makeTarget();
      const config = join(target, ".opencode/opencode.json");
      const plugins = join(target, ".opencode/playbook-plugin");
      let cause;
      if (oc.major >= 2) {
        // The owner's case: the pre-2.x layout, one .ts file per plugin, which OpenCode 2 skips.
        for (const name of ["telemetry", "spec-guardrails", "yolo"]) {
          writeFileSync(join(plugins, `${name}.ts`), readFileSync(join(plugins, name, "index.ts"), "utf8").replaceAll('from "../', 'from "./'));
        }
        writeFileSync(config, readFileSync(config, "utf8").replace(/"\.\/playbook-plugin\/(telemetry|spec-guardrails|yolo)"/g, '"./playbook-plugin/$1.ts"'));
        cause = /is a file; OpenCode 2 loads a configured plugin only as a directory/;
      } else {
        // OpenCode 1 loads single files, so its unguarded case is a config that lists no plugin.
        const c = JSON.parse(readFileSync(config, "utf8"));
        delete c.plugin;
        writeFileSync(config, JSON.stringify(c, null, 2));
        cause = /does not load telemetry, spec-guardrails, yolo/;
      }
      await probe("unguarded", target, [{ tool: T.shell, args: { command: "node .playbook/scripts/playbook-guards.mjs", description: "guards" } }], runArgs(oc, { agent: "orchestrator", message: "start" }));
      const system = seen("system");
      assert(!/\[playbook-guard\] [a-z-]+ loaded(?!`)/.test(system), "a guard line reached an unguarded session");
      assert(/PLAYBOOK GUARDS NOT LOADED: <missing> — this session is unguarded/.test(system), "the guard check did not reach the model");
      const tool = seen("tool");
      assert(/!!! PLAYBOOK GUARDS NOT LOADED: telemetry, spec-guardrails, yolo !!!/.test(tool) && cause.test(tool), `in-session check: ${tool.slice(0, 400)}`);
    }],
    ["before a session, --config and the installer name a plugin configured as a file or missing", () => {
      const { target } = makeTarget();
      const guards = (args) => spawnSync(process.execPath, [join(target, ".playbook/scripts/playbook-guards.mjs"), ...args], { cwd: target, encoding: "utf8", env: { ...process.env, PLAYBOOK_GUARDS: "" } });
      assert(guards(["--config"]).status === 0, "a fresh install failed the config check");
      const config = join(target, ".opencode/opencode.json");
      writeFileSync(config, readFileSync(config, "utf8").replace('"./playbook-plugin/yolo"', '"./playbook-plugin/yolo.ts"').replace('"./playbook-plugin/telemetry", ', ""));
      const r = guards(["--config"]);
      assert(r.status === 3 && /yolo.ts does not exist|yolo.ts is a file/.test(r.stdout) && /does not load telemetry/.test(r.stdout), r.stdout);
      const reinstall = spawnSync(process.execPath, [join(repoRoot, "scripts/install.mjs"), "install", `--target=${target}`], { encoding: "utf8" });
      assert(/!!! PLAYBOOK GUARDS NOT LOADED/.test(reinstall.stdout), "an upgrade that kept a stale config was not announced");
    }],
  ],
};

if (!cases[id]) {
  console.log(`${id} fail: tests/live/run.mjs has no case set for this ID`);
  process.exit(1);
}
await runCases(id, cases[id]);
