// Session 10 runtime scripts, run from an INSTALLED copy in a disposable
// project outside the repository. One case per defect the script prevents.
//   node tests/runtime/run.mjs PB-35   Verifier writers, deployment runner, summary, Verifier script allowlist
//   node tests/runtime/run.mjs PB-36   secret-safe config resolver never prints a value
//   node tests/runtime/run.mjs PB-37   smoke runner and self-test writer
//   node tests/runtime/run.mjs PB-38   Infrastructure Requirements and Deployment Steps shapes
//   node tests/runtime/run.mjs PB-39   amend and archive round trip, IDs stable
//   node tests/runtime/run.mjs PB-40   bug/story ingest, escaped-bug and incident loops, feature context
//   node tests/runtime/run.mjs PB-41   plan-review and verification-results gate checks
//   node tests/runtime/run.mjs PB-42   Issues file and Jira fetch (fake Jira; token never printed)
//   node tests/runtime/run.mjs PB-43   Context-Prompt command block drift
//   node tests/runtime/run.mjs PB-44   platform adapters: .NET restore diagnostics, desktop bridge client
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { assert, repoRoot, requirementId, runCases } from "../lib.mjs";

const id = requirementId("PB-35");
const FIX = join(repoRoot, "tests/checklist/fixtures/small-checklist.md");
const TOKEN = "tok-9f8e7d6c5b4a3f2e1d0c";

const target = mkdtempSync(join(tmpdir(), "pb-runtime-"));
process.on("exit", () => rmSync(target, { recursive: true, force: true }));
writeFileSync(join(target, "package.json"), JSON.stringify({ name: "pb-runtime", version: "1.0.0", type: "module" }));
const install = spawnSync(process.execPath, [join(repoRoot, "scripts/install.mjs"), "install", `--target=${target}`], { encoding: "utf8" });
if (install.status !== 0) { console.log(`${id} fail: install failed: ${install.stdout}${install.stderr}`); process.exit(1); }

