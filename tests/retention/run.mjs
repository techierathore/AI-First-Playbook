// Raw evidence retention (PB-14) and the durable OpenCode-only proof (PB-15).
//   node tests/retention/run.mjs PB-14   raw runs ignored, swept after 7 days, out of npm
//   node tests/retention/run.mjs PB-15   archive integrity plus the V01-V03 checks rerun now
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assert, repoRoot, requirementId, runCases } from "../lib.mjs";

const id = requirementId("PB-14");
const work = mkdtempSync(join(tmpdir(), "pb-retention-"));
process.on("exit", () => rmSync(work, { recursive: true, force: true }));
const node = (args, cwd = repoRoot, env = {}) => spawnSync(process.execPath, args, { cwd, encoding: "utf8", env: { ...process.env, ...env } });
const DAY = 86400;

function target() {
  const t = join(work, `t-${Math.random().toString(36).slice(2)}`);
  const r = node([join(repoRoot, "scripts/install.mjs"), "install", `--target=${t}`]);
  if (r.status !== 0) throw new Error(r.stderr);
  return t;
}
function run(t, name, ageDays) {
  const dir = join(t, "verification/runs", name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "app.log"), "log\n");
  const when = Date.now() / 1000 - ageDays * DAY;
  utimesSync(join(dir, "app.log"), when, when);
  utimesSync(dir, when, when);
}

