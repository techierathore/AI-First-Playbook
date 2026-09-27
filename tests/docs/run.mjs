// Document tools, run from an installed target over the Team Inventory
// fixtures (invented from the greenfield case study) and the legacy documents
// under docs/.
//   node tests/docs/run.mjs PB-29   render only human docs, safely, by script
//   node tests/docs/run.mjs PB-30   documents follow their schema
//   node tests/docs/run.mjs PB-31   drift and broken references are named
//   node tests/docs/run.mjs PB-32   legacy documents are backed up before an upgrade
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assert, repoRoot, requirementId, runCases } from "../lib.mjs";

const id = requirementId("PB-29");
const work = mkdtempSync(join(tmpdir(), "pb-docs-"));
process.on("exit", () => rmSync(work, { recursive: true, force: true }));
const target = join(work, "target");
const install = spawnSync(process.execPath, [join(repoRoot, "scripts/install.mjs"), "install", `--target=${target}`], { encoding: "utf8" });
if (install.status !== 0) throw new Error(install.stderr);
const run = (name, args) => spawnSync(process.execPath, [join(target, ".playbook/scripts", name), ...args], { cwd: target, encoding: "utf8" });
const fixtures = join(repoRoot, "tests/docs/fixtures");
const FLOW = "Team-Inventory-Developer-Flow-Guide.md";
const BIZ = "Team-Inventory-Business-Verification-Reference.md";
const docs = join(target, "docs/team-inventory");
mkdirSync(docs, { recursive: true });
const put = (name, text) => { const p = join(docs, name); writeFileSync(p, text); return p; };
const read = (name) => readFileSync(join(fixtures, name), "utf8");
const check = (name, text, size = "small") => run("doc-check.mjs", [put(name, text), `--size=${size}`]);
const expectFail = (name, text, pattern) => {
  const r = check(name, text);
  assert(r.status === 1 && pattern.test(r.stdout), `expected ${pattern}: ${r.stdout}`);
};

