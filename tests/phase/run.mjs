// Planning, build, fix and escaped-bug checks for the shrunk commands.
// Inputs: the Team Inventory greenfield feature (invented from the case study),
// the failed item set of the verification-results example (INV-002, INV-003),
// the escaped duplicate-import bug, and the real miss stream.
//   node tests/phase/run.mjs PB-03   every phase under its tier maximum
//   node tests/phase/run.mjs PB-13   four-question protocol outcome on misses
//   node tests/phase/run.mjs PB-25   dependency-safe waves, one owner per file
//   node tests/phase/run.mjs PB-26   phase completion recomputed from metadata
//   node tests/phase/run.mjs PB-27   requirement and screen coverage
//   node tests/phase/run.mjs PB-28   miss linkage through the coordinator
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assert, repoRoot, requirementId, runCases } from "../lib.mjs";

const id = requirementId("PB-03");
const work = mkdtempSync(join(tmpdir(), "pb-phase-"));
process.on("exit", () => rmSync(work, { recursive: true, force: true }));
let target;
function installed() {
  if (target) return target;
  target = join(work, "target");
  const r = spawnSync(process.execPath, [join(repoRoot, "scripts/install.mjs"), "install", `--target=${target}`], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr);
  return target;
}
const script = (name, args, env = {}) => spawnSync(process.execPath, [join(installed(), ".playbook/scripts", name), ...args], { cwd: installed(), encoding: "utf8", env: { ...process.env, ...env } });
const fixture = (p) => readFileSync(join(repoRoot, p), "utf8");
const planned = () => fixture("tests/phase/fixtures/team-inventory-checklist.md");
const put = (name, text) => { const p = join(installed(), name); writeFileSync(p, text); return p; };
const setStatus = (text, itemId, status) => text.replace(new RegExp(`("id":"${itemId}"[^}]*"status":")[a-z-]+`), `$1${status}`).replace(new RegExp(`\\| ${itemId} \\| [a-z-]+ \\|`), `| ${itemId} | ${status} |`);
// Annotations append at the end of the item block, as the commands write them.
const annotate = (text, title, line) => text.replace(new RegExp(`(- \\[ \\] ${title}[\\s\\S]*?)(\n\n)`), `$1\n  ${line}$2`);
const fillSections = (text) => text.replace("## Infrastructure Requirements\n\n- Import staging folder (INV-008).", "## Infrastructure Requirements\n\n- Import staging folder (INV-008).").replace("### Automated\n\nNone.", "### Automated\n\n_None required._");
const TITLES = { "INV-001": "Filter the inventory list by owner", "INV-002": "Reject a CSV import that repeats an asset tag", "INV-003": "Write no rows when a duplicate import is rejected", "INV-004": "Show an asset's audit history", "INV-005": "Return an asset by tag", "INV-006": "Record an audit event for each owner change" };
function built() {
  let t = fillSections(planned());
  for (const [itemId, title] of Object.entries(TITLES)) t = annotate(setStatus(t, itemId, "to-verify"), title, `- **Self-test** (2026-09-26): PASS — probe kept under verification/runs/build-1/`);
  return t;
}
function failedSet() {
  let t = built();
  for (const [itemId, title] of Object.entries(TITLES)) {
    const fail = itemId === "INV-002" || itemId === "INV-003";
    t = annotate(setStatus(t, itemId, fail ? "fail" : "pass"), title, `- **Verifier Result** (2026-09-26): ${fail ? "FAIL — duplicate import answered 200" : "PASS — evidence under verification/team-inventory/verify-1/"}`);
  }
  return t;
}

