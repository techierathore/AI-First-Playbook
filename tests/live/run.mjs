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
import { redact } from "../../scripts/miss-lib.mjs";

const id = requirementId("PB-04");
const record = process.argv.includes("--record");
const bin = process.env.PLAYBOOK_OPENCODE_BIN || "opencode";
if (spawnSync(bin, ["--version"], { encoding: "utf8" }).status !== 0) ungraded(id, "opencode is not on PATH (set PLAYBOOK_OPENCODE_BIN)");

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

async function probe(name, target, script, runArgs, env = {}) {
  const mock = await startMockModel(script);
  writeFileSync(join(target, "opencode.json"), JSON.stringify({
    $schema: "https://opencode.ai/config.json",
    provider: { mock: { npm: "@ai-sdk/openai-compatible", name: "Scripted", options: { baseURL: `http://127.0.0.1:${mock.port}/v1`, apiKey: "none" }, models: { scripted: { name: "scripted", tool_call: true } } } },
    model: "mock/scripted", small_model: "mock/scripted", autoupdate: false, share: "disabled",
  }));
  const out = await new Promise((resolve) => {
    const child = spawn(bin, ["run", "--model", "mock/scripted", "--print-logs", ...runArgs], {
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
  return out.text;
}

const cases = {
  "PB-04": [
    ["live /verify: the verifier subagent cannot write product source; evidence writes succeed", async () => {
      const { target } = makeTarget();
      const text = await probe("verify-write", target, [
        { tool: "write", args: { filePath: join(target, "src/app.js"), content: "tampered\n" } },
        { tool: "write", args: { filePath: join(target, "verification/demo/run-1/probe.txt"), content: "evidence\n" } },
      ], ["--command", "verify", "docs/Demo-Implementation-Checklist.md"]);
      assert(readFileSync(join(target, "src/app.js"), "utf8").startsWith("export const add"), "src/app.js was modified by the verifier");
      assert(/BLOCKED write of forbidden path/.test(text), "no block reached the live log");
      assert(existsSync(join(target, "verification/demo/run-1/probe.txt")), "permitted evidence write did not happen");
    }],
    ["live /verify: the verifier may run the project's test command", async () => {
      const { target } = makeTarget();
      const text = await probe("verify-npm-test", target, [{ tool: "bash", args: { command: "npm test", description: "run tests" } }], ["--command", "verify", "docs/Demo-Implementation-Checklist.md"]);
      assert(!/BLOCKED bash/.test(text), "npm test was blocked for the verifier");
    }],
  ],
  "PB-19": [
    ["live /verify: the verifier subagent cannot write product source; evidence writes succeed", async () => {
      const { target } = makeTarget();
      const text = await probe("verify-write", target, [
        { tool: "write", args: { filePath: join(target, "src/app.js"), content: "tampered\n" } },
        { tool: "write", args: { filePath: join(target, "verification/demo/run-1/probe.txt"), content: "evidence\n" } },
      ], ["--command", "verify", "docs/Demo-Implementation-Checklist.md"]);
      assert(readFileSync(join(target, "src/app.js"), "utf8").startsWith("export const add"), "src/app.js was modified by the verifier");
      assert(/BLOCKED write of forbidden path/.test(text), "no block reached the live log");
      assert(existsSync(join(target, "verification/demo/run-1/probe.txt")), "permitted evidence write did not happen");
    }],
    ["live normal mode: an orchestrator `git commit` leaves history unchanged", async () => {
      const { target, git } = makeTarget();
      const before = git("rev-list", "--count", "HEAD").stdout.trim();
      writeFileSync(join(target, "src/app.js"), "export const add = (a, b) => b + a;\n");
      const text = await probe("normal-commit", target, [{ tool: "bash", args: { command: "git add -A && git commit -m wip", description: "commit" } }], ["--agent", "orchestrator", "commit the change"], { PLAYBOOK_YOLO: "" });
      assert(git("rev-list", "--count", "HEAD").stdout.trim() === before, "a commit was created in normal mode");
      assert(/BLOCKED git history write/.test(text), "no block in normal mode");
    }],
    ["live YOLO mode: `git commit` stays denied by yolo.ts even with PLAYBOOK_GIT_APPROVED=1", async () => {
      const { target, git } = makeTarget();
      const before = git("rev-list", "--count", "HEAD").stdout.trim();
      writeFileSync(join(target, "src/app.js"), "export const add = (a, b) => b + a;\n");
      const text = await probe("yolo-commit", target, [{ tool: "bash", args: { command: "git commit -am wip", description: "commit" } }], ["--agent", "orchestrator", "YOLO commit the change"], { PLAYBOOK_YOLO: "1", PLAYBOOK_GIT_APPROVED: "1" });
      assert(git("rev-list", "--count", "HEAD").stdout.trim() === before, "a commit was created in YOLO mode");
      assert(/BLOCKED git write in YOLO mode/.test(text), "yolo.ts did not block the commit");
    }],
  ],
};

if (!cases[id]) {
  console.log(`${id} fail: tests/live/run.mjs has no case set for this ID`);
  process.exit(1);
}
await runCases(id, cases[id]);
