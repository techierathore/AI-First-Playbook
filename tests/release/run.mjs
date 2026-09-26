// Release and CI validation (PB-18): both workflows run on the declared Node
// and npm versions, install the supported OpenCode, and run the four npm test
// scripts and the grader; CI keeps the grader output as an artefact.
//   node tests/release/run.mjs PB-18
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assert, repoRoot, requirementId, runCases } from "../lib.mjs";

const id = requirementId("PB-18");
const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
const read = (f) => readFileSync(join(repoRoot, ".github/workflows", f), "utf8");
const min = (range) => range.replace(/^>=\s*/, "").split(".").map(Number);
const atLeast = (v, m) => { for (let i = 0; i < 3; i += 1) { if ((v[i] ?? 0) !== m[i]) return (v[i] ?? 0) > m[i]; } return true; };
const GRADE = "node scripts/playbook-grade.mjs docs/Playbook-Requirements.md";
const TESTS = ["npm run validate", "npm run test:guardrails", "npm run test:misses", "npm run test:install"];

export function checkWorkflow(text, { needsArtifact = false } = {}) {
  const problems = [];
  const nodes = [...text.matchAll(/node-version:\s*([\d.]+)/g)].map((m) => m[1].split(".").map(Number));
  if (!nodes.length) problems.push("no pinned node-version");
  for (const v of nodes) if (!atLeast(v.length === 3 ? v : [...v, 0, 0].slice(0, 3), min(pkg.engines.node))) problems.push(`node-version ${v.join(".")} is below ${pkg.engines.node}`);
  const npms = [...text.matchAll(/npm install --global npm@([\d.]+)/g)].map((m) => m[1].split(".").map(Number));
  if (!npms.length) problems.push("npm is not set to a declared version");
  for (const v of npms) if (!atLeast(v, min(pkg.engines.npm))) problems.push(`npm ${v.join(".")} is below ${pkg.engines.npm}`);
  if (!/opencode-ai@\$\(node --print "require\('\.\/package\.json'\)\.opencode\.supported"\)/.test(text)) problems.push("the supported OpenCode version is not installed");
  for (const t of TESTS) if (!text.includes(t)) problems.push(`missing ${t}`);
  if (!text.includes(GRADE)) problems.push("the grader is not run");
  if (needsArtifact && !/actions\/upload-artifact@v\d+[\s\S]*path:\s*grader-output/.test(text)) problems.push("the grader output is not uploaded as an artefact");
  if (needsArtifact && !/on:\s*\[[^\]]*push/.test(text)) problems.push("the workflow does not run on every push");
  return problems;
}

await runCases(id, [
  ["CI runs on every push with the declared versions, the four npm tests, the grader and an artefact", () => {
    const p = checkWorkflow(read("validate.yml"), { needsArtifact: true });
    assert(!p.length, p.join("; "));
  }],
  ["release validation uses the declared versions and runs every graded check before publish", () => {
    const text = read("release.yml");
    const validate = text.slice(text.indexOf("  validate:"), text.indexOf("  publish:"));
    const p = checkWorkflow(validate);
    assert(!p.length, p.join("; "));
    assert(/publish:\s*\n\s*needs: validate/.test(text), "publish does not depend on validation");
    assert(!/npm version .*--no-git-tag-version[\s\S]*git (commit|tag|push)/.test(text), "release job writes git history");
  }],
  ["prepublishOnly repeats the four npm tests", () => {
    for (const t of TESTS) assert(pkg.scripts.prepublishOnly.includes(t), `prepublishOnly lacks ${t}`);
  }],
  ["broken workflows are caught: Node 20, npm 10, no grader, no artefact", () => {
    const good = read("validate.yml");
    const cases = [
      [good.replace("node-version: 22.14.0", "node-version: 20.11.0"), /below/],
      [good.replace("npm@11.5.1", "npm@10.9.0"), /npm 10.9.0 is below/],
      [good.replace(GRADE, "echo skipped"), /grader is not run/],
      [good.replace(/- name: Upload grader output[\s\S]*$/, ""), /not uploaded/],
    ];
    for (const [text, pattern] of cases) assert(checkWorkflow(text, { needsArtifact: true }).some((p) => pattern.test(p)), `not caught: ${pattern}`);
  }],
]);
