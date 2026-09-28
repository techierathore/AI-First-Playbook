#!/usr/bin/env node
/**
 * checklist-infra.mjs — keep `## Infrastructure Requirements` in one shape.
 *
 *   node .playbook/scripts/checklist-infra.mjs add <checklist> --name="<resource>" --what="<what and where used>" --configured="<config key or env name>" --setup="<how to create it>"
 *   node .playbook/scripts/checklist-infra.mjs none <checklist>
 *   node .playbook/scripts/checklist-infra.mjs validate <checklist>
 *
 * Entries are `- **<Resource>**: <what>` with `Where configured:` and `Setup:`
 * lines; `none` writes `_None required._`. A duplicate resource, a
 * secret-like value or a leftover scaffold line is refused. `validate` exits
 * 1 when the section is missing, empty or malformed.
 */
import { Checklist, cleanText } from "./checklist-edit-lib.mjs";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SCAFFOLD = /^_To be completed by \/implement and \/fix\._$/;

export function validateInfra(c) {
  const range = c.sectionRange("Infrastructure Requirements");
  if (!range) return ['missing "## Infrastructure Requirements"'];
  const body = c.lines.slice(range.start + 1, range.end).filter((l) => l.trim());
  const problems = [];
  if (!body.length) problems.push("the section is empty; add entries or _None required._");
  if (body.some((l) => SCAFFOLD.test(l.trim()))) problems.push("the scaffold line is still there");
  const none = body.some((l) => l.trim() === "_None required._");
  const entries = body.filter((l) => /^- /.test(l));
  if (none && entries.length) problems.push("_None required._ beside entries");
  for (const [i, e] of entries.entries()) {
    if (!/^- \*\*[^*]+\*\*: \S/.test(e)) { problems.push(`entry "${e.slice(0, 40)}" is not "- **Resource**: what"`); continue; }
    const block = [];
    for (let j = c.lines.indexOf(e, range.start) + 1; j < range.end && /^\s+- /.test(c.lines[j]); j += 1) block.push(c.lines[j]);
    if (!block.some((l) => /Where configured:/.test(l)) || !block.some((l) => /Setup:/.test(l))) problems.push(`entry ${i + 1} lacks Where configured or Setup`);
  }
  return problems;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [verb, path, ...rest] = process.argv.slice(2);
  const opt = (n) => rest.find((a) => a.startsWith(`--${n}=`))?.split("=").slice(1).join("=");
  if (!["add", "none", "validate"].includes(verb) || !path) { console.log("usage: add|none|validate <checklist> [...]"); process.exit(2); }
  try {
    const c = new Checklist(path);
    let range = c.sectionRange("Infrastructure Requirements");
    if (!range && verb !== "validate") {
      const at = c.sectionRange("Deployment Steps")?.start ?? c.lines.length;
      c.lines.splice(at, 0, "## Infrastructure Requirements", "", "");
      range = c.sectionRange("Infrastructure Requirements");
    }
    if (verb === "validate") {
      const p = validateInfra(c);
      for (const x of p) console.log(`infra: ${x}`);
      console.log(`checklist-infra: ${p.length} problem(s)`);
      process.exit(p.length ? 1 : 0);
    }
    const body = c.lines.slice(range.start + 1, range.end);
    const keep = body.filter((l) => l.trim() && !SCAFFOLD.test(l.trim()) && l.trim() !== "_None required._");
    if (verb === "none") {
      if (keep.length) throw new Error("the section has entries; remove them explicitly first");
      c.lines.splice(range.start + 1, range.end - range.start - 1, "", "_None required._", "");
    } else {
      const [name, what, configured, setup] = ["name", "what", "configured", "setup"].map((k) => cleanText(opt(k), k));
      if (!name || !what || !configured || !setup) throw new Error("--name, --what, --configured and --setup are all required");
      if (keep.some((l) => l.startsWith(`- **${name}**:`))) throw new Error(`${name} is already listed`);
      c.lines.splice(range.start + 1, range.end - range.start - 1, "", ...keep, `- **${name}**: ${what}`, `  - Where configured: ${configured}`, `  - Setup: ${setup}`, "");
    }
    c.save({ sync: false });
    console.log(`checklist-infra: ${verb} done`);
  } catch (error) { console.log(`refused: ${error.message}`); process.exit(1); }
}
