import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const errors = [];
const read = (p) => readFileSync(p.startsWith(root) ? p : join(root, p), "utf8");
const files = (dir, suffix) => readdirSync(join(root, dir)).filter((f) => f.endsWith(suffix));
const verdicts = ["PASS", "FAIL", "PASS (code-audit)", "FAIL (code-audit)", "DATA-GAP", "BLOCKED"];

if (!statSync(join(root, "opencode.json"))) errors.push("missing opencode.json");
for (const required of ["docs/Installation.md", "docs/Getting-Started.md", "docs/Greenfield-Case-Study.md", "docs/Brownfield-Case-Study.md", "scripts/install.mjs"]) {
  if (!statSync(join(root, required), { throwIfNoEntry: false })) errors.push(`missing ${required}`);
}
for (const name of readdirSync(join(root, "docs"))) {
  if (/^[A-Z0-9_-]+\.md$/.test(name)) errors.push(`docs/${name}: use Pascal/kebab-case, not all caps`);
}
const config = JSON.parse(read("opencode.json"));
if (!Array.isArray(config.plugin) || !config.plugin.includes("./.opencode/plugin/spec-guardrails.ts")) errors.push("plugin is not explicitly registered");
for (const f of files("harness/opencode/command", ".md")) {
  const text = read(join("harness/opencode/command", f));
  if (!text.startsWith("---")) errors.push(`${f}: missing frontmatter`);
}
const specs = new Set(files("templates/commands", ".md").filter((f) => f !== "README.md"));
const runnable = new Set(files("harness/opencode/command", ".md"));
for (const f of specs) if (!runnable.has(f)) errors.push(`missing runnable command for ${f}`);
for (const f of runnable) if (!specs.has(f)) errors.push(`missing command spec for ${f}`);
for (const f of readdirSync(join(root, "diagrams"))) {
  if (f.endsWith(".mmd") && !/^([\s\S]*)$/.test(read(join("diagrams", f)))) errors.push(`${f}: unreadable Mermaid source`);
}
for (const f of ["README.md", "phases/06-verification-results-gate.md", "templates/checklist-item-template.md"]) {
  const text = read(f);
  for (const v of verdicts) if (f.includes("checklist") && v === "DATA-GAP" && !text.includes(v)) errors.push(`${f}: missing ${v}`);
}
for (const f of readdirSync(join(root, "harness/opencode/command"))) {
  if (!f.endsWith(".md")) continue;
  const text = read(join("harness/opencode/command", f));
  if (/(curl\s+[^\n]*-u\s+|\s-P\s+(<[^>]+>|\S+))/.test(text)) errors.push(`${f}: credential-bearing command example`);
}
if (errors.length) { console.error(errors.map((e) => `ERROR ${e}`).join("\n")); process.exit(1); }
console.log("playbook validation passed");