const cases = {
  "PB-29": [
    ["legacy human documents under docs/ render to HTML with their title and full source", () => {
      for (const f of ["Greenfield-Case-Study.md", "Brownfield-Case-Study.md"]) cpSync(join(repoRoot, "docs/examples", f), join(docs, f));
      const r = run("render-docs.mjs", [docs]);
      assert(r.status === 0, r.stdout);
      const html = readFileSync(join(docs, "Greenfield-Case-Study.html"), "utf8");
      assert(html.includes("<title>Greenfield Project Runbook: Team Inventory</title>"), "title missing");
    }],
    ["the checklist and an Issues file are never rendered (plan P31)", () => {
      put("Team-Inventory-Implementation-Checklist.md", "# Checklist\n");
      put("Team-Inventory-Issues.md", "# Issues\n");
      const r = run("render-docs.mjs", [docs, "--overwrite"]);
      assert(/skip .*Implementation-Checklist.md — agent document/.test(r.stdout) && /skip .*Issues.md — agent document/.test(r.stdout), r.stdout);
      assert(!existsSync(join(docs, "Team-Inventory-Implementation-Checklist.html")), "checklist rendered");
    }],
    ["a document containing </textarea><script> cannot break out of the page", () => {
      const p = put("Hostile-Guide.md", "# Hostile\n\nText </textarea><script>alert(1)</script> & more\n");
      const r = run("render-docs.mjs", [p]);
      assert(r.status === 0, r.stdout);
      const html = readFileSync(p.replace(/\.md$/, ".html"), "utf8");
      assert(!html.includes("<script>alert(1)</script>") && html.includes("&lt;/textarea&gt;&lt;script&gt;"), "markdown was not escaped");
    }],
    ["an existing page is kept unless --overwrite is given", () => {
      const out = join(docs, "Greenfield-Case-Study.html");
      writeFileSync(out, "kept");
      assert(/exists \(use --overwrite\)/.test(run("render-docs.mjs", [join(docs, "Greenfield-Case-Study.md")]).stdout), "no skip message");
      assert(readFileSync(out, "utf8") === "kept", "page overwritten without --overwrite");
    }],
  ],
  "PB-30": [
    ["the Team Inventory flow guide and business reference pass their schemas", () => {
      assert(check(FLOW, read(FLOW)).status === 0, check(FLOW, read(FLOW)).stdout);
      assert(check(BIZ, read(BIZ)).status === 0, check(BIZ, read(BIZ)).stdout);
    }],
    ["every scaffold has the right structure; only its placeholders remain to fill", () => {
      const kinds = run("doc-scaffold.mjs", ["kinds"]).stdout.trim().split("\n");
      assert(kinds.length === 6, `kinds ${kinds}`);
      for (const k of kinds) {
        const out = join(work, `S-${k}.md`);
        run("doc-scaffold.mjs", [k, out, "--feature=S", "--subject=Mixed"]);
        const r = run("doc-check.mjs", [out, `--kind=${k}`]);
        const lines = r.stdout.trim().split("\n").slice(0, -1);
        assert(lines.length && lines.every((l) => /unfilled placeholder/.test(l)), `${k}: ${lines.filter((l) => !/unfilled placeholder/.test(l)).join(" | ")}`);
      }
    }],
    ["SQL in the business reference fails (add-doc: no SQL, code or internal names)", () =>
      expectFail(BIZ, read(BIZ).replace("Assets per owner is the number", "Assets per owner is SELECT COUNT(*) FROM assets, the number"), /plain English only/)],
    ["an internal file name in the business reference fails", () =>
      expectFail(BIZ, read(BIZ).replace("an asset with no owner", "an asset with no owner in AssetRepository.cs"), /internal name/)],
    ["a data source without a portal path fails", () =>
      expectFail(BIZ, read(BIZ).replace("Inventory screen → Owner filter → grid footer", "somewhere"), /without a portal path/)],
    ["an ASCII diagram fails; Mermaid is required", () =>
      expectFail(FLOW, read(FLOW).replace("Authorization runs", "+-----+ --> [API]\nAuthorization runs"), /ASCII diagram/)],
    ["a 20-line code listing fails; the guide is a map", () =>
      expectFail(FLOW, read(FLOW).replace("## 4. Cross-cutting flows", `\`\`\`ts\n${"line();\n".repeat(20)}\`\`\`\n\n## 4. Cross-cutting flows`), /code listing/)],
    ["a missing section and a flow row with no identifier fail", () => {
      expectFail(FLOW, read(FLOW).replace(/## 5\. Where do I look[\s\S]*$/, ""), /missing section "## Where do I look"/);
      expectFail(FLOW, read(FLOW).replace("`ImportRepository.ts:insertAssets`", "the repository"), /names no identifier/);
    }],
    ["the readable schema page matches the machine schemas", () => {
      const r = spawnSync(process.execPath, [join(repoRoot, "scripts/document-schemas-doc.mjs"), "--check"], { encoding: "utf8" });
      assert(r.status === 0, r.stdout);
    }],
    ["a document over its size maximum fails", () =>
      expectFail(FLOW, read(FLOW).replace("## 4. Cross-cutting flows", `${"word ".repeat(1600)}\n\n## 4. Cross-cutting flows`), /maximum is 1500/)],
  ],
  "PB-31": [
    ["the flow guide matches the fixture code: nothing stale", () => {
      const r = run("doc-drift.mjs", [join(fixtures, FLOW), `--code=${join(fixtures, "code")}`]);
      assert(r.status === 0, r.stdout);
    }],
    ["a renamed method is reported stale by line (refresh-doc Mode B)", () => {
      const code = join(work, "code");
      cpSync(join(fixtures, "code"), code, { recursive: true });
      const f = join(code, "src/api/imports/ImportRepository.ts");
      writeFileSync(f, readFileSync(f, "utf8").replace("insertAssets", "writeAssets"));
      const r = run("doc-drift.mjs", [join(fixtures, FLOW), `--code=${code}`]);
      assert(r.status === 1 && /ImportRepository.ts:insertAssets` — method not found/.test(r.stdout), r.stdout);
    }],
    ["the repository's reader documents have no broken link", () => {
      const r = spawnSync(process.execPath, [join(repoRoot, "scripts/reference-lint.mjs"), "README.md", "phases", "templates", "onboarding", "docs/Getting-Started.md"], { cwd: repoRoot, encoding: "utf8" });
      assert(r.status === 0, r.stdout);
    }],
    ["two broken README links (campaign V01) and a missing anchor are caught", () => {
      const p = put("README.md", "# R\n\n## Setup\n\n[a](missing.md) [b](../nowhere/x.md) [c](#setup) [d](#no-such-heading)\n");
      const r = run("reference-lint.mjs", [p]);
      assert(r.status === 1 && (r.stdout.match(/broken link/g) ?? []).length === 2 && /missing anchor #no-such-heading/.test(r.stdout) && !/#setup/.test(r.stdout), r.stdout);
    }],
    ["a checklist Location naming a path that does not exist is caught", () => {
      const p = put("Loc-Implementation-Checklist.md", "- [ ] Do a thing\n  - Location: `src/api/imports/Nope.ts`\n");
      const r = run("reference-lint.mjs", [p]);
      assert(r.status === 1 && /Nope.ts` does not exist/.test(r.stdout), r.stdout);
    }],
  ],
  "PB-32": [
    ["a legacy document is backed up byte-for-byte before an upgrade; a second backup is refused", () => {
      const legacy = put("Operating-Model.md", readFileSync(join(repoRoot, "docs/archive/replaced/Operating-Model.md"), "utf8"));
      const a = run("doc-upgrade.mjs", ["backup", legacy, "--run-id=upgrade-1"]);
      assert(a.status === 0, a.stdout);
      assert(readFileSync(join(docs, "_legacy/upgrade-1/Operating-Model.md"), "utf8") === readFileSync(legacy, "utf8"), "backup differs");
      const b = run("doc-upgrade.mjs", ["backup", legacy, "--run-id=upgrade-1"]);
      assert(b.status === 1 && /already exists/.test(b.stdout), b.stdout);
    }],
    ["the report shows the upgraded document and the untouched backup", () => {
      writeFileSync(join(docs, "Operating-Model.md"), "# Operating Model\n\nupgraded\n");
      const r = run("doc-upgrade.mjs", ["report", docs]);
      assert(/backup upgrade-1\/Operating-Model.md .* current upgraded/.test(r.stdout), r.stdout);
      assert(readFileSync(join(docs, "_legacy/upgrade-1/Operating-Model.md"), "utf8").length > 100, "backup was changed");
    }],
  ],
};

if (!cases[id]) {
  console.log(`${id} fail: tests/docs/run.mjs has no case set for this ID`);
  process.exit(1);
}
await runCases(id, cases[id]);
