#!/usr/bin/env node
/**
 * checklist-amend.mjs — make one known, exact change to a checklist.
 *
 *   node .playbook/scripts/checklist-amend.mjs add    <checklist> --item=<item.json> [--prefix=INV]
 *   node .playbook/scripts/checklist-amend.mjs update <checklist> <ID> --field="<Field>" --value="<text>"
 *   node .playbook/scripts/checklist-amend.mjs remove <checklist> <ID> --reason="<why>"
 *
 * `add` appends an item in the template shape with the next stable ID (IDs are
 * never reused or renumbered). `update` replaces one field's value. `remove`
 * marks the item `out-of-scope` with the reason; an item already verified PASS
 * is protected and cannot be updated or removed (restore it or add a new one).
 * The result must pass checklist-lint.mjs, or nothing is written; the report
 * names the change and the next command.
 */
import { readFileSync } from "node:fs";
import { Checklist, cleanText, utcNow } from "./checklist-edit-lib.mjs";
import { FIELD_ORDER, parseChecklist } from "./checklist-lib.mjs";
import { lintChecklist } from "./checklist-lint.mjs";
import { syncStatusTable } from "./checklist-create.mjs";

export function nextId(text, prefix) {
  const ids = [...text.matchAll(/"id":"([A-Z][A-Z0-9]*)-(\d+)"/g)];
  const p = prefix ?? ids[0]?.[1] ?? "REQ";
  const max = Math.max(0, ...ids.filter((m) => m[1] === p).map((m) => Number(m[2])));
  return `${p}-${String(max + 1).padStart(3, "0")}`;
}

function amend(verb, path, rest, now = new Date()) {
  const opt = (n) => rest.find((a) => a.startsWith(`--${n}=`))?.split("=").slice(1).join("=");
  const c = new Checklist(path);
  const before = c.lines.join("\n");
  let change, next;
  if (verb === "add") {
    const item = JSON.parse(readFileSync(opt("item"), "utf8"));
    const id = nextId(before, opt("prefix"));
    const meta = { schema: 1, id, owner: item.owner ?? "unassigned", priority: item.priority ?? "P2", risk: item.risk ?? "medium", status: "planned", created_at: utcNow(now), updated_at: utcNow(now), evidence: [], misses: [], ...(item.trace ? { trace: item.trace } : {}) };
    const block = [`<!-- metadata: ${JSON.stringify(meta)} -->`, `- [ ] ${cleanText(item.title, "title")}`];
    for (const f of FIELD_ORDER) if (item[f]) block.push(`  - ${f}: ${cleanText(item[f], f)}`);
    const items = parseChecklist(before).items;
    const lastLine = items.length ? c.item(items.at(-1).metadata.value.id).end + 1 : (c.sectionRange("Infrastructure Requirements")?.start ?? c.lines.length);
    c.lines.splice(lastLine, 0, "", ...block);
    change = `added ${id} "${item.title}"`;
    next = `/implement ${path}`;
  } else {
    const id = rest.find((a) => !a.startsWith("--"));
    const found = c.item(id);
    const lastResult = [...c.lines.slice(found.itemIndex, found.end + 1)].reverse().find((l) => /\*\*Verifier Result\*\*/.test(l));
    if (found.meta.status === "pass" || /Verifier Result\*\*[^:]*:\s*PASS/.test(lastResult ?? "")) throw new Error(`${id} is verified PASS and protected; restore or add a new item instead`);
    if (verb === "update") {
      const field = opt("field");
      const value = cleanText(opt("value"), "value");
      if (!FIELD_ORDER.includes(field)) throw new Error(`--field must be one of ${FIELD_ORDER.join(", ")}`);
      const at = c.lines.slice(found.itemIndex, found.end + 1).findIndex((l) => l.startsWith(`  - ${field}:`));
      if (at === -1) throw new Error(`${id} has no ${field} field; add it through the template shape`);
      let end = found.itemIndex + at + 1;
      while (end <= found.end && /^ {4,}\S/.test(c.lines[end])) end += 1;
      c.lines.splice(found.itemIndex + at, end - found.itemIndex - at, `  - ${field}: ${value}`);
      c.update(id, (m) => { m.updated_at = utcNow(now); });
      change = `updated ${id} ${field}`;
      next = found.meta.status === "planned" ? `/implement ${path}` : `/fix ${path}`;
    } else {
      const reason = cleanText(opt("reason"), "reason");
      if (!reason) throw new Error("--reason is required");
      c.append(id, `- Removed (${now.toISOString().slice(0, 10)}): ${reason}`);
      c.update(id, (m) => { m.status = "out-of-scope"; m.updated_at = utcNow(now); });
      change = `removed ${id} from scope`;
      next = "none";
    }
  }
  const lint = lintChecklist(syncStatusTable(c.lines.join("\n")));
  if (lint.problems.length) throw new Error(`the amended checklist fails lint: ${lint.problems.slice(0, 3).map((p) => `${p.where} ${p.message}`).join("; ")}`);
  c.save();
  return { change, next, unchanged: before === c.lines.join("\n") };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [verb, path, ...rest] = process.argv.slice(2);
  if (!["add", "update", "remove"].includes(verb) || !path) { console.log("usage: add|update|remove <checklist> ..."); process.exit(2); }
  try {
    const r = amend(verb, path, rest);
    console.log(`checklist-amend: ${r.change}; next: ${r.next}`);
  } catch (error) { console.log(`refused: ${error.message}; nothing written`); process.exit(1); }
}
