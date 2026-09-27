#!/usr/bin/env node
/**
 * reader-path.mjs — the reader path is README → Getting Started → How It Works
 * → the ten phases → the templates → one Operating Guide, and nothing that
 * belongs to another product sits on it.
 *
 *   node scripts/reader-path.mjs [--root=<repo>] [--json]
 *
 * Checks: every reader-path file exists; README lists the path in order,
 * Getting Started first; docs/ holds at its root only the reader documents
 * and the named reset control files, and everything else lives under
 * examples/, maintainer/, archive/ or runbooks/; Getting Started stays short;
 * no reader document links into docs/archive/ or to a TechieFlow or TfLens
 * document; those documents live only under docs/maintainer/cross-framework/;
 * every reader document's links resolve.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { lintFile } from "./reference-lint.mjs";

const repo = fileURLToPath(new URL("..", import.meta.url));
export const READER_DOCS = ["README.md", "docs/Getting-Started.md", "docs/Playbook-How-It-Works.md", "docs/Operating-Guide.md"];
export const CONTROL_FILES = ["Playbook-Reset-Plan.md", "Playbook-Requirements.md", "Reset-Progress.md", "Playbook-Document-Schemas.md"];
export const DOC_FOLDERS = ["examples", "maintainer", "archive", "runbooks"];
export const CROSS_FRAMEWORK = /(TechieFlow|TfLens)/;
export const GETTING_STARTED_MAX = 1500;

const mdIn = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".md")).sort() : []);
function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

export function readerPath(root = repo) {
  const problems16 = [];
  const problems17 = [];
  const phases = mdIn(join(root, "phases")).map((f) => `phases/${f}`);
  const templates = walk(join(root, "templates")).filter((p) => p.endsWith(".md")).map((p) => relative(root, p).replaceAll("\\", "/"));
  const reader = [...READER_DOCS, ...phases, ...templates];
  for (const f of READER_DOCS) if (!existsSync(join(root, f))) problems16.push(`missing reader document ${f}`);
  if (phases.length !== 10) problems16.push(`phases/ holds ${phases.length} phase pages, not 10`);
  const readme = existsSync(join(root, "README.md")) ? readFileSync(join(root, "README.md"), "utf8") : "";
  const order = ["docs/Getting-Started.md", "docs/Playbook-How-It-Works.md", "phases/", "templates/", "docs/Operating-Guide.md"];
  const positions = order.map((t) => readme.indexOf(`](${t}`));
  if (positions.some((p) => p < 0)) problems16.push(`README does not link ${order.filter((_, i) => positions[i] < 0).join(", ")}`);
  else if (positions.some((p, i) => i && p < positions[i - 1])) problems16.push(`README does not list the reader path in order: ${order.join(" → ")}`);
  const firstDocLink = readme.match(/\]\((docs\/[^)#]+)/)?.[1];
  if (firstDocLink !== "docs/Getting-Started.md") problems16.push(`README's first document link is ${firstDocLink}, not docs/Getting-Started.md`);
  for (const f of readdirSync(join(root, "docs"))) {
    const p = join(root, "docs", f);
    if (statSync(p).isDirectory()) { if (!DOC_FOLDERS.includes(f)) problems16.push(`docs/${f}/ is not one of ${DOC_FOLDERS.join(", ")}`); continue; }
    if (!f.endsWith(".md")) continue;
    if (!READER_DOCS.includes(`docs/${f}`) && !CONTROL_FILES.includes(f)) problems16.push(`docs/${f} is neither a reader document nor a control file; move it to ${DOC_FOLDERS.join("/, ")}/`);
  }
  const gs = join(root, "docs/Getting-Started.md");
  if (existsSync(gs)) {
    const words = (readFileSync(gs, "utf8").replace(/```[\s\S]*?```/g, " ").match(/\S+/g) ?? []).length;
    if (words > GETTING_STARTED_MAX) problems16.push(`Getting Started has ${words} words; keep it under ${GETTING_STARTED_MAX} and move detail to the Operating Guide`);
  }
  for (const f of reader.filter((x) => existsSync(join(root, x)))) {
    for (const p of lintFile(join(root, f), { root })) problems16.push(p);
    const text = readFileSync(join(root, f), "utf8");
    for (const m of text.matchAll(/\]\(([^)\s#]+)/g)) {
      const target = relative(root, resolve(join(root, f, ".."), m[1])).replaceAll("\\", "/");
      if (/^[a-z]+:/i.test(m[1])) continue;
      if (target === "docs/archive" || target.startsWith("docs/archive/")) problems16.push(`${f} links into the archive: ${m[1]}`);
      if (CROSS_FRAMEWORK.test(target.split("/").pop())) problems17.push(`${f} links a cross-framework document: ${m[1]}`);
    }
  }
  for (const p of walk(join(root, "docs"))) {
    const rel = relative(root, p).replaceAll("\\", "/");
    if (CROSS_FRAMEWORK.test(rel.split("/").pop()) && !rel.startsWith("docs/maintainer/cross-framework/") && !rel.startsWith("docs/archive/")) problems17.push(`${rel} belongs under docs/maintainer/cross-framework/`);
  }
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  for (const f of pkg.files) if (CROSS_FRAMEWORK.test(f) || f.startsWith("docs/maintainer") || f.startsWith("docs/archive")) problems17.push(`package.json ships ${f}`);
  return { reader: reader.length, problems16, problems17 };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = resolve(process.argv.find((a) => a.startsWith("--root="))?.slice(7) ?? repo);
  const r = readerPath(root);
  if (process.argv.includes("--json")) console.log(JSON.stringify(r, null, 2));
  else {
    for (const p of r.problems16) console.log(`reader path: ${p}`);
    for (const p of r.problems17) console.log(`cross-framework: ${p}`);
    console.log(`reader-path: ${r.reader} reader document(s); ${r.problems16.length + r.problems17.length} problem(s)`);
  }
  process.exit(r.problems16.length + r.problems17.length ? 1 : 0);
}
