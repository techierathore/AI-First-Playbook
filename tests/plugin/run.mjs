// Offline plugin probes. Builds a disposable Node project outside the
// repository, installs the Playbook into it, loads the INSTALLED OpenCode
// plugins from its .opencode/plugin/ and drives their hooks with inputs shaped
// exactly as OpenCode 1.18 sends them (tool.execute.before has no `agent`).
//   node tests/plugin/run.mjs PB-04   Verifier write boundary
//   node tests/plugin/run.mjs PB-05   git history writes denied in normal and YOLO modes
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { assert, repoRoot, requirementId, runCases } from "../lib.mjs";

const id = requirementId("PB-05");

// Type stripping is on by default from Node 22.18; older 22.x needs the flag.
if (!process.features?.typescript && !process.env.PB_PLUGIN_CHILD) {
  const child = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", ...process.argv.slice(1)], {
    stdio: "inherit", env: { ...process.env, PB_PLUGIN_CHILD: "1" },
  });
  process.exit(child.status ?? 1);
}

export function makeTarget() {
  const target = mkdtempSync(join(tmpdir(), "pb-target-"));
  writeFileSync(join(target, "package.json"), JSON.stringify({ name: "pb-disposable", version: "1.0.0", type: "module", scripts: { test: "node --test" } }, null, 2));
  mkdirSync(join(target, "src"));
  writeFileSync(join(target, "src/app.js"), "export const add = (a, b) => a + b;\n");
  mkdirSync(join(target, "docs"));
  writeFileSync(join(target, "docs/Demo-Implementation-Checklist.md"), "# Demo checklist\n");
  const install = spawnSync(process.execPath, [join(repoRoot, "scripts/install.mjs"), "install", `--target=${target}`], { encoding: "utf8" });
  if (install.status !== 0) throw new Error(`install failed: ${install.stderr}`);
  return target;
}

const target = makeTarget();
process.on("exit", () => rmSync(target, { recursive: true, force: true }));
process.chdir(target);
const client = { app: { log: async () => {} }, tui: {} };
const load = async (name) => (await import(pathToFileURL(join(target, ".opencode/plugin", name)).href)).default({ client, directory: target, worktree: target });

async function blocked(hooks, tool, sessionID, args) {
  try {
    await hooks["tool.execute.before"]({ tool, sessionID, callID: "c1" }, { args });
    return null;
  } catch (error) {
    return error.message;
  }
}

async function withEnv(vars, fn) {
  const saved = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
  Object.assign(process.env, vars);
  for (const [k, v] of Object.entries(vars)) if (v === undefined) delete process.env[k];
  try { return await fn(); } finally {
    for (const [k, v] of Object.entries(saved)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
}

const guard = await withEnv({ PLAYBOOK_CHECKLIST: undefined }, () => load("spec-guardrails.ts"));
// Sessions as OpenCode reports them: the orchestrator's primary session and a
// verifier subagent session, each announced through chat.params.
await guard["chat.params"]({ sessionID: "ses_orch", agent: "orchestrator" }, {});
await guard["chat.params"]({ sessionID: "ses_verify", agent: "verifier" }, {});

const cases = {
  "PB-04": [
    ["verifier edit of product source is blocked with no `agent` on the hook input (defect M06)", async () => {
      assert(await blocked(guard, "edit", "ses_verify", { filePath: "src/app.js", oldString: "a + b", newString: "a - b" }), "verifier source edit was allowed");
    }],
    ["verifier shell redirect into product source is blocked", async () => {
      assert(await blocked(guard, "bash", "ses_verify", { command: "echo x > src/app.js" }), "verifier redirect was allowed");
    }],
    ["verifier writes to verification/ evidence and the checklist are allowed", async () => {
      assert(!(await blocked(guard, "write", "ses_verify", { filePath: "verification/demo/run-1/probe.txt", content: "x" })), "evidence write was blocked");
      assert(!(await blocked(guard, "edit", "ses_verify", { filePath: "docs/Demo-Implementation-Checklist.md" })), "checklist edit was blocked");
    }],
    ["the orchestrator in the parent session may still edit product source", async () => {
      assert(!(await blocked(guard, "edit", "ses_orch", { filePath: "src/app.js" })), "orchestrator edit was blocked");
    }],
    ["an agent learnt from message.updated events is honoured", async () => {
      await guard.event({ event: { type: "message.updated", properties: { info: { sessionID: "ses_v2", agent: "verifier" } } } });
      assert(await blocked(guard, "write", "ses_v2", { filePath: "src/new.js" }), "event-learnt verifier write was allowed");
    }],
    ["verifier safe test command (`npm test`) is allowed (defect M08)", async () => {
      assert(!(await blocked(guard, "bash", "ses_verify", { command: "npm test" })), "npm test was blocked for the verifier");
    }],
  ],
  "PB-05": [
    ["normal mode: git history writes are blocked for every agent", async () => {
      await withEnv({ PLAYBOOK_YOLO: undefined, PLAYBOOK_GIT_APPROVED: undefined }, async () => {
        for (const command of ["git commit -m x", "git push origin main", "git add .", "git tag v1", "npm test; git reset --hard", "git rebase -i HEAD~2"]) {
          assert(await blocked(guard, "bash", "ses_orch", { command }), `normal mode allowed: ${command}`);
        }
      });
    }],
    ["normal mode: read-only git is allowed", async () => {
      for (const command of ["git status", "git log --oneline -3", "git diff"]) {
        assert(!(await blocked(guard, "bash", "ses_orch", { command })), `read-only git blocked: ${command}`);
      }
    }],
    ["normal mode: a human-approved run (PLAYBOOK_GIT_APPROVED=1) may commit", async () => {
      await withEnv({ PLAYBOOK_GIT_APPROVED: "1" }, async () => {
        assert(!(await blocked(guard, "bash", "ses_orch", { command: "git commit -m x" })), "approved commit was blocked");
      });
    }],
    ["YOLO mode: the permission prompt for a git push is denied and an edit is allowed", async () => {
      await withEnv({ PLAYBOOK_YOLO: "1" }, async () => {
        const yolo = await load("yolo.ts");
        const push = { status: "ask" };
        await yolo["permission.ask"]({ type: "bash", title: "git push origin main", pattern: "git push*", metadata: { command: "git push origin main" }, sessionID: "ses_orch" }, push);
        assert(push.status === "deny", `git push permission was ${push.status}`);
        const edit = { status: "ask" };
        await yolo["permission.ask"]({ type: "edit", title: "src/app.js", pattern: "src/app.js", metadata: {}, sessionID: "ses_orch" }, edit);
        assert(edit.status === "allow", `edit permission was ${edit.status}`);
      });
    }],
    ["YOLO mode: git commit is blocked even when the human approved git", async () => {
      await withEnv({ PLAYBOOK_YOLO: "1", PLAYBOOK_GIT_APPROVED: "1" }, async () => {
        const yolo = await load("yolo.ts");
        assert(await blocked(yolo, "bash", "ses_orch", { command: "git commit -am wip" }), "YOLO allowed git commit");
      });
    }],
  ],
};

if (!cases[id]) {
  console.log(`${id} fail: tests/plugin/run.mjs has no case set for this ID`);
  process.exit(1);
}
await runCases(id, cases[id]);