const ARCHIVE = "docs/archive/opencode-only-2026-09-02";
const cases = {
  "PB-14": [
    ["the repository ignores raw runs and YOLO state but keeps the miss and grade streams", () => {
      const ignored = (p) => spawnSync("git", ["check-ignore", "-q", p], { cwd: repoRoot }).status === 0;
      assert(ignored("verification/runs/verify-1/app.log") && ignored("verification/yolo/state.json"), "raw runs or YOLO state not ignored");
      assert(!ignored("verification/telemetry/misses.ndjson") && !ignored("verification/telemetry/grades.ndjson"), "a durable stream is ignored");
    }],
    ["an installed project's managed .gitignore block ignores raw runs", () => {
      assert(readFileSync(join(target(), ".gitignore"), "utf8").includes("/verification/runs/"), "managed block lacks /verification/runs/");
    }],
    ["the sweep removes run folders older than 7 days and keeps newer ones; dry run changes nothing", () => {
      const t = target();
      run(t, "old-run", 8);
      run(t, "new-run", 1);
      const dry = node([join(t, ".playbook/scripts/playbook-sweep.mjs")], t);
      assert(/would remove verification\/runs\/old-run/.test(dry.stdout) && existsSync(join(t, "verification/runs/old-run")), dry.stdout);
      node([join(t, ".playbook/scripts/playbook-sweep.mjs"), "--apply"], t);
      assert(!existsSync(join(t, "verification/runs/old-run")) && existsSync(join(t, "verification/runs/new-run")), "sweep removed the wrong folder");
    }],
    ["creating a new run folder sweeps stale ones without anyone running the sweep", () => {
      const t = target();
      run(t, "stale-run", 10);
      node([join(t, ".playbook/scripts/profile-gates.mjs"), "build", "--run-id=gate-1"], t);
      assert(!existsSync(join(t, "verification/runs/stale-run")) && existsSync(join(t, "verification/runs/gate-1")), "the stale run survived a new run");
    }],
    ["the profile's retention period is honoured", () => {
      const t = target();
      const profile = join(t, ".playbook/environment-profile.yml");
      writeFileSync(profile, readFileSync(profile, "utf8").replace("raw_runs_days: 7", "raw_runs_days: 3"));
      run(t, "four-days", 4);
      node([join(t, ".playbook/scripts/playbook-sweep.mjs"), "--apply"], t);
      assert(!existsSync(join(t, "verification/runs/four-days")), "a 3-day retention kept a 4-day-old run");
    }],
    ["grader verdicts older than 365 days are dropped; newer lines are kept byte-for-byte", () => {
      const t = target();
      const path = join(t, "verification/telemetry/grades.ndjson");
      mkdirSync(join(t, "verification/telemetry"), { recursive: true });
      const old = JSON.stringify({ kind: "grader-verdict", ts: "2025-01-01T00:00:00Z", req_id: "PB-01" });
      const recent = JSON.stringify({ kind: "grader-verdict", ts: "2026-09-26T00:00:00Z", req_id: "PB-01" });
      writeFileSync(path, `${old}\n${recent}\n`);
      node([join(t, ".playbook/scripts/playbook-sweep.mjs"), "--apply", "--now=2026-09-27T00:00:00Z"], t);
      assert(readFileSync(path, "utf8") === `${recent}\n`, readFileSync(path, "utf8"));
    }],
    ["the npm package carries no verification evidence", () => {
      const r = spawnSync(process.env.npm_execpath ? process.execPath : "npm", process.env.npm_execpath ? [process.env.npm_execpath, "pack", "--dry-run", "--json"] : ["pack", "--dry-run", "--json"], { cwd: repoRoot, encoding: "utf8" });
      const files = JSON.parse(r.stdout)[0].files.map((f) => f.path);
      assert(!files.some((f) => f.startsWith("verification/") || f.startsWith("docs/archive/")), "evidence or archive files are packaged");
    }],
  ],
  "PB-15": [
    ["the V01-V03 archive is marked historical and matches its manifest", () => {
      assert(/^# HISTORICAL/.test(readFileSync(join(repoRoot, ARCHIVE, "README.md"), "utf8")), "archive README is not marked historical");
      const r = node([join(repoRoot, "scripts/archive-manifest.mjs"), join(repoRoot, ARCHIVE), "--check"]);
      assert(r.status === 0, r.stdout);
    }],
    ["a changed archived file is detected", () => {
      const copy = join(work, "archive");
      cpSync(join(repoRoot, ARCHIVE), copy, { recursive: true });
      writeFileSync(join(copy, "20260902-opencode-only-verify-03/link-audit.txt"), "edited\n");
      assert(node([join(repoRoot, "scripts/archive-manifest.mjs"), copy, "--check"]).status === 1, "tampering not detected");
    }],
    ["the archived checklist's 27 evidence links resolve into the archive", () => {
      const text = readFileSync(join(repoRoot, "docs/archive/checklists/OpenCode-Only-Framework-Implementation-Checklist.md"), "utf8");
      const lines = text.split("\n").filter((l) => l.includes(`${ARCHIVE}/`));
      assert(lines.length === 27, `expected 27 lines, found ${lines.length}`);
      for (const p of new Set(text.match(new RegExp(`${ARCHIVE}/[^"\`) ]+`, "g")))) assert(existsSync(join(repoRoot, p)), `missing ${p}`);
      assert(!text.includes("verification/opencode-only/"), "a link still points at the old campaign folder");
    }],
    ["V01/V03 source scan: no removed-harness marker anywhere in the current source", () => {
      const r = node([join(repoRoot, "scripts/playbook-validate.mjs"), `--open-code-only-scan-root=${repoRoot}`]);
      assert(r.status === 0, r.stderr.split("\n").slice(0, 3).join("; "));
    }],
    ["V01/V03 link audit: every current Markdown link resolves (V01 found 2 broken README links)", () => {
      const r = node([join(repoRoot, "scripts/reference-lint.mjs"), "README.md", "docs/Getting-Started.md", "docs/Operating-Guide.md", "docs/Playbook-How-It-Works.md", "docs/maintainer", "docs/examples", "docs/runbooks", "phases", "templates", "onboarding", "harness/README.md"]);
      assert(r.status === 0, r.stdout.slice(-400));
    }],
    ["V03 document structure: templates declare schemas and the schema page is current", () => {
      assert(node([join(repoRoot, "scripts/template-lint.mjs")]).status === 0, "template-lint failed");
      assert(node([join(repoRoot, "scripts/document-schemas-doc.mjs"), "--check"]).status === 0, "schema page stale");
    }],
    ["V03 packed install and installed-source scan: the package installs OpenCode-only", () => {
      const r = node([join(repoRoot, "tests/package/run.mjs"), "PB-02"]);
      assert(r.status === 0, r.stdout.slice(-400));
    }],
  ],
};

if (!cases[id]) {
  console.log(`${id} fail: tests/retention/run.mjs has no case set for this ID`);
  process.exit(1);
}
await runCases(id, cases[id]);
