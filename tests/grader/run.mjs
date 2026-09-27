// Grader self-test. One case per defect the grader must not repeat.
//   node tests/grader/run.mjs PB-09|PB-10|PB-11|PB-12
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assert, repoRoot, requirementId, runCases } from "../lib.mjs";
import { parseCheck, parseRequirements } from "../../scripts/playbook-grade.mjs";
import { readMisses, validateGraderRecords } from "../../scripts/miss-lib.mjs";

const id = requirementId("PB-10");
const work = mkdtempSync(join(tmpdir(), "pb-grader-"));
process.on("exit", () => rmSync(work, { recursive: true, force: true }));

function gradeFixture(name, extraEnv = {}) {
  const telemetry = join(work, `${name}.ndjson`);
  const child = spawnSync(process.execPath, ["scripts/playbook-grade.mjs", `tests/grader/cases/${name}`, `--telemetry=${telemetry}`, "--run-id=grader-selftest"], {
    cwd: repoRoot, encoding: "utf8", env: { ...process.env, ...extraEnv, PLAYBOOK_ACTOR: "" },
  });
  const lines = child.stdout.split("\n");
  const byId = new Map();
  for (const line of lines) {
    const m = line.match(/^(PB-\d+) (pass|fail|ungraded)\s/);
    if (m) {
      assert(!byId.has(m[1]), `grader printed ${m[1]} twice`);
      byId.set(m[1], { result: m[2], line });
    }
  }
  const records = readMisses(telemetry).records;
  return { child, lines, byId, records, telemetry };
}

const cases = {
  "PB-09": [
    ["every script or fixture line in docs/Playbook-Requirements.md names a file that exists", () => {
      const rows = parseRequirements(readFileSync(join(repoRoot, "docs/Playbook-Requirements.md"), "utf8"));
      assert(rows.length > 0, "no requirement rows found");
      for (const row of rows) {
        const check = parseCheck(row.check);
        assert(!check.error, `${row.id}: ${check.error}`);
        if (check.kind === "script" || check.kind === "fixture") {
          assert(existsSync(join(repoRoot, check.file)), `${row.id}: ${check.file} does not exist`);
        }
      }
    }],
    ["the grader invokes the named check with its arguments (marker written by the check)", () => {
      const marker = join(work, "marker.txt");
      const { byId } = gradeFixture("all-pass.md", { GRADER_MARKER: marker });
      assert(existsSync(marker), "check was not invoked");
      assert(readFileSync(marker, "utf8") === "PB-01", "arguments were not passed through");
      assert(byId.get("PB-01")?.result === "pass", "invoked passing check did not pass");
    }],
    ["a line naming a script that was never written fails (TechieFlow FR-47)", () => {
      const { byId } = gradeFixture("requirements.md");
      assert(byId.get("PB-03")?.result === "fail", "missing script was not a fail");
      assert(/does not exist/.test(byId.get("PB-03").line), "missing-file reason not printed");
    }],
  ],
  "PB-10": [
    ["one result per ID, in a walk that visits every ID once", () => {
      const { byId } = gradeFixture("requirements.md");
      assert(byId.size === 9, `expected 9 IDs, got ${byId.size}`);
    }],
    ["exit 0 with no affirmative line is a fail, never a PASS", () => {
      const { byId } = gradeFixture("requirements.md");
      assert(byId.get("PB-02")?.result === "fail", "silent exit 0 was not failed");
      assert(/never read as PASS/.test(byId.get("PB-02").line), "reason not printed");
    }],
    ["review and live lines are ungraded with their written reason", () => {
      const { byId } = gradeFixture("requirements.md");
      assert(byId.get("PB-04")?.result === "ungraded" && /phase map/.test(byId.get("PB-04").line), "review reason missing");
      assert(byId.get("PB-07")?.result === "ungraded" && /runbook/.test(byId.get("PB-07").line), "live reason missing");
      assert(byId.get("PB-08")?.result === "ungraded" && /live model/.test(byId.get("PB-08").line), "exit-77 reason missing");
    }],
    ["a crash, a duplicate ID and a line with no check kind are fails", () => {
      const { byId } = gradeFixture("requirements.md");
      assert(byId.get("PB-05")?.result === "fail", "crash not failed");
      assert(byId.get("PB-01")?.result === "fail" && /duplicate ID/.test(byId.get("PB-01").line), "duplicate ID not failed");
      assert(byId.get("PB-09")?.result === "fail", "kindless line not failed");
    }],
    ["the grader exits 1 on any fail and 0 when none fails", () => {
      assert(gradeFixture("requirements.md").child.status === 1, "fail did not exit 1");
      assert(gradeFixture("all-pass.md").child.status === 0, "clean run did not exit 0");
    }],
  ],
  "PB-11": [
    ["the headline is `N of M graded` followed by pass, fail and ungraded counts", () => {
      const { lines } = gradeFixture("requirements.md");
      const at = lines.findIndex((l) => /^\d+ of \d+ graded$/.test(l));
      assert(at >= 0, "no `N of M graded` headline");
      assert(lines[at] === "6 of 9 graded", `wrong headline: ${lines[at]}`);
      assert(lines[at + 1] === "pass 0, fail 6, ungraded 3", `wrong counts line: ${lines[at + 1]}`);
    }],
  ],
  "PB-12": [
    ["one grader-verdict record per ID, valid against the stream schema", () => {
      const { records } = gradeFixture("requirements.md");
      assert(records.length === 9, `expected 9 records, got ${records.length}`);
      assert(new Set(records.map((r) => r.req_id)).size === 9, "records are not one per ID");
      const { errors } = validateGraderRecords(records);
      assert(!errors.length, errors.join("; "));
      assert(records.every((r) => r.run_id === "grader-selftest" && r.harness === "opencode" && "actor" in r), "shared fields missing");
    }],
    ["a credential printed by a check is redacted before it is stored", () => {
      const { records, telemetry } = gradeFixture("requirements.md");
      const raw = readFileSync(telemetry, "utf8");
      assert(!raw.includes("ghp_aaaa"), "token reached the stream");
      assert(records.find((r) => r.req_id === "PB-06")?.reason.includes("[REDACTED]"), "redaction marker missing");
    }],
  ],
};

if (!cases[id]) {
  console.log(`${id} fail: tests/grader/run.mjs has no case set for this ID`);
  process.exit(1);
}
await runCases(id, cases[id]);
