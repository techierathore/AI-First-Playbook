#!/usr/bin/env node
/**
 * checklist-miss-coordinator.mjs — record a miss and link it to its checklist
 * item in one serial step, for the orchestrator and the analyst.
 *
 *   node .playbook/scripts/checklist-miss-coordinator.mjs open  <checklist> <item-id> <miss open flags...>
 *   node .playbook/scripts/checklist-miss-coordinator.mjs close <checklist> <item-id> --verdict-after=deferred|pass --fix-phase=<phase> [--fix-run-id=<exact id>]
 *
 * `open` runs `playbook-miss.mjs open --if-new --item-id=<item-id> ...` with
 * PLAYBOOK_TELEMETRY=1 and appends the opened or collapsed MISS ID once to the
 * item's append-only metadata `misses`. `close` appends a miss-fix for every
 * still-live miss linked to the item; it never removes an ID. A refused
 * telemetry call is printed and never changes the checklist or the phase
 * outcome (fire-and-forget); a checklist write failure exits 1.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultMissesPath, fixesByMiss, foldAmends, isLive, readMisses } from "./miss-lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const [verb, checklist, itemId, ...rest] = process.argv.slice(2);
const usage = () => { console.log("usage: open|close <checklist> <item-id> [flags]"); process.exit(2); };
if (!["open", "close"].includes(verb) || !checklist || !itemId) usage();

const miss = (args) => spawnSync(process.execPath, [join(here, "playbook-miss.mjs"), ...args], {
  cwd: process.cwd(), encoding: "utf8", env: { ...process.env, PLAYBOOK_TELEMETRY: "1" },
});

function metadataLine(lines) {
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(/^(\s*)<!--\s*metadata:\s*(\{.*\})\s*-->\s*$/);
    if (!m) continue;
    try {
      const meta = JSON.parse(m[2]);
      if (meta.id === itemId) return { index: i, indent: m[1], meta };
    } catch {}
  }
  return null;
}

const text = readFileSync(checklist, "utf8");
const lines = text.split("\n");
const found = metadataLine(lines);
if (!found) { console.log(`coordinator: no metadata line for ${itemId} in ${checklist}`); process.exit(1); }

if (verb === "open") {
  const r = miss(["open", "--if-new", `--item-id=${itemId}`, ...rest.filter((a) => !a.startsWith("--item-id=") && a !== "--if-new")]);
  const out = `${r.stdout}${r.stderr}`;
  const id = out.match(/(?:opened|collapsed:)\s+(MISS-\d{8}-\d+)/)?.[1];
  if (!id) { console.log(`coordinator: telemetry refused, checklist unchanged — ${out.trim().split("\n").slice(-2).join(" ")}`); process.exit(0); }
  const misses = Array.isArray(found.meta.misses) ? found.meta.misses : [];
  if (!misses.includes(id)) {
    found.meta.misses = [...misses, id];
    lines[found.index] = `${found.indent}<!-- metadata: ${JSON.stringify(found.meta)} -->`;
    writeFileSync(checklist, lines.join("\n"));
  }
  console.log(`coordinator: ${itemId} linked to ${id}`);
  process.exit(0);
}

const records = foldAmends(readMisses(defaultMissesPath(process.cwd())).records).folded;
const fixes = fixesByMiss(records);
const live = (found.meta.misses ?? []).filter((id) => records.some((r) => r.kind === "miss" && r.miss_id === id) && isLive(fixes, id));
for (const id of live) {
  const r = miss(["close", `--miss-id=${id}`, ...rest.filter((a) => /^--(verdict-after|fix-phase|fix-run-id|actor)=/.test(a))]);
  console.log(`coordinator: ${id} ${(r.stdout || r.stderr).trim().split("\n").at(-1)}`);
}
if (!live.length) console.log(`coordinator: ${itemId} has no live linked miss`);
process.exit(0);
