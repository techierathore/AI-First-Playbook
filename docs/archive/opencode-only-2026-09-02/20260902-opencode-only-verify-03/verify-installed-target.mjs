import fs from "node:fs";
import path from "node:path";

const root = path.resolve("verification/opencode-only/20260902-opencode-only-verify-03/installed-target");
const required = [
  ".opencode/command/verify.md",
  ".opencode/agent/verifier.md",
  ".opencode/plugin/spec-guardrails.ts",
  "opencode.json",
  "AGENTS.md",
  "playbook/environment-profile.yml",
  "scripts/playbook-miss.mjs",
  "docs/Repository-Structure.md",
  "phases/01-plan.md",
  "templates/checklist-item-template.md",
  "templates/checklist-metadata.yml",
  "templates/deployment-steps-template.md",
  "templates/handoffs/plan-approval.md",
  "templates/issues-file-template.md",
  ".playbook/installation.json",
];
const prohibited = [
  ["harness", ["claude", "code"].join("-")].join("/"),
  `.${["clau", "de"].join("")}`,
  ["CLAUDE", ".md"].join(""),
  [".mcp", ".json"].join(""),
  ["scripts/harness", "-install.mjs"].join(""),
  "harness",
];

function filesUnder(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const candidate = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(candidate) : entry.isFile() ? [candidate] : [];
  });
}

const files = filesUnder(root);
const missing = required.filter((item) => !fs.existsSync(path.join(root, item)));
const leaked = prohibited.filter((item) => fs.existsSync(path.join(root, item)));
console.log(`installed_files=${files.length}`);
console.log(`required_assets_present=${required.length - missing.length}/${required.length}`);
console.log(`prohibited_artifacts_present=${leaked.length}`);
if (missing.length) console.log(`missing=${missing.join(",")}`);
if (leaked.length) console.log(`leaked=${leaked.join(",")}`);
if (missing.length || leaked.length) process.exit(1);
console.log("installed_target_asset_assertions=PASS");
