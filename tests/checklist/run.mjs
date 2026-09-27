// Checklist schema checks (PB-06). The three size fixtures must lint clean;
// each broken twin plants one defect a real project hit and must be caught.
//   node tests/checklist/run.mjs PB-06
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assert, repoRoot, requirementId, runCases } from "../lib.mjs";

const id = requirementId("PB-06");
const target = mkdtempSync(join(tmpdir(), "pb-checklist-"));
process.on("exit", () => rmSync(target, { recursive: true, force: true }));
const install = spawnSync(process.execPath, [join(repoRoot, "scripts/install.mjs"), "install", `--target=${target}`], { encoding: "utf8" });
if (install.status !== 0) throw new Error(install.stderr);

const fixture = (name) => readFileSync(join(repoRoot, "tests/checklist/fixtures", `${name}-checklist.md`), "utf8");
function lint(text) {
  const file = join(target, "checklist.md");
  writeFileSync(file, text);
  const r = spawnSync(process.execPath, [join(target, ".playbook/scripts/checklist-lint.mjs"), file, "--json"], { cwd: target, encoding: "utf8" });
  return { status: r.status, ...JSON.parse(r.stdout) };
}
const small = fixture("small");
const firstAcceptance = small.match(/  - Acceptance: .*/)[0];
const expectProblem = (text, pattern, label) => {
  const r = lint(text);
  assert(r.status === 1, `${label}: lint passed`);
  assert(r.problems.some((p) => pattern.test(p.message)), `${label}: expected ${pattern}, got ${r.problems.map((p) => p.message).join(" | ")}`);
};

await runCases(id, [
  ["the small, medium and large fixtures lint clean in their size class", () => {
    for (const size of ["small", "medium", "large"]) {
      const r = lint(fixture(size));
      assert(r.status === 0, `${size}: ${r.problems.map((p) => `${p.where} ${p.message}`).join("; ")}`);
      assert(r.size === size, `${size} fixture classified as ${r.size}`);
    }
  }],
  ["the template's worked example lints clean", () => {
    const tpl = readFileSync(join(repoRoot, "templates/checklist-item-template.md"), "utf8");
    const example = tpl.split("## Worked example")[1].match(/```markdown\n([\s\S]*?)```/)[1];
    const r = lint(`# Example\n\n## Status Table\n\n| REQ-014 | planned |\n\n${example}\n## Infrastructure Requirements\n\n## Deployment Steps\n\n## Verifier Run Log\n`);
    assert(r.status === 0, r.problems.map((p) => p.message).join("; "));
  }],
  ["an acceptance line bundling two outcomes with \"and\" fails (TechieFlow: 14 misses from two-reading lines)", () =>
    expectProblem(small.replace(firstAcceptance, "  - Acceptance: When an operator selects owner Ana Ruiz on the Inventory screen, then rows show Ana Ruiz and the count updates"), /joins outcomes with "and"/, "bundled")],
  ["a 41-word acceptance line fails the 30-word maximum (TechieFlow FR-15)", () =>
    expectProblem(small.replace(firstAcceptance, `  - Acceptance: When an operator selects owner Ana Ruiz on the Inventory screen after opening it from the main menu on a Monday morning, then every visible row in the grid below the filter bar shows the owner name Ana Ruiz in its owner column`), /maximum 30/, "long")],
  ["a subjective acceptance word fails", () =>
    expectProblem(small.replace(firstAcceptance, "  - Acceptance: When an operator selects owner Ana Ruiz on the Inventory screen, then the grid filters correctly"), /subjective word "correctly"/, "subjective")],
  ["the old template's free-form acceptance (no When/then) fails", () =>
    expectProblem(small.replace(firstAcceptance, "  - Acceptance: clicking Export downloads a file whose row count equals the visible grid row count"), /must read "When/, "free-form")],
  ["a Verify with no assertion and no retained evidence fails (Playbook MISS on OC-005/OC-007: insufficient-verify-method)", () =>
    expectProblem(small.replace(/  - Verify: Playwright selects the owner.*/, "  - Verify: Look at the screen."), /no assertion/, "weak verify")],
  ["a UI item without its UI ref fails", () =>
    expectProblem(small.replace(/  - UI ref: Inventory screen, filter bar.*\n/, ""), /missing field "UI ref"/, "ui ref")],
  ["an unknown Type fails", () => expectProblem(small.replace("  - Type: ui", "  - Type: frontend"), /Type "frontend" not in/, "type")],
  ["fields out of order fail", () => {
    const moved = small.replace(/(  - Behavior: Choosing an owner.*\n)(  - Location: .*\n)/, "$2$1");
    expectProblem(moved, /fields out of order/, "order");
  }],
  ["metadata without the append-only misses array fails", () =>
    expectProblem(small.replace(',"evidence":[],"misses":[]}', ',"evidence":[]}'), /missing "misses"/, "misses")],
  ["a dependency cycle fails", () =>
    expectProblem(small.replace(/(- \[ \] Write no rows when a duplicate import is rejected[\s\S]*?  - Coding Standards: .*\n)/, "$1  - Depends on: INV-004\n"), /dependency cycle/, "cycle")],
  ["an item missing from the Status Table fails", () => expectProblem(small.replace("| INV-002 | planned |\n", ""), /missing from the Status Table/, "status table")],
  ["more than 75 active items fails with split or archive", () => {
    const items = [...fixture("large").matchAll(/<!-- metadata[\s\S]*?(?=\n\n<!-- metadata|\n\n## Infrastructure)/g)].map((m) => m[0]);
    let n = 0;
    const many = Array.from({ length: 3 }, (_, round) => items.map((t) => t.replace(/INV-(\d{3})/g, () => `INV-${String(++n).padStart(3, "0")}`).replace(/^(- \[ \] .*)$/m, `$1 round ${round}`))).flat().join("\n\n");
    const table = Array.from({ length: n }, (_, i) => `| INV-${String(i + 1).padStart(3, "0")} | planned |`).join("\n");
    const r = lint(`# Big\n\n## Status Table\n\n${table}\n\n${many.replace(/  - Depends on: .*\n?/g, "")}\n\n## Infrastructure Requirements\n\n## Deployment Steps\n\n## Verifier Run Log\n`);
    assert(r.problems.some((p) => /split or archive/.test(p.message)), `no split message for ${r.active} items`);
  }],
]);