/** Run an installed runtime script from the target (async, so a fake server in this process can answer). */
function run(script, args, { env = {}, input } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [join(target, ".playbook/scripts", script), ...args], { cwd: target, env: { ...process.env, PLAYBOOK_YOLO: "", ...env } });
    let out = "";
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { out += d; });
    if (input !== undefined) child.stdin.end(input); else child.stdin.end();
    child.on("close", (status) => resolve({ status, out }));
  });
}
const lib = (script) => import(pathToFileURL(join(target, ".playbook/scripts", script)).href);
let n = 0;
function checklist(transform = (t) => t) {
  n += 1;
  const dir = join(target, "docs", `feature-${n}`);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "Team-Inventory-Implementation-Checklist.md");
  writeFileSync(path, transform(readFileSync(FIX, "utf8")));
  return { path, rel: path.slice(target.length + 1), read: () => readFileSync(path, "utf8") };
}
const json = (name, value) => { const p = join(target, name); writeFileSync(p, JSON.stringify(value)); return p.slice(target.length + 1); };
const eq = (a, b, what) => assert(a === b, `${what}: expected ${b}, got ${a}`);
const meta = (text, itemId) => JSON.parse(text.match(new RegExp(`<!-- metadata: (\\{[^\\n]*"id":"${itemId}"[^\\n]*\\}) -->`))[1]);
const statusRow = (text, itemId) => text.match(new RegExp(`^\\| ${itemId} \\| .* \\| ([a-z-]+) \\|$`, "m"))?.[1];
const withDeploy = (rows) => (t) => t.replace(/## Deployment Steps[\s\S]*?(?=## Verifier Run Log)/, `## Deployment Steps\n\n### Automated\n\n${rows}\n\n### Manual\n\n- [ ] Ask the DBA to grant the import role\n\n`);
const passResult = (itemIds, runId = "run-a") => ({ environment: "local", deployment: "none", results: itemIds.map((i) => ({ item: i, outcome: "PASS", evidence: `probe ${i} ok`, links: [`verification/runs/${runId}/p.log`] })) });
const old = (t) => t.replaceAll('"updated_at":"2026-09-26T00:00:00Z"', '"updated_at":"2026-01-01T00:00:00Z"');

async function listen(handler) {
  const server = createServer(handler);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}

const cases = {
  "PB-35": [
    ["result writer appends one Verifier Result per item, sets status from the outcome and syncs the Status Table", async () => {
      const c = checklist();
      const data = { environment: "local", deployment: "none", results: [
        { item: "INV-002", outcome: "FAIL", evidence: "status 200 not 422", fix: "validate duplicate tags before insert" },
        { item: "INV-001", outcome: "PASS", evidence: "one distinct owner" },
        { item: "INV-003", outcome: "DATA-GAP", evidence: "no TAG-7 rows", data_setup: "seed two TAG-7 rows" },
      ] };
      const r = await run("verification-result-writer.mjs", [c.rel, `--results=${json("r1.json", data)}`, "--run-id=run-a"]);
      eq(r.status, 0, r.out);
      const t = c.read();
      eq(meta(t, "INV-001").status, "pass", "INV-001 status");
      eq(meta(t, "INV-002").status, "fail", "INV-002 status");
      eq(statusRow(t, "INV-002"), "fail", "Status Table row");
      assert(/Suggested fix: validate duplicate tags/.test(t) && /Test-data setup needed: seed two TAG-7/.test(t), "fix or setup line missing");
      assert(/### Run on .* \(run-a\)/.test(t) && /- Verdict: 2 not PASS/.test(t), "run log entry missing");
      assert(t.indexOf("Verifier Result** (") > t.indexOf('"id":"INV-001"') && t.indexOf("Verifier Result** (") < t.indexOf('"id":"INV-002"'), "results not in checklist order");
    }],
    ["result writer refuses BLOCKED without its audit, DATA-GAP without setup, an unknown outcome and a secret — and writes nothing", async () => {
      const c = checklist();
      const before = c.read();
      for (const bad of [{ item: "INV-001", outcome: "BLOCKED", evidence: "db down" }, { item: "INV-001", outcome: "DATA-GAP", evidence: "no rows" }, { item: "INV-001", outcome: "OK", evidence: "fine" }, { item: "INV-001", outcome: "PASS", evidence: `password=${TOKEN}` }]) {
        const r = await run("verification-result-writer.mjs", [c.rel, `--results=${json("bad.json", { results: [bad] })}`, "--run-id=run-b"]);
        eq(r.status, 1, `${bad.outcome} accepted: ${r.out}`);
        assert(!r.out.includes(TOKEN), "the refusal echoed the secret");
      }
      eq(c.read(), before, "a refused result changed the checklist");
    }],
    ["regression: syncing the Status Table keeps an item placed directly under the table", async () => {
      const c = checklist((t) => t.replace("\n## Items\n", "\n"));
      const r = await run("verification-result-writer.mjs", [c.rel, `--results=${json("r2.json", passResult(["INV-001"]))}`, "--run-id=run-c"]);
      eq(r.status, 0, r.out);
      eq((c.read().match(/<!-- metadata:/g) ?? []).length, 6, "items after sync");
    }],
    ["regression: a PASS (code-audit) result is not read as a plain PASS", async () => {
      const { latestVerdict } = await lib("checklist-plan.mjs");
      eq(latestVerdict({ extra: ["- **Verifier Result** (2026-09-26): PASS (code-audit) — Evidence: read only"] }), "PASS (code-audit)", "latest verdict");
    }],
    ["deployment runner only plans without approval, runs with it, and stops BLOCKED at the first failure", async () => {
      const c = checklist(withDeploy("- [ ] Write marker\n  - `node -e \"require('fs').writeFileSync('deployed.txt','1')\"`\n- [ ] Fail\n  - `node -e \"process.exit(3)\"`\n- [ ] Never\n  - `node -e \"require('fs').writeFileSync('never.txt','1')\"`"));
      const plan = await run("deployment-step-runner.mjs", [c.rel, "--run-id=dep-1"]);
      assert(plan.status === 0 && /plan only/.test(plan.out) && !existsSync(join(target, "deployed.txt")), `ran without approval: ${plan.out}`);
      assert(/manual  Ask the DBA/.test(plan.out), "manual row not listed as deferred");
      const go = await run("deployment-step-runner.mjs", [c.rel, "--run-id=dep-1", "--approved"]);
      eq(go.status, 2, go.out);
      assert(/BLOCKED/.test(go.out) && existsSync(join(target, "deployed.txt")) && !existsSync(join(target, "never.txt")), `did not stop at the failure: ${go.out}`);
      assert(existsSync(join(target, "verification/runs/dep-1/deploy-2.log")), "no step log");
    }],
    ["summary is rendered from the checklist and routes to the next command", async () => {
      const c = checklist();
      await run("verification-result-writer.mjs", [c.rel, `--results=${json("r3.json", { results: [{ item: "INV-002", outcome: "FAIL", evidence: "status 200" }] })}`, "--run-id=run-d"]);
      let s = await run("verification-summary.mjs", [c.rel]);
      assert(/Verdict: INCOMPLETE/.test(s.out) && /Next: \/verify/.test(s.out), s.out);
      await run("verification-result-writer.mjs", [c.rel, `--results=${json("r4.json", passResult(["INV-001", "INV-003", "INV-004", "INV-005", "INV-006"]))}`, "--run-id=run-d"]);
      s = await run("verification-summary.mjs", [c.rel]);
      assert(/Verdict: 1 FAILs/.test(s.out) && /INV-002: status 200/.test(s.out) && /Next: \/fix/.test(s.out), s.out);
    }],
    ["the installed guardrail lets the Verifier run its own scripts and nothing wider", async () => {
      const { isApprovedVerifierScript } = await import(pathToFileURL(join(target, ".opencode/playbook-plugin/write-policy.mjs")).href);
      for (const ok of ["node .playbook/scripts/verification-result-writer.mjs docs/a/C.md --results=verification/runs/r1/results.json --run-id=r1", "node .playbook/scripts/deployment-step-runner.mjs docs/a/C.md --run-id=r1 --approved", "node .playbook/scripts/playbook-probe.mjs"]) assert(isApprovedVerifierScript(ok), `blocked: ${ok}`);
      for (const bad of ["node .playbook/scripts/checklist-amend.mjs add docs/a/C.md", "node .playbook/scripts/verification-summary.mjs x; rm -rf src", "node .playbook/scripts/verification-summary.mjs ../../etc/passwd", "node src/app.js", "npm test", "node .playbook/scripts/playbook-probe.mjs > src/app.js"]) assert(!isApprovedVerifierScript(bad), `allowed: ${bad}`);
    }],
  ],
  "PB-36": [
    ["file mode writes a 0600 file and prints only its path and length", async () => {
      const r = await run("secret-safe-config-resolver.mjs", ["file", "--key=env:PB_DB_CONN", "--run-id=sec-1"], { env: { PB_DB_CONN: `Server=db;Password=${TOKEN}` } });
      eq(r.status, 0, r.out);
      assert(!r.out.includes(TOKEN), "value printed");
      const file = join(target, r.out.match(/wrote (\S+)/)[1]);
      eq(statSync(file).mode & 0o777, 0o600, "file mode");
      assert(readFileSync(file, "utf8").includes(TOKEN), "file lacks the value");
    }],
    ["pipe mode hands the value on stdin to a command run without a shell", async () => {
      json("appsettings.json", { ConnectionStrings: { Default: `Server=db;Password=${TOKEN}` } });
      const r = await run("secret-safe-config-resolver.mjs", ["pipe", "--key=ConnectionStrings.Default", "--config=appsettings.json", "--", process.execPath, "-e", "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log('len='+s.length))"]);
      eq(r.status, 0, r.out);
      assert(/len=\d+/.test(r.out) && !r.out.includes(TOKEN), r.out);
    }],
    ["a missing reference or key is BLOCKED naming it, never a guessed default", async () => {
      const a = await run("secret-safe-config-resolver.mjs", ["file", "--key=env:PB_NOT_SET", "--run-id=sec-2"]);
      assert(a.status === 2 && /BLOCKED — environment reference PB_NOT_SET/.test(a.out), a.out);
      const b = await run("secret-safe-config-resolver.mjs", ["file", "--key=ConnectionStrings.Missing", "--config=appsettings.json", "--run-id=sec-2"]);
      assert(b.status === 2 && /key ConnectionStrings.Missing is missing/.test(b.out), b.out);
    }],
  ],
  "PB-37": [
    ["smoke runner runs declared http and command probes and writes smoke-results.json", async () => {
      const app = await listen((req, res) => { res.writeHead(req.method === "POST" ? 422 : 200); res.end(req.method === "POST" ? '{"code":"DUPLICATE_TAG"}' : "ok"); });
      try {
        const spec = json("smoke.json", [
          { item: "INV-002", http: { method: "POST", url: `${app.url}/imports`, body: "tag\nTAG-7\nTAG-7", status: 422, contains: "DUPLICATE_TAG" } },
          { item: "INV-005", http: { url: `${app.url}/assets/TAG-1`, status: 200 } },
          { item: "INV-003", command: [process.execPath, "-e", "console.log('unchanged')"], contains: "unchanged" },
          { item: "INV-006", command: [process.execPath, "-e", "process.exit(1)"] },
        ]);
        const r = await run("smoke-runner.mjs", [spec, "--run-id=smoke-1"]);
        eq(r.status, 1, r.out);
        const res = JSON.parse(readFileSync(join(target, "verification/runs/smoke-1/smoke-results.json"), "utf8")).results;
        eq(res.map((x) => x.outcome).join(","), "PASS,PASS,PASS,FAIL", "outcomes");
      } finally { app.close(); }
    }],
    ["a relative URL with a placeholder profile is BLOCKED, not guessed", async () => {
      const r = await run("smoke-runner.mjs", [json("smoke2.json", [{ item: "INV-005", http: { url: "/assets/TAG-1" } }]), "--run-id=smoke-2"]);
      assert(r.status === 2 && /BLOCKED/.test(r.out), r.out);
    }],
    ["self-test writer: PASS → to-verify, FAIL → in-progress, never pass; SKIPPED needs a reason", async () => {
      const c = checklist();
      const r = await run("self-test-result-writer.mjs", [c.rel, "--results=verification/runs/smoke-1/smoke-results.json"]);
      eq(r.status, 0, r.out);
      const t = c.read();
      eq(meta(t, "INV-002").status, "to-verify", "PASS status");
      eq(meta(t, "INV-006").status, "in-progress", "FAIL status");
      assert(!/"status":"pass"/.test(t), "self-test set pass");
      assert(/\*\*Self-test\*\* \(\d{4}-\d{2}-\d{2}\): FAIL/.test(t), "no self-test line");
      const skip = await run("self-test-result-writer.mjs", [c.rel, "--skip=INV-001"]);
      eq(skip.status, 2, skip.out);
      const ok = await run("self-test-result-writer.mjs", [c.rel, "--skip=INV-001", "--reason=user requested"]);
      assert(ok.status === 0 && /SKIPPED — user requested/.test(c.read()), ok.out);
    }],
  ],
  "PB-38": [
    ["infra entries have one shape; a duplicate, a secret or a missing field is refused", async () => {
      const c = checklist();
      const v0 = await run("checklist-infra.mjs", ["validate", c.rel]);
      eq(v0.status, 1, `old free-text entry accepted: ${v0.out}`);
      const c2 = checklist((t) => t.replace("- Import staging folder (INV-008).\n", ""));
      const add = ["add", c2.rel, "--name=Import staging folder", "--what=holds uploaded CSVs before import (INV-002)", "--configured=IMPORT_STAGING_DIR", "--setup=create a writable folder and set the variable"];
      eq((await run("checklist-infra.mjs", add)).status, 0, "add");
      eq((await run("checklist-infra.mjs", add)).status, 1, "duplicate accepted");
      eq((await run("checklist-infra.mjs", ["add", c2.rel, "--name=Db", "--what=x", "--configured=x", `--setup=password=${TOKEN}`])).status, 1, "secret accepted");
      eq((await run("checklist-infra.mjs", ["add", c2.rel, "--name=Queue"])).status, 1, "missing fields accepted");
      eq((await run("checklist-infra.mjs", ["validate", c2.rel])).status, 0, "valid section rejected");
    }],
    ["deployment rows: Automated carries one command, a credential in a command is refused, none is explicit", async () => {
      const c = checklist();
      eq((await run("checklist-deploy.mjs", ["add", c.rel, "--automated", "--title=Apply migrations", "--command=npm run migrate"])).status, 0, "automated add");
      eq((await run("checklist-deploy.mjs", ["add", c.rel, "--manual", "--title=Ask the DBA to grant the import role"])).status, 0, "manual add");
      eq((await run("checklist-deploy.mjs", ["add", c.rel, "--automated", "--title=Seed", `--command=psql postgres://admin:${TOKEN}@db/app -f seed.sql`])).status, 1, "credential URL accepted");
      eq((await run("checklist-deploy.mjs", ["add", c.rel, "--automated", "--title=Seed"])).status, 1, "automated without command accepted");
      const v = await run("checklist-deploy.mjs", ["validate", c.rel]);
      eq(v.status, 0, v.out);
      assert(!c.read().includes(TOKEN), "credential written");
      const { deploymentRows } = await lib("deployment-step-runner.mjs");
      eq(deploymentRows(c.read()).automated[0].command, "npm run migrate", "runner reads the written row");
      const d = checklist((t) => t.replace(/## Deployment Steps[\s\S]*?(?=## Verifier Run Log)/, "## Deployment Steps\n\n### Automated\n\n### Manual\n\n"));
      eq((await run("checklist-deploy.mjs", ["none", d.rel])).status, 0, "none");
      eq((await run("checklist-deploy.mjs", ["validate", d.rel])).status, 0, "none rejected");
    }],
  ],
  "PB-39": [
    ["amend add takes the next stable ID, update changes one field, remove marks out-of-scope; each result lints", async () => {
      const c = checklist();
      const item = json("item.json", { title: "Export the inventory as CSV", Type: "backend-api", Behavior: "GET /exports returns every asset as CSV.", Location: "`src/api/exports/ExportController.ts`", Logging: "INFO at start and completion; ERROR with the asset tag on failure.", Acceptance: "When an operator requests the export endpoint, then the CSV has one row per asset", Verify: "curl requests the export, asserts one row per asset against the assets table, keeps the file.", "Coding Standards": "`docs/coding-standards.md`, section 3.1." });
      const a = await run("checklist-amend.mjs", ["add", c.rel, `--item=${item}`]);
      assert(a.status === 0 && /added INV-007/.test(a.out), a.out);
      const u = await run("checklist-amend.mjs", ["update", c.rel, "INV-002", "--field=Behavior", "--value=The import endpoint rejects a file whose rows share an asset tag, case-insensitively."]);
      assert(u.status === 0 && /case-insensitively/.test(c.read()), u.out);
      const rm = await run("checklist-amend.mjs", ["remove", c.rel, "INV-005", "--reason=moved to the assets feature"]);
      eq(rm.status, 0, rm.out);
      eq(meta(c.read(), "INV-005").status, "out-of-scope", "removed status");
      const lint = spawnSync(process.execPath, [join(target, ".playbook/scripts/checklist-lint.mjs"), c.rel], { cwd: target, encoding: "utf8" });
      eq(lint.status, 0, lint.stdout);
      const again = await run("checklist-amend.mjs", ["add", c.rel, `--item=${json("item2.json", { ...JSON.parse(readFileSync(join(target, item), "utf8")), title: "Export the inventory as JSON" })}`]);
      assert(/added INV-008/.test(again.out), `ID reused: ${again.out}`);
    }],
    ["amend refuses to change a verified PASS item or to write a checklist that fails lint", async () => {
      const c = checklist();
      await run("verification-result-writer.mjs", [c.rel, `--results=${json("r5.json", passResult(["INV-001"]))}`, "--run-id=run-e"]);
      const before = c.read();
      eq((await run("checklist-amend.mjs", ["remove", c.rel, "INV-001", "--reason=x"])).status, 1, "PASS item removed");
      eq((await run("checklist-amend.mjs", ["add", c.rel, `--item=${json("bad-item.json", { title: "Half an item", Type: "ui" })}`])).status, 1, "unlinted item added");
      eq(c.read(), before, "a refused amendment changed the checklist");
    }],
    ["archive moves mature PASS items verbatim and restore brings them back as planned with the same ID", async () => {
      const c = checklist(old);
      await run("verification-result-writer.mjs", [c.rel, `--results=${json("r6.json", passResult(["INV-001", "INV-003", "INV-005"]))}`, "--run-id=run-f"]);
      writeFileSync(c.path, old(c.read().replace(/"updated_at":"[^"]+"/g, '"updated_at":"2026-01-01T00:00:00Z"')));
      const cand = await run("checklist-archive.mjs", ["candidates", c.rel]);
      assert(/eligible INV-001/.test(cand.out) && /eligible INV-005/.test(cand.out), cand.out);
      assert(/kept +INV-003 .*an active item depends on it/.test(cand.out), `dependency not protected: ${cand.out}`);
      const block = c.read().match(/<!-- metadata: \{[^\n]*"id":"INV-005"[\s\S]*?(?=\n\n)/)[0];
      const small = await run("checklist-archive.mjs", ["archive", c.rel]);
      assert(small.status === 0 && /still manageable/.test(small.out) && c.read().includes(block), `small checklist archived: ${small.out}`);
      const a = await run("checklist-archive.mjs", ["archive", c.rel, "--force"]);
      eq(a.status, 0, a.out);
      const hist = readFileSync(c.path.replace(/\.md$/, "-Verified-History.md"), "utf8");
      assert(hist.includes(block), "archived block is not verbatim");
      assert(!c.read().includes('"id":"INV-005"') && /^\| INV-005 \| Return an asset by tag \| \d{4}-/m.test(c.read()), "no history row");
      const r = await run("checklist-archive.mjs", ["restore", c.rel, "INV-005"]);
      eq(r.status, 0, r.out);
      eq(meta(c.read(), "INV-005").status, "planned", "restored status");
      assert(!/^\| INV-005 \| Return/m.test(c.read().split("## Verified History")[1]), "restore left the history row");
      assert(/Restored \(/.test(c.read()), "no Restored line");
      assert(/### Archive on [\s\S]*- Archived: INV-001, INV-005[\s\S]*### Restore on/.test(c.read()), "no run log entries");
    }],
  ],
  "PB-40": [
    ["bug ingest adds one [ANALYZE] block per new issue, is idempotent, and validate fails until analysed", async () => {
      const c = checklist();
      const issues = join(c.path, "..", "Team-Inventory-Issues.md");
      const { renderIssues } = await lib("issues-file.mjs");
      writeFileSync(issues, renderIssues([{ key: "INVB-41", title: "Duplicate import reports success", expected: "422", actual: "200", steps: ["post the two-row CSV"], severity: "High" }], "Team Inventory"));
      const irel = issues.slice(target.length + 1);
      eq((await run("checklist-ingest.mjs", ["bug", c.rel, irel])).status, 0, "ingest");
      const once = c.read();
      await run("checklist-ingest.mjs", ["bug", c.rel, irel]);
      eq(c.read(), once, "ingest is not idempotent");
      eq((await run("checklist-ingest.mjs", ["validate", c.rel, irel])).status, 1, "unanalysed block accepted");
      writeFileSync(c.path, c.read().replace("- Root cause: [ANALYZE]", "- Root cause: the controller ignores the duplicate check result").replace("- Affected items: [ANALYZE]", "- Affected items: INV-099"));
      const bad = await run("checklist-ingest.mjs", ["validate", c.rel, irel]);
      assert(bad.status === 1 && /INV-099, which is not in the checklist/.test(bad.out), bad.out);
      writeFileSync(c.path, c.read().replace("INV-099", "INV-002"));
      const good = await run("checklist-ingest.mjs", ["validate", c.rel, irel]);
      eq(good.status, 0, good.out);
      const s = await run("escaped-bug-workflow.mjs", ["status", c.rel, irel, "--require-retire"]);
      assert(s.status === 1 && /^analyzed/m.test(s.out), `escaped bug stage: ${s.out}`);
      writeFileSync(c.path, c.read().replace("  - Coding Standards: `docs/coding-standards.md`, section 3.1.", "  - Coding Standards: `docs/coding-standards.md`, section 3.1.\n  - **Fix applied** (2026-09-26): check the duplicate result"));
      await run("verification-result-writer.mjs", [c.rel, `--results=${json("r7.json", passResult(["INV-002"]))}`, "--run-id=run-g"]);
      writeFileSync(issues, readFileSync(issues, "utf8").replace("Miss ID**: pending", "Miss ID**: MISS-20260926-09"));
      assert(/^verified/m.test((await run("escaped-bug-workflow.mjs", ["status", c.rel, irel])).out), "not verified");
      writeFileSync(c.path, c.read().replace(/("id":"INV-002"[^\n]*"misses":)\[\]/, '$1["MISS-20260926-09"]'));
      const done = await run("escaped-bug-workflow.mjs", ["status", c.rel, irel, "--require-retire"]);
      assert(done.status === 0 && /may be deleted/.test(done.out), done.out);
    }],
    ["story ingest adds a Story block that must name existing items", async () => {
      const c = checklist();
      writeFileSync(join(target, "story.md"), "# Bulk owner change\nAs an operator I change many owners at once.\n");
      eq((await run("checklist-ingest.mjs", ["story", c.rel, "story.md", "--name=Bulk owner change"])).status, 0, "story ingest");
      assert(/### Story: Bulk owner change \(added \d{4}-\d{2}-\d{2}, source: story.md\)/.test(c.read()), "no story block");
      eq((await run("checklist-ingest.mjs", ["validate", c.rel])).status, 1, "unanalysed story accepted");
    }],
    ["incident loop: the regression item must exist and be verified PASS before the incident is resolved", async () => {
      const c = checklist();
      const rec = readFileSync(join(repoRoot, "tests/handoff/fixtures/good/incident.md"), "utf8").replace("INV-013", "INV-003");
      writeFileSync(join(target, "incident.md"), rec);
      const open = await run("incident-workflow.mjs", ["validate", "incident.md", c.rel]);
      assert(open.status === 1 && /regression item INV-003 has no PASS/.test(open.out), open.out);
      writeFileSync(join(target, "incident-missing.md"), rec.replace("INV-003", "INV-077"));
      assert(/INV-077 is not in the checklist/.test((await run("incident-workflow.mjs", ["validate", "incident-missing.md", c.rel])).out), "missing regression item accepted");
      await run("verification-result-writer.mjs", [c.rel, `--results=${json("r8.json", passResult(["INV-003"]))}`, "--run-id=run-h"]);
      const ok = await run("incident-workflow.mjs", ["validate", "incident.md", c.rel]);
      eq(ok.status, 0, ok.out);
    }],
    ["feature context names the one checklist and refuses to pick between two", async () => {
      const c = checklist();
      const dir = join(c.path, "..");
      copyFileSync(join(repoRoot, "tests/docs/fixtures", "Team-Inventory-Business-Verification-Reference.md"), join(dir, "Team-Inventory-Business-Verification-Reference.md"));
      const r = await run("feature-context.mjs", ["locate", dir.slice(target.length + 1), "--json"]);
      eq(r.status, 0, r.out);
      const ctx = JSON.parse(r.out);
      assert(ctx.checklist.endsWith("Team-Inventory-Implementation-Checklist.md") && ctx.documents.length >= 1, r.out);
      writeFileSync(join(dir, "Other-Implementation-Checklist.md"), "# other\n");
      const two = await run("feature-context.mjs", ["locate", dir.slice(target.length + 1)]);
      assert(two.status === 1 && /ambiguous/.test(two.out), two.out);
    }],
  ],
  "PB-41": [
    ["plan review is READY only with coverage, a clean checklist and an approved plan-approval record", async () => {
      const brd = join(repoRoot, "tests/phase/fixtures/team-inventory-brd.md");
      const cl = join(repoRoot, "tests/phase/fixtures/team-inventory-checklist.md");
      const approval = join(repoRoot, "tests/handoff/fixtures/good/plan-approval.md");
      const none = await run("gate-check.mjs", ["plan-review", cl, `--requirements=${brd}`]);
      assert(none.status === 1 && /no plan-approval record/.test(none.out), none.out);
      const ok = await run("gate-check.mjs", ["plan-review", cl, `--requirements=${brd}`, `--handoff=${approval}`]);
      assert(ok.status === 0 && /READY/.test(ok.out), ok.out);
      writeFileSync(join(target, "rejected.md"), readFileSync(approval, "utf8").replace(/^(- Decision: ).*$/m, "$1changes-requested"));
      assert((await run("gate-check.mjs", ["plan-review", cl, `--requirements=${brd}`, "--handoff=rejected.md"])).status === 1, "rejected plan passed");
    }],
    ["verification results route from the latest verdicts and a record that disagrees is caught", async () => {
      const c = checklist();
      eq((await run("gate-check.mjs", ["verification-results", c.rel])).status, 1, "unverified items passed the gate");
      await run("verification-result-writer.mjs", [c.rel, `--results=${json("r9.json", { results: [...passResult(["INV-001", "INV-003", "INV-004", "INV-005", "INV-006"]).results, { item: "INV-002", outcome: "FAIL", evidence: "200" }] })}`, "--run-id=run-i"]);
      const r = await run("gate-check.mjs", ["verification-results", c.rel]);
      assert(r.status === 0 && /outcome FAIL; next: \/fix/.test(r.out), r.out);
      const rec = readFileSync(join(repoRoot, "tests/handoff/fixtures/good/verification-results.md"), "utf8");
      writeFileSync(join(target, "vr.md"), rec.replace(/^(- Overall outcome: ).*$/m, "$1PASS"));
      const bad = await run("gate-check.mjs", ["verification-results", c.rel, "--handoff=vr.md"]);
      assert(bad.status === 1 && /record says PASS, checklist says FAIL/.test(bad.out), bad.out);
    }],
  ],
  "PB-42": [
    ["issues file: absent facts are [MISSING], and a bad severity, unordered steps or a missing key fail validation", async () => {
      const r = await run("issues-file.mjs", ["render", json("iss.json", [{ key: "INVB-7", title: "Owner filter ignores case", expected: "rows for ana ruiz", steps: ["open Inventory", "type ana ruiz"], severity: "Medium" }]), "--out=Team-Inventory-Issues.md", "--feature=Team Inventory"]);
      eq(r.status, 0, r.out);
      const text = readFileSync(join(target, "Team-Inventory-Issues.md"), "utf8");
      assert(/- \*\*Actual\*\*: \[MISSING\]/.test(text), "absent fact invented");
      eq((await run("issues-file.mjs", ["validate", "Team-Inventory-Issues.md", "--keys=INVB-7"])).status, 0, "valid file rejected");
      eq((await run("issues-file.mjs", ["validate", "Team-Inventory-Issues.md", "--keys=INVB-8"])).status, 1, "missing key accepted");
      writeFileSync(join(target, "bad-issues.md"), text.replace("Medium", "Urgent").replace("1. open", "2. open"));
      const bad = await run("issues-file.mjs", ["validate", "bad-issues.md"]);
      assert(bad.status === 1 && /Urgent/.test(bad.out) && /numbered/.test(bad.out), bad.out);
    }],
    ["jira fetch reads credentials only from the environment, never prints the token, and converts ADF", async () => {
      let auth = "";
      const jira = await listen((req, res) => {
        auth = req.headers.authorization ?? "";
        if (!req.url.startsWith("/rest/api/3/issue/INVB-7")) { res.writeHead(404); res.end("{}"); return; }
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ key: "INVB-7", fields: { summary: "Owner filter ignores case", priority: { name: "Highest" }, description: { type: "doc", content: [
          { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Steps to reproduce" }] },
          { type: "orderedList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "open Inventory" }] }] }, { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "type ana ruiz" }] }] }] },
          { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Expected" }] },
          { type: "paragraph", content: [{ type: "text", text: "rows for Ana Ruiz" }] },
          { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Actual" }] },
          { type: "paragraph", content: [{ type: "text", text: "no rows", marks: [{ type: "strong" }] }] },
        ] } } }));
      });
      try {
        const env = { JIRA_BASE_URL: jira.url, JIRA_EMAIL: "qa@example.invalid", JIRA_API_TOKEN: TOKEN };
        const r = await run("jira-issues.mjs", ["fetch", `${jira.url}/browse/INVB-7`, "INVB-9", "--out=jira.json"], { env });
        assert(r.status === 1 && /1 of 2 ticket/.test(r.out) && /INVB-9: Jira answered 404/.test(r.out), r.out);
        assert(!r.out.includes(TOKEN) && Buffer.from(auth.replace("Basic ", ""), "base64").toString().endsWith(`:${TOKEN}`), "token printed or not sent");
        const [issue] = JSON.parse(readFileSync(join(target, "jira.json"), "utf8"));
        eq(issue.severity, "High", "priority mapping");
        eq(issue.steps.join("|"), "open Inventory|type ana ruiz", "steps");
        eq(issue.actual, "**no rows**", "actual");
        eq((await run("jira-issues.mjs", ["fetch", "INVB-7", "--out=j2.json"], { env: { JIRA_BASE_URL: "", JIRA_EMAIL: "", JIRA_API_TOKEN: "" } })).status, 2, "fetched without credentials");
        const cfg = join(target, "jira-cred.json");
        writeFileSync(cfg, JSON.stringify({ baseUrl: jira.url, email: "qa@example.invalid", apiToken: TOKEN }));
        chmodSync(cfg, 0o644);
        const loose = await run("jira-issues.mjs", ["fetch", "INVB-7", "--out=j3.json"], { env: { JIRA_CONFIG: cfg } });
        assert(loose.status === 2 && /mode 0600/.test(loose.out), loose.out);
      } finally { jira.close(); }
    }],
  ],
  "PB-43": [
    ["the shipped Context-Prompt command block matches the command set", async () => {
      const r = spawnSync(process.execPath, [join(repoRoot, "scripts/context-sync.mjs"), "diff"], { encoding: "utf8" });
      eq(r.status, 0, r.stdout);
    }],
    ["a missing, stale or drifted command is named, and sync rewrites only the generated block", async () => {
      const { commands, block, diff } = await import(pathToFileURL(join(repoRoot, "scripts/context-sync.mjs")).href);
      const cmds = commands(join(repoRoot, "harness/opencode/command"));
      const text = `# Primer\nHand-written gotcha.\n\n${block(cmds)}\n`;
      eq(diff(text, cmds).length, 0, "clean block reported drift");
      const drifted = text.replace(/\| `\/verify` \|[^\n]*\n/, "").replace("| `/fix` | ", "| `/fix` | old words ").replace("<!-- commands:end -->", "| `/deploy` | gone |\n<!-- commands:end -->");
      const p = diff(drifted, cmds).join("; ");
      assert(/missing command \/verify/.test(p) && /drifted description for \/fix/.test(p) && /stale command \/deploy/.test(p), p);
      assert(diff(`${text}\nSee \`scripts/no-such-file.mjs\`.\n`, cmds).some((x) => /no-such-file/.test(x)), "dead path not named");
      assert(diff(text, [...cmds, { name: "/new", description: "" }]).some((x) => /\/new has no description/.test(x)), "missing description not named");
    }],
  ],
  "PB-44": [
    ["restore diagnostics name the feed, the credential state and the next action, never the secret", async () => {
      const root = join(target, "dotnet");
      mkdirSync(join(root, "src/App"), { recursive: true });
      writeFileSync(join(root, "nuget.config"), `<configuration><packageSources><add key="corp" value="https://pkgs.example.invalid/corp/nuget/v3/index.json" /></packageSources><packageSourceCredentials><corp><add key="Username" value="build" /><add key="ClearTextPassword" value="%CORP_FEED_PAT%" /></corp></packageSourceCredentials></configuration>`);
      writeFileSync(join(root, "src/App/App.csproj"), "<Project><ItemGroup><Reference Include=\"Corp.Lib\"><HintPath>..\\..\\libs\\Corp.Lib.dll</HintPath></Reference></ItemGroup></Project>");
      writeFileSync(join(root, "restore.log"), "error NU1301: Unable to load the service index for source https://pkgs.example.invalid/corp/nuget/v3/index.json.\n  Response status code does not indicate success: 401 (Unauthorized).\n");
      const unset = await run("dotnet-restore-diagnostics.mjs", ["dotnet/restore.log", "--root=dotnet"], { env: { CORP_FEED_PAT: "" } });
      assert(unset.status === 1 && /reference CORP_FEED_PAT NOT set/.test(unset.out) && /set the environment reference CORP_FEED_PAT/.test(unset.out) && /HintPath fallback absent/.test(unset.out), unset.out);
      const set = await run("dotnet-restore-diagnostics.mjs", ["dotnet/restore.log", "--root=dotnet"], { env: { CORP_FEED_PAT: TOKEN } });
      assert(/CORP_FEED_PAT set/.test(set.out) && /expired or lacks feed access/.test(set.out) && !set.out.includes(TOKEN), set.out);
      writeFileSync(join(root, "ok.log"), "Restored /src/App/App.csproj (in 1.2 sec).\n");
      eq((await run("dotnet-restore-diagnostics.mjs", ["dotnet/ok.log", "--root=dotnet"])).status, 0, "clean log flagged");
    }],
    ["the desktop bridge client is absent (exit 3, never BLOCKED) without WINAPP_BRIDGE and drives a bridge that answers", async () => {
      const a = await run("windows-app-bridge-client.mjs", ["health"], { env: { WINAPP_BRIDGE: "" } });
      assert(a.status === 3 && /absent/.test(a.out) && !/^BLOCKED/m.test(a.out), a.out);
      const seen = [];
      const bridge = await listen((req, res) => {
        seen.push(`${req.method} ${req.url}`);
        if (req.url === "/screenshot") { res.writeHead(200, { "content-type": "image/png" }); res.end(Buffer.from([137, 80, 78, 71])); return; }
        res.writeHead(200); res.end(req.url.startsWith("/text") ? "3 rows" : "ok");
      });
      try {
        const env = { WINAPP_BRIDGE: bridge.url };
        eq((await run("windows-app-bridge-client.mjs", ["click", "--selector=#Save"], { env })).status, 0, "click");
        assert(/3 rows/.test((await run("windows-app-bridge-client.mjs", ["text", "--selector=#Count"], { env })).out), "text");
        const s = await run("windows-app-bridge-client.mjs", ["screenshot", "--run-id=desk-1", "--name=after save.png"], { env });
        assert(s.status === 0 && existsSync(join(target, "verification/runs/desk-1/after_save.png")), s.out);
        assert(seen.includes("POST /click") && seen.includes("GET /text?selector=%23Count"), seen.join(", "));
      } finally { bridge.close(); }
    }],
  ],
};

if (!cases[id]) { console.log(`${id} fail: no cases in tests/runtime/run.mjs`); process.exit(1); }
await runCases(id, cases[id]);
