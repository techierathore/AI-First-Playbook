// Reader navigation (PB-16) and cross-framework separation (PB-17). The repo
// must pass; copies with the defects the plan measured must fail.
//   node tests/navigation/run.mjs PB-16|PB-17
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assert, repoRoot, requirementId, runCases } from "../lib.mjs";

const id = requirementId("PB-16");
const work = mkdtempSync(join(tmpdir(), "pb-nav-"));
process.on("exit", () => rmSync(work, { recursive: true, force: true }));
let n = 0;
function copy() {
  const dir = join(work, `repo-${++n}`);
  for (const p of ["README.md", "LICENSE", "package.json", "docs", "phases", "templates", "onboarding", "scripts", "harness", "tests", "playbook", ".github"]) cpSync(join(repoRoot, p), join(dir, p), { recursive: true });
  return dir;
}
const check = (dir) => spawnSync(process.execPath, [join(dir, "scripts/reader-path.mjs"), `--root=${dir}`], { encoding: "utf8" });
const edit = (dir, file, fn) => writeFileSync(join(dir, file), fn(readFileSync(join(dir, file), "utf8")));
const expectFail = (dir, pattern) => { const r = check(dir); assert(r.status === 1 && pattern.test(r.stdout), `expected ${pattern}: ${r.stdout}`); };

const cases = {
  "PB-16": [
    ["the repository's reader path passes", () => { const r = check(repoRoot); assert(r.status === 0, r.stdout); }],
    ["a stray document at the docs root fails (31 documents sat there before the reset)", () => {
      const d = copy();
      writeFileSync(join(d, "docs/Usage.md"), "# Usage\n");
      expectFail(d, /docs\/Usage.md is neither a reader document/);
    }],
    ["a README whose first document link is not Getting Started fails (the plan found no README link to it)", () => {
      const d = copy();
      edit(d, "README.md", (t) => t.replace("## Read in this order", "See [telemetry](docs/maintainer/Telemetry-Guide.md).\n\n## Read in this order"));
      expectFail(d, /first document link is docs\/maintainer/);
    }],
    ["a Getting Started back at its old 5,309 words fails", () => {
      const d = copy();
      cpSync(join(repoRoot, "docs/archive/replaced/Getting-Started.md"), join(d, "docs/Getting-Started.md"));
      expectFail(d, /Getting Started has \d+ words/);
    }],
    ["a reader document linking into the archive fails", () => {
      const d = copy();
      edit(d, "docs/Operating-Guide.md", (t) => `${t}\nOld: [usage](archive/replaced/Usage.md)\n`);
      expectFail(d, /links into the archive/);
    }],
  ],
  "PB-17": [
    ["TechieFlow and TfLens documents sit only under docs/maintainer/cross-framework and are not packaged", () => { const r = check(repoRoot); assert(r.status === 0, r.stdout); }],
    ["a TfLens contract back at the docs root fails", () => {
      const d = copy();
      cpSync(join(repoRoot, "docs/maintainer/cross-framework/Phase-Efficiency-TfLens-Contract.md"), join(d, "docs/Phase-Efficiency-TfLens-Contract.md"));
      expectFail(d, /Phase-Efficiency-TfLens-Contract.md belongs under docs\/maintainer\/cross-framework/);
    }],
    ["a reader document linking a TechieFlow document fails", () => {
      const d = copy();
      edit(d, "docs/Getting-Started.md", (t) => `${t}\n[TechieFlow misses](maintainer/cross-framework/Miss-Telemetry-TechieFlow.md)\n`);
      expectFail(d, /links a cross-framework document/);
    }],
    ["a package list shipping a cross-framework document fails", () => {
      const d = copy();
      edit(d, "package.json", (t) => t.replace('"docs/Getting-Started.md",', '"docs/Getting-Started.md",\n    "docs/maintainer/cross-framework/Miss-Telemetry-TechieFlow.md",'));
      expectFail(d, /package.json ships docs\/maintainer\/cross-framework/);
    }],
  ],
};

if (!cases[id]) {
  console.log(`${id} fail: tests/navigation/run.mjs has no case set for this ID`);
  process.exit(1);
}
await runCases(id, cases[id]);
