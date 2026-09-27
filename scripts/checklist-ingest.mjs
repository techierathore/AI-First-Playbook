#!/usr/bin/env node
/**
 * checklist-ingest.mjs — fold bugs and stories into the existing checklist.
 *
 *   node .playbook/scripts/checklist-ingest.mjs bug   <checklist> <Feature-Issues.md>
 *   node .playbook/scripts/checklist-ingest.mjs story <checklist> <story.md> --name="<story>"
 *   node .playbook/scripts/checklist-ingest.mjs validate <checklist> [<Feature-Issues.md>]
 *
 * `bug` adds, under `## Analysis`, one `### Issue: <title> (source: <key or file>)`
 * block per issue not already there, with `Root cause:` and `Affected items:`
 * left as [ANALYZE] for the Analyst; `story` adds a `### Story:` block with
 * Summary, Impact and Items. Nothing else is invented: fix or story items are
 * written with checklist-amend.mjs. `validate` fails while any block still
 * says [ANALYZE], names an item that does not exist, or (given the Issues
 * file) an issue has no block; the checklist must also lint clean.
 */
import { readFileSync, realpathSync } from "node:fs";
import { basename } from "node:path";
import { Checklist, today } from "./checklist-edit-lib.mjs";
import { lintChecklist } from "./checklist-lint.mjs";
import { parseIssues } from "./issues-file.mjs";
import { fileURLToPath } from "node:url";

const ID = /\b[A-Z][A-Z0-9]*-\d{3,}\b/g;

function analysis(c) {
  let r = c.sectionRange("Analysis");
  if (!r) {
    const at = c.sectionRange("Infrastructure Requirements")?.start ?? c.lines.length;
    c.lines.splice(at, 0, "## Analysis", "", "");
    r = c.sectionRange("Analysis");
  }
  return r;
}

export const issueSource = (i, file) => i.fields.Source ?? `${basename(file)} #${i.n}`;

export function blocks(text) {
  const out = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const h = lines[i].match(/^###\s+(Issue|Story):\s*(.*?)\s*(?:\((?:added [^,]*, )?source:\s*([^)]+)\))?\s*$/);
    if (!h) continue;
    const body = [];
    for (let j = i + 1; j < lines.length && !/^#{1,3}\s/.test(lines[j]); j += 1) body.push(lines[j]);
    const field = (n) => body.find((l) => l.startsWith(`- ${n}:`))?.slice(n.length + 3).trim() ?? null;
    out.push({ kind: h[1], title: h[2], source: h[3] ?? null, line: i + 1, cause: field("Root cause"), affected: field("Affected items"), summary: field("Summary"), impact: field("Impact"), items: field("Items") });
  }
  return out;
}

export function validateIngest(text, issuesText = null, issuesFile = "") {
  const problems = [];
  const ids = new Set([...text.matchAll(/"id":"([^"]+)"/g)].map((m) => m[1]));
  for (const b of blocks(text)) {
    const at = `${b.kind} "${b.title}" (line ${b.line})`;
    const refs = b.kind === "Issue" ? [b.cause, b.affected] : [b.summary, b.impact, b.items];
    if (refs.some((v) => !v || /\[ANALYZE\]/.test(v))) problems.push(`${at} still has [ANALYZE] fields`);
    const named = (b.kind === "Issue" ? b.affected : b.items)?.match(ID) ?? [];
    if (!named.length && !refs.some((v) => /\[ANALYZE\]/.test(v ?? ""))) problems.push(`${at} names no checklist item`);
    for (const n of named) if (!ids.has(n)) problems.push(`${at} names ${n}, which is not in the checklist`);
  }
  if (issuesText) {
    const have = new Set(blocks(text).filter((b) => b.kind === "Issue").map((b) => b.source));
    for (const i of parseIssues(issuesText)) if (!have.has(issueSource(i, issuesFile))) problems.push(`Issue ${i.n} "${i.title}" has no Analysis block`);
  }
  const lint = lintChecklist(text);
  for (const p of lint.problems) problems.push(`lint: ${p.where} ${p.message}`);
  return problems;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [verb, path, source, ...rest] = process.argv.slice(2);
  const opt = (n) => [source, ...rest].find((a) => a?.startsWith(`--${n}=`))?.split("=").slice(1).join("=");
  if (!["bug", "story", "validate"].includes(verb) || !path) { console.log("usage: bug|story|validate <checklist> <source> ..."); process.exit(2); }
  const c = new Checklist(path);
  if (verb === "validate") {
    const p = validateIngest(c.lines.join("\n"), source && !source.startsWith("--") ? readFileSync(source, "utf8") : null, source ?? "");
    for (const x of p) console.log(`ingest: ${x}`);
    console.log(`checklist-ingest: ${p.length} problem(s)`);
    process.exit(p.length ? 1 : 0);
  }
  const existing = blocks(c.lines.join("\n"));
  const add = [];
  if (verb === "bug") {
    for (const i of parseIssues(readFileSync(source, "utf8"))) {
      const src = issueSource(i, source);
      if (existing.some((b) => b.kind === "Issue" && b.source === src)) continue;
      add.push("", `### Issue: ${i.title} (source: ${src})`, "- Root cause: [ANALYZE]", "- Affected items: [ANALYZE]");
    }
  } else {
    const name = opt("name") ?? basename(source, ".md");
    if (!existing.some((b) => b.kind === "Story" && b.title === name)) add.push("", `### Story: ${name} (added ${today()}, source: ${basename(source)})`, "- Summary: [ANALYZE]", "- Impact: [ANALYZE]", "- Items: [ANALYZE]");
  }
  if (!add.length) { console.log("checklist-ingest: nothing new; every entry already has a block"); process.exit(0); }
  const r = analysis(c);
  let at = r.end;
  while (at > r.start + 1 && !c.lines[at - 1].trim()) at -= 1;
  c.lines.splice(at, 0, ...add);
  c.save({ sync: false });
  console.log(`checklist-ingest: ${add.filter((l) => l.startsWith("###")).length} block(s) added under ## Analysis; fill each [ANALYZE] and add items with checklist-amend.mjs`);
}