const cases = {
  "PB-03": [
    ["every phase's measured fixed surface is within its tier maximum", () => {
      const r = spawnSync(process.execPath, [join(repoRoot, "scripts/instruction-budget.mjs"), "--json"], { encoding: "utf8" });
      assert(r.status === 0, r.stdout.slice(0, 400));
      const { phases } = JSON.parse(r.stdout);
      assert(phases.length === 10, "not ten phases");
    }],
    ["a command grown past its budget is caught (the old 3,939-word /implement)", () => {
      const copy = join(work, "repo");
      for (const d of ["AGENTS.md", "playbook", "harness"]) cpSync(join(repoRoot, d), join(copy, d), { recursive: true });
      writeFileSync(join(copy, "harness/opencode/command/implement.md"), `---\nd: x\n---\n${"word ".repeat(3939)}`);
      const r = spawnSync(process.execPath, [join(repoRoot, "scripts/instruction-budget.mjs"), `--root=${copy}`], { encoding: "utf8" });
      assert(r.status === 1 && /3 Build .* OVER/.test(r.stdout), r.stdout);
    }],
  ],
  "PB-13": [
    ["the escaped duplicate-import bug stores one derived outcome", () => {
      const r = script("playbook-miss.mjs", ["open", "--miss-class=wrong-behaviour", "--artifact=src", "--severity=major", "--found-by=human", "--found-phase=post-verification-bugs", "--item-id=INV-003", "--protocol=spec=yes,playbook=yes,check=yes"], { PLAYBOOK_TELEMETRY: "1" });
      assert(/opened MISS-/.test(r.stdout), r.stdout + r.stderr);
      const rec = JSON.parse(readFileSync(join(installed(), "verification/telemetry/misses.ndjson"), "utf8").trim().split("\n").at(-1));
      assert(rec.protocol_outcome === "weak-check", `outcome ${rec.protocol_outcome}`);
    }],
    ["each fixed response maps to its outcome", async () => {
      const { protocolOutcome } = await import(join(repoRoot, "scripts/miss-lib.mjs"));
      const expect = { "spec=no": "spec-gap", "spec=yes,playbook=no": "playbook-gap", "spec=yes,playbook=yes,check=yes": "weak-check", "spec=yes,playbook=yes,check=no,ignored=yes": "ignored-rule" };
      for (const [a, o] of Object.entries(expect)) assert(protocolOutcome(a).outcome === o, `${a} -> ${JSON.stringify(protocolOutcome(a))}`);
    }],
    ["answers out of order, past a fixed response, or unresolved are refused and nothing is written", async () => {
      const { protocolOutcome } = await import(join(repoRoot, "scripts/miss-lib.mjs"));
      for (const a of ["playbook=no", "spec=no,playbook=no", "spec=yes,playbook=yes,check=no,ignored=no", "spec=maybe"]) assert(protocolOutcome(a).error, `accepted ${a}`);
      const before = readFileSync(join(installed(), "verification/telemetry/misses.ndjson"), "utf8");
      script("playbook-miss.mjs", ["open", "--miss-class=wrong-behaviour", "--artifact=src", "--severity=major", "--found-by=human", "--protocol=check=yes"], { PLAYBOOK_TELEMETRY: "1" });
      assert(readFileSync(join(installed(), "verification/telemetry/misses.ndjson"), "utf8") === before, "a refused record was written");
    }],
    ["a typed outcome is refused: it is derived, never supplied", () => {
      const r = script("playbook-miss.mjs", ["open", "--miss-class=other", "--artifact=src", "--severity=minor", "--found-by=human", "--protocol-outcome=spec-gap"], { PLAYBOOK_TELEMETRY: "1" });
      assert(/derived from --protocol/.test(r.stdout + r.stderr), r.stdout + r.stderr);
    }],
    ["the committed stream (records before the field) stays valid, and a historical miss can be amended once", async () => {
      const lib = await import(join(repoRoot, "scripts/miss-lib.mjs"));
      const { records } = lib.readMisses(join(repoRoot, "verification/telemetry/misses.ndjson"));
      assert(!lib.validateMisses(records).errors.length, lib.validateMisses(records).errors.join("; "));
      const first = records.find((r) => r.kind === "miss");
      const amend = lib.buildAmendRecord(first.miss_id, "protocol_outcome", "spec=yes,playbook=no", { records });
      assert(amend.record?.value === "playbook-gap", JSON.stringify(amend));
      const again = lib.buildAmendRecord(first.miss_id, "protocol_outcome", "spec=no", { records: [...records, amend.record] });
      assert(again.errors?.length, "a second amend overwrote the outcome");
    }],
  ],
  "PB-25": [
    ["waves put every dependency in an earlier wave and every shared file under one builder", () => {
      const r = script("checklist-plan.mjs", ["implement", join(repoRoot, "tests/checklist/fixtures/medium-checklist.md"), "--json"]);
      assert(r.status === 0, r.stdout);
      const plan = JSON.parse(r.stdout);
      const waveOf = new Map();
      const fileOwner = new Map();
      plan.waves.forEach((w) => w.slices.forEach((s, i) => { for (const it of s.items) waveOf.set(it, w.wave); for (const f of s.files) { assert(!fileOwner.has(f), `${f} owned twice`); fileOwner.set(f, `${w.wave}:${i}`); } }));
      assert(waveOf.get("INV-004") > waveOf.get("INV-003") && waveOf.get("INV-008") > waveOf.get("INV-007"), "a dependency ran in the same or a later wave");
      assert(plan.scope.length === 14, `scope ${plan.scope.length}`);
    }],
    ["fix mode selects exactly the failed item set (INV-002, INV-003)", () => {
      const r = script("checklist-plan.mjs", ["fix", put("failed.md", failedSet()), "--json"]);
      assert(JSON.stringify(JSON.parse(r.stdout).scope.sort()) === '["INV-002","INV-003"]', r.stdout);
    }],
    ["a dependency cycle stops the plan", () => {
      const t = planned().replace(/(- \[ \] Write no rows when a duplicate import is rejected[\s\S]*?  - Coding Standards: .*\n)/, "$1  - Depends on: INV-004\n");
      const r = script("checklist-plan.mjs", ["implement", put("cycle.md", t)]);
      assert(r.status === 1 && /dependency cycle/.test(r.stdout), r.stdout);
    }],
  ],
  "PB-26": [
    ["a fully built checklist passes build completion", () => {
      const r = script("phase-complete.mjs", ["build", put("built.md", built())]);
      assert(r.status === 0, r.stdout);
    }],
    ["an item left planned fails completion (misses INSTALL-LAYOUT and OC-005: partial implementation)", () => {
      const r = script("phase-complete.mjs", ["build", put("partial.md", setStatus(built(), "INV-006", "planned"))]);
      assert(r.status === 1 && /unfinished: INV-006 \(planned\)/.test(r.stdout), r.stdout);
    }],
    ["an owned external blocker completes the item; an ownerless one does not", () => {
      const owned = annotate(setStatus(built(), "INV-006", "blocked"), TITLES["INV-006"], "- [EXTERNAL BLOCKER] audit service credentials; owner: platform team supplies them");
      assert(script("phase-complete.mjs", ["build", put("owned.md", owned)]).status === 0, "owned blocker not accepted");
      const bare = annotate(setStatus(built(), "INV-006", "blocked"), TITLES["INV-006"], "- [EXTERNAL BLOCKER] credentials");
      assert(script("phase-complete.mjs", ["build", put("bare.md", bare)]).status === 1, "ownerless blocker accepted");
    }],
    ["a builder marking its own item pass is refused", () => {
      const r = script("phase-complete.mjs", ["build", put("selfpass.md", setStatus(built(), "INV-001", "pass"))]);
      assert(r.status === 1 && /only the Verifier passes/.test(r.stdout), r.stdout);
    }],
    ["fix completion needs a newer Fix applied line and to-verify on every failed item", () => {
      let t = failedSet();
      const r1 = script("phase-complete.mjs", ["fix", put("fix0.md", t)]);
      assert(r1.status === 1 && /INV-002/.test(r1.stdout) && /INV-003/.test(r1.stdout), r1.stdout);
      for (const itemId of ["INV-002", "INV-003"]) t = annotate(setStatus(t, itemId, "to-verify"), TITLES[itemId], "- **Fix applied** (2026-09-27): import now runs in one transaction");
      const r2 = script("phase-complete.mjs", ["fix", put("fix1.md", t)]);
      assert(r2.status === 0, r2.stdout);
    }],
    ["a missing Deployment Steps section fails completion", () => {
      const r = script("phase-complete.mjs", ["build", put("nodeploy.md", built().replace(/## Deployment Steps[\s\S]*?## Verifier Run Log/, "## Verifier Run Log"))]);
      assert(r.status === 1 && /Deployment Steps/.test(r.stdout), r.stdout);
    }],
  ],
  "PB-27": [
    ["the greenfield BRD maps fully onto the planned checklist", () => {
      const r = script("plan-coverage.mjs", [join(repoRoot, "tests/phase/fixtures/team-inventory-brd.md"), join(repoRoot, "tests/phase/fixtures/team-inventory-checklist.md")]);
      assert(r.status === 0, r.stdout);
    }],
    ["an unmapped requirement and an unmapped screen are named (plan P12/P13)", () => {
      const brd = put("brd.md", fixture("tests/phase/fixtures/team-inventory-brd.md") + "\n- BRD-7: Export the inventory.\n\n### Screen: Export screen\n");
      const r = script("plan-coverage.mjs", [brd, join(repoRoot, "tests/phase/fixtures/team-inventory-checklist.md")]);
      assert(r.status === 1 && /unmapped requirement: BRD-7/.test(r.stdout) && /unmapped screen: Export screen/.test(r.stdout), r.stdout);
    }],
  ],
  "PB-28": [
    ["open links the returned ID once; a repeat collapses without a second link", () => {
      const file = put("coord.md", failedSet());
      const args = ["open", file, "INV-002", "--miss-class=wrong-behaviour", "--artifact=src", "--severity=major", "--found-by=verifier", "--found-phase=verification-results-gate", "--harness=opencode"];
      const a = script("checklist-miss-coordinator.mjs", args);
      const idA = a.stdout.match(/linked to (MISS-\S+)/)?.[1];
      assert(idA, a.stdout);
      const b = script("checklist-miss-coordinator.mjs", args);
      assert(b.stdout.includes(idA), b.stdout);
      const meta = JSON.parse(readFileSync(file, "utf8").match(/<!-- metadata: (\{[^\n]*"id":"INV-002"[^\n]*\}) -->/)[1]);
      assert(JSON.stringify(meta.misses) === JSON.stringify([idA]), `misses ${meta.misses}`);
    }],
    ["close appends a deferred fix and keeps the ID in metadata", () => {
      const file = join(installed(), "coord.md");
      const r = script("checklist-miss-coordinator.mjs", ["close", file, "INV-002", "--verdict-after=deferred", "--fix-phase=fix"]);
      assert(/MISS-/.test(r.stdout), r.stdout);
      const last = JSON.parse(readFileSync(join(installed(), "verification/telemetry/misses.ndjson"), "utf8").trim().split("\n").at(-1));
      assert(last.kind === "miss-fix" && last.verdict_after === "deferred", JSON.stringify(last));
      assert(/"misses":\["MISS-/.test(readFileSync(file, "utf8")), "ID removed from metadata");
    }],
    ["a refused telemetry call leaves the checklist unchanged and exits 0", () => {
      const file = join(installed(), "coord.md");
      const before = readFileSync(file, "utf8");
      const r = script("checklist-miss-coordinator.mjs", ["open", file, "INV-003", "--miss-class=not-a-class", "--artifact=src", "--severity=major", "--found-by=verifier"]);
      assert(r.status === 0 && /telemetry refused/.test(r.stdout), r.stdout);
      assert(readFileSync(file, "utf8") === before, "checklist changed on a refusal");
    }],
  ],
};

if (!cases[id]) {
  console.log(`${id} fail: tests/phase/run.mjs has no case set for this ID`);
  process.exit(1);
}
await runCases(id, cases[id]);
