// Handoff records (PB-07) and template schema blocks (PB-08).
//   node tests/handoff/run.mjs PB-07   all 8 examples valid; each broken twin caught; create refuses bad input
//   node tests/handoff/run.mjs PB-08   every template declares its schema; broken templates caught
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assert, repoRoot, requirementId, runCases } from "../lib.mjs";

const id = requirementId("PB-07");
const work = mkdtempSync(join(tmpdir(), "pb-handoff-"));
process.on("exit", () => rmSync(work, { recursive: true, force: true }));
const good = join(repoRoot, "tests/handoff/fixtures/good");
const read = (kind) => readFileSync(join(good, `${kind}.md`), "utf8");

let target;
function installed() {
  if (target) return target;
  target = join(work, "target");
  const r = spawnSync(process.execPath, [join(repoRoot, "scripts/install.mjs"), "install", `--target=${target}`], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr);
  return target;
}
const cli = (...args) => spawnSync(process.execPath, [join(installed(), ".playbook/scripts/handoff-record.mjs"), ...args], { cwd: installed(), encoding: "utf8" });
function broken(kind, mutate, pattern, label) {
  const file = join(work, `${label.replace(/\W+/g, "-")}.md`);
  writeFileSync(file, mutate(read(kind)));
  const r = cli("validate", file);
  assert(r.status === 1, `${label}: record passed validation`);
  assert(pattern.test(r.stdout), `${label}: expected ${pattern}, got ${r.stdout}`);
}

const cases = {
  "PB-07": [
    ["all eight accepted handoff examples carry the 10 standing fields and validate", () => {
      const files = readdirSync(good).map((f) => join(good, f));
      assert(files.length === 8, `expected 8 examples, found ${files.length}`);
      const r = cli("validate", ...files);
      assert(r.status === 0, r.stdout);
      const schema = JSON.parse(readFileSync(join(repoRoot, "playbook/handoff-schema.json"), "utf8"));
      for (const [kind, k] of Object.entries(schema.kinds)) for (const f of Object.keys(schema.standing)) assert(k.fields.includes(f), `${kind} lacks standing field ${f}`);
    }],
    ["a record without an escalation owner fails (plan P04: no checker validated every gate)", () =>
      broken("plan-approval", (t) => t.replace(/- Escalation owner: .*\n/, ""), /missing row "Escalation owner"/, "no escalation")],
    ["a local-time timestamp fails", () => broken("acceptance", (t) => t.replace("2026-09-27T10:15:00Z", "27/09/2026 10:15 BST"), /UTC ISO-8601/, "local time")],
    ["a blank value fails; none is required instead", () => broken("pr-evidence", (t) => t.replace(/- Reviews: .*/, "- Reviews:"), /empty; write none/, "blank")],
    ["a FAIL verification record that names no item IDs fails", () =>
      broken("verification-results", (t) => t.replace("INV-002 FAIL, INV-003 FAIL", "two items failed"), /name every non-PASS item ID/, "no ids")],
    ["an expiring exception with no expiry date fails", () => broken("acceptance", (t) => t.replace("- Exception expiry: 2026-10-31", "- Exception expiry: none"), /needs its expiry date/, "no expiry")],
    ["a credential in the evidence row fails", () =>
      broken("release-readiness", (t) => t.replace(/- Evidence: .*/, `- Evidence: https://deploy:${"hunter2"}@ops.example.invalid/run/9`), /secret-like value/, "secret")],
    ["an open decision without owner and due date fails", () => broken("plan-approval", (t) => t.replace(/- Open decisions: .*/, "- Open decisions: CSV size limit"), /owner and a due date/, "decision")],
    ["an unfilled template placeholder fails", () => broken("incident", (t) => t.replace(/- Root cause: .*/, "- Root cause: <root cause>"), /template placeholder/, "placeholder")],
    ["create writes a valid record and refuses an invalid one", () => {
      const out = join(installed(), "docs/demo/handoffs/plan-approval.md");
      const values = [...read("plan-approval").matchAll(/^- ([^:]+): (.*)$/gm)].flatMap((m) => ["--set", `${m[1]}=${m[2]}`]);
      const ok = cli("create", "plan-approval", `--out=${out}`, ...values);
      assert(ok.status === 0 && existsSync(out), ok.stdout);
      assert(cli("validate", out).status === 0, "created record does not validate");
      const bad = cli("create", "plan-approval", `--out=${join(installed(), "bad.md")}`, ...values.filter((v) => !v.startsWith("Escalation owner=")));
      assert(bad.status === 1 && !existsSync(join(installed(), "bad.md")), "invalid record was written");
    }],
  ],
  "PB-08": [
    ["every template under templates/ declares a valid schema block", () => {
      const r = spawnSync(process.execPath, [join(repoRoot, "scripts/template-lint.mjs")], { encoding: "utf8" });
      assert(r.status === 0 && /29 of 29/.test(r.stdout), r.stdout);
    }],
    ["a template without a block, a budget above its maximum, and a handoff out of step with the schema all fail", () => {
      const dir = join(work, "templates");
      cpSync(join(repoRoot, "templates"), dir, { recursive: true });
      const strip = (f) => writeFileSync(join(dir, f), readFileSync(join(dir, f), "utf8").replace(/<!-- template-schema:.*-->\n/, ""));
      strip("issues-file-template.md");
      const fix = join(dir, "commands/fix.md");
      writeFileSync(fix, readFileSync(fix, "utf8").replace('"small":[260,380]', '"small":[400,380]'));
      const pa = join(dir, "handoffs/plan-approval.md");
      writeFileSync(pa, readFileSync(pa, "utf8").replace('"Escalation owner",', ""));
      const r = spawnSync(process.execPath, [join(repoRoot, "scripts/template-lint.mjs"), dir], { encoding: "utf8" });
      assert(r.status === 1, "broken templates passed");
      for (const p of [/issues-file-template.md: no <!-- template-schema/, /commands\/fix.md: budget.small TARGET is above MAXIMUM/, /handoffs\/plan-approval.md: required rows differ/]) assert(p.test(r.stdout), `missing ${p}: ${r.stdout}`);
    }],
  ],
};

if (!cases[id]) {
  console.log(`${id} fail: tests/handoff/run.mjs has no case set for this ID`);
  process.exit(1);
}
await runCases(id, cases[id]);
