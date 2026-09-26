#!/usr/bin/env node
/**
 * checklist-deploy.mjs — keep `## Deployment Steps` in one shape.
 *
 *   node .playbook/scripts/checklist-deploy.mjs add <checklist> --automated --title="<action>" --command="<one command>"
 *   node .playbook/scripts/checklist-deploy.mjs add <checklist> --manual --title="<one-line action>"
 *   node .playbook/scripts/checklist-deploy.mjs none <checklist>
 *   node .playbook/scripts/checklist-deploy.mjs validate <checklist>
 *
 * The section always has `### Automated` and `### Manual` (or `_None
 * required._`). An Automated row carries exactly one command in inline code; a
 * Manual row is one line. A command carrying a credential — a password or
 * token flag, a `user:pass@` URL, a key=value secret — is refused: secrets
 * reach commands only through the allowed channels.
 */
import { Checklist, cleanText } from "./checklist-edit-lib.mjs";
import { deploymentRows } from "./deployment-step-runner.mjs";

const CREDENTIAL = /(\s-P\s+\S|--password[= ]\S|--token[= ]\S|\/\/[^/\s:@]+:[^/\s@]+@|\b(password|pwd|secret|token|api[_-]?key)=\S)/i;

export function validateDeploy(c) {
  const text = c.lines.join("\n");
  const range = c.sectionRange("Deployment Steps");
  if (!range) return ['missing "## Deployment Steps"'];
  const body = c.lines.slice(range.start + 1, range.end).join("\n");
  if (/_None required\._/.test(body)) return /^- \[/m.test(body) ? ["_None required._ beside rows"] : [];
  const problems = [];
  if (!/^### Automated/m.test(body) || !/^### Manual/m.test(body)) problems.push("both ### Automated and ### Manual are required (or _None required._)");
  const rows = deploymentRows(text);
  for (const r of rows.automated ?? []) {
    if (!r.command) problems.push(`Automated "${r.title}" names no command`);
    else if (CREDENTIAL.test(r.command)) problems.push(`Automated "${r.title}" carries a credential in its command`);
  }
  for (const r of rows.manual ?? []) if (/`[^`]+`/.test(r.title) && CREDENTIAL.test(r.title)) problems.push(`Manual "${r.title}" carries a credential`);
  return problems;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [verb, path, ...rest] = process.argv.slice(2);
  const opt = (n) => rest.find((a) => a.startsWith(`--${n}=`))?.split("=").slice(1).join("=");
  if (!["add", "none", "validate"].includes(verb) || !path) { console.log("usage: add|none|validate <checklist> [...]"); process.exit(2); }
  try {
    const c = new Checklist(path);
    if (verb === "validate") {
      const p = validateDeploy(c);
      for (const x of p) console.log(`deploy: ${x}`);
      console.log(`checklist-deploy: ${p.length} problem(s)`);
      process.exit(p.length ? 1 : 0);
    }
    let range = c.sectionRange("Deployment Steps");
    if (!range) {
      const at = c.sectionRange("Verifier Run Log")?.start ?? c.lines.length;
      c.lines.splice(at, 0, "## Deployment Steps", "", "### Automated", "", "### Manual", "", "");
      range = c.sectionRange("Deployment Steps");
    }
    const body = c.lines.slice(range.start + 1, range.end);
    if (verb === "none") {
      if (body.some((l) => /^- \[/.test(l))) throw new Error("the section has rows; remove them explicitly first");
      c.lines.splice(range.start + 1, range.end - range.start - 1, "", "_None required._", "");
    } else {
      const automated = rest.includes("--automated");
      if (automated === rest.includes("--manual")) throw new Error("say --automated or --manual");
      const title = cleanText(opt("title"), "title");
      if (!title) throw new Error("--title is required");
      let fresh = body.filter((l) => !/_None required\._/.test(l));
      if (!fresh.some((l) => /^### Automated/.test(l))) fresh = ["", "### Automated", "", "### Manual", ""];
      const sub = fresh.findIndex((l) => new RegExp(`^### ${automated ? "Automated" : "Manual"}`).test(l));
      let at = sub + 1;
      while (at < fresh.length && !/^###\s/.test(fresh[at])) at += 1;
      while (at > sub + 1 && !fresh[at - 1].trim()) at -= 1;
      const rows = [`- [ ] ${title}`];
      if (automated) {
        const command = opt("command");
        if (!command) throw new Error("--command is required for an Automated row");
        if (CREDENTIAL.test(command)) throw new Error("the command carries a credential; use the profile's secret channels");
        rows.push(`  - \`${command.replaceAll("`", "")}\``);
      }
      fresh.splice(at, 0, ...(fresh[at - 1]?.startsWith("###") ? ["", ...rows] : rows));
      c.lines.splice(range.start + 1, range.end - range.start - 1, ...fresh);
    }
    c.save({ sync: false });
    console.log(`checklist-deploy: ${verb} done`);
  } catch (error) { console.log(`refused: ${error.message}`); process.exit(1); }
}
