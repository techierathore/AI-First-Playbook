#!/usr/bin/env node
/**
 * checklist-archive.mjs — move mature PASS items out of a large checklist and
 * back again, without losing their record.
 *
 *   node .playbook/scripts/checklist-archive.mjs candidates <checklist> [--min-age-days=14]
 *   node .playbook/scripts/checklist-archive.mjs archive    <checklist> [--min-age-days=14] [--ids=ID,ID] [--force]
 *   node .playbook/scripts/checklist-archive.mjs restore    <checklist> <ID>
 *
 * A candidate is `pass` with a latest Verifier Result of PASS, older than the
 * minimum age, not named in any active item's `Depends on`, not marked
 * `[PATTERN]`, and not named in Deployment Steps. `archive` moves each full
 * item block (metadata, fields, every annotation) verbatim to
 * `<checklist>-Verified-History.md` and leaves one row per ID under
 * `## Verified History` in the checklist. Below 2,000 lines or 30 eligible
 * items archiving loses context for little space, so it only reports unless
 * --force. Archive and restore each append an entry to `## Verifier Run Log`. `restore` moves the block back,
 * resets it to `planned` and appends a Restored line: it must be verified again.
 * IDs never change.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { Checklist, findItem, utcNow } from "./checklist-edit-lib.mjs";
import { parseChecklist } from "./checklist-lib.mjs";
import { latestVerdict } from "./checklist-plan.mjs";
import { deploymentRows } from "./deployment-step-runner.mjs";

const DAY = 86400000;
export const historyPath = (path) => path.replace(/\.md$/, "-Verified-History.md");

export function candidates(text, { minAgeDays = 14, now = Date.now() } = {}) {
  const { items } = parseChecklist(text);
  const active = items.filter((i) => !["pass", "out-of-scope", "abandoned"].includes(i.metadata?.value?.status));
  const depended = new Set(active.flatMap((i) => (i.fields["Depends on"] ?? "").split(/[,\s]+/).filter(Boolean)));
  const deploy = JSON.stringify(deploymentRows(text));
  const out = [];
  for (const i of items) {
    const m = i.metadata?.value;
    if (!m?.id || m.status !== "pass" || latestVerdict(i) !== "PASS") continue;
    const reasons = [];
    if (now - Date.parse(m.updated_at ?? 0) < minAgeDays * DAY) reasons.push(`younger than ${minAgeDays} days`);
    if (depended.has(m.id)) reasons.push("an active item depends on it");
    if (/\[PATTERN\]/.test(i.title)) reasons.push("marked [PATTERN]");
    if (deploy.includes(m.id)) reasons.push("named in Deployment Steps");
    out.push({ id: m.id, title: i.title, eligible: !reasons.length, reasons });
  }
  return out;
}

function cutBlock(c, id) {
  const f = findItem(c.lines, id);
  if (!f) throw new Error(`no item ${id}`);
  const block = c.lines.slice(f.metaIndex, f.end + 1);
  c.lines.splice(f.metaIndex, f.end - f.metaIndex + 1);
  if (!c.lines[f.metaIndex - 1]?.trim() && !c.lines[f.metaIndex]?.trim()) c.lines.splice(f.metaIndex, 1);
  return { block, meta: f.meta };
}

function historySection(c) {
  let r = c.sectionRange("Verified History");
  if (!r) { c.lines.push("", "## Verified History", "", "| ID | Title | Archived |", "|---|---|---|"); r = c.sectionRange("Verified History"); }
  return r;
}

function runLog(c, entry) {
  const r = c.sectionRange("Verifier Run Log");
  if (r) c.lines.splice(r.end, 0, "", ...entry); else c.lines.push("", "## Verifier Run Log", "", ...entry);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [verb, path, ...rest] = process.argv.slice(2);
  const opt = (n) => rest.find((a) => a.startsWith(`--${n}=`))?.split("=").slice(1).join("=");
  if (!["candidates", "archive", "restore"].includes(verb) || !path) { console.log("usage: candidates|archive|restore <checklist> ..."); process.exit(2); }
  try {
    const minAgeDays = Number(opt("min-age-days") ?? 14);
    const text = readFileSync(path, "utf8");
    if (verb === "candidates") {
      for (const x of candidates(text, { minAgeDays })) console.log(`${x.eligible ? "eligible" : "kept    "} ${x.id} ${x.title}${x.reasons.length ? ` — ${x.reasons.join("; ")}` : ""}`);
      process.exit(0);
    }
    const c = new Checklist(path);
    const hist = historyPath(path);
    if (verb === "archive") {
      const wanted = opt("ids")?.split(",");
      const list = candidates(text, { minAgeDays }).filter((x) => x.eligible && (!wanted || wanted.includes(x.id)));
      if (wanted) for (const w of wanted) if (!list.some((x) => x.id === w)) throw new Error(`${w} is not eligible for archive`);
      if (!list.length) { console.log("archive: nothing eligible"); process.exit(0); }
      if (!rest.includes("--force") && (c.lines.length < 2000 || list.length < 30)) { console.log(`archive: still manageable (${c.lines.length} lines, ${list.length} eligible; archiving starts at 2000 lines and 30 eligible); nothing written, --force to archive anyway`); process.exit(0); }
      const beforeLines = c.lines.length;
      let history = existsSync(hist) ? readFileSync(hist, "utf8") : `# ${basename(path, ".md")} — Verified History\n\nFull item records moved by checklist-archive.mjs; restore with \`checklist-archive.mjs restore\`.\n`;
      for (const x of list) {
        const { block } = cutBlock(c, x.id);
        history += `\n${block.join("\n")}\n`;
        const r = historySection(c);
        c.lines.splice(r.end, 0, `| ${x.id} | ${x.title.replace(/\|/g, "/")} | ${utcNow()} |`);
      }
      writeFileSync(hist, history);
      runLog(c, [`### Archive on ${utcNow()}`, `- Archived: ${list.map((x) => x.id).join(", ")}`, `- Kept active: ${candidates(text, { minAgeDays }).filter((x) => !x.eligible).map((x) => `${x.id} (${x.reasons.join("; ")})`).join(", ") || "none"}`, `- Lines: ${beforeLines} before`]);
      c.save();
      console.log(`archive: ${list.length} item(s) moved to ${basename(hist)}: ${list.map((x) => x.id).join(", ")}`);
    } else {
      const id = rest.find((a) => !a.startsWith("--"));
      if (!existsSync(hist)) throw new Error(`no history file ${basename(hist)}`);
      const h = new Checklist(hist);
      const { block, meta } = cutBlock(h, id);
      const restored = [`<!-- metadata: ${JSON.stringify({ ...meta, status: "planned", updated_at: utcNow() })} -->`, ...block.slice(1), `  - Restored (${utcNow().slice(0, 10)}): back from Verified History; verify again.`];
      const items = parseChecklist(c.lines.join("\n")).items.filter((i) => i.metadata?.value?.id);
      const at = items.length ? findItem(c.lines, items.at(-1).metadata.value.id).end + 1 : (c.sectionRange("Infrastructure Requirements")?.start ?? c.lines.length);
      c.lines.splice(at, 0, "", ...restored);
      const r = c.sectionRange("Verified History");
      if (r) { const row = c.lines.findIndex((l, i) => i > r.start && i < r.end && l.startsWith(`| ${id} |`)); if (row !== -1) c.lines.splice(row, 1); }
      runLog(c, [`### Restore on ${utcNow()}`, `- Restored: ${id} (planned; verify again)`]);
      c.save();
      h.save({ sync: false });
      console.log(`restore: ${id} is back as planned; run /verify before it counts as PASS`);
    }
  } catch (error) { console.log(`refused: ${error.message}`); process.exit(1); }
}
