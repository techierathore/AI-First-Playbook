#!/usr/bin/env node
/**
 * playbook-miss.mjs — the miss-stream CLI (open / close / amend / next-id / list).
 *
 * A miss is the durable record of a defect the process let escape: what was
 * missed, which practice missed it, who found it, and (via the joiner) what
 * fixing it cost. Field and lifecycle contract:
 * docs/Telemetry-Guide.md §7.
 *
 * Records append to verification/telemetry/misses.ndjson — committed, never
 * rotated, unlike the transient events.ndjson beside it.
 *
 * Fire-and-forget by contract: every path prints its outcome (or its
 * refusal) and exits 0 — a telemetry failure must lose a record, never
 * break a phase. Write commands are opt-in under the same
 * PLAYBOOK_TELEMETRY=1 flag as the plugin; read commands (list, next-id)
 * always work. An explicit /log-miss invocation may prefix the flag for its
 * own call — running the command IS the opt-in (docs/Decisions.md 2026-08-28).
 *
 * Usage:
 *   PLAYBOOK_TELEMETRY=1 node scripts/playbook-miss.mjs open \
 *       --miss-class=partial-implementation --artifact=src --severity=major \
 *       [--why-missed=insufficient-verify-method] [--item-id=REQ-014] \
 *       [--feature=CostReport] [--origin-phase=build] [--origin-agent=builder] \
 *       [--origin-run-id=<session id>] [--found-by=verifier] \
 *       [--found-phase=verify] [--found-phase-gate=FAIL] [--actor=a3f1] \
 *       [--if-new]            # collapse check: same item_id + miss_class still live → write nothing
 *       [--fixed [--verdict-after=pass] [--fix-run-id=<session id>] [--fix-phase=fix]]
 *
 *   PLAYBOOK_TELEMETRY=1 node scripts/playbook-miss.mjs close \
 *       --miss-id=MISS-20260828-03 [--verdict-after=pass] \
 *       [--fix-run-id=<session id>] [--fix-phase=fix] [--actor=a3f1]
 *       # fix_run_id is omitted when the repairing run cannot be identified —
 *       # never point at a plausible-looking phase window to make a number
 *       # appear (§0.6). Tokens/cost are filled by the joiner
 *       # (playbook-telemetry.mjs --misses), never typed here.
 *
 *   PLAYBOOK_TELEMETRY=1 node scripts/playbook-miss.mjs amend \
 *       <MISS-id> <field> <value>   # completes a null closed-vocabulary field
 *                                  # (why_missed); refuses to overwrite —
 *                                  # append-only survives
 *
 *   node scripts/playbook-miss.mjs next-id # next MISS-YYYYMMDD-NN candidate
 *   node scripts/playbook-miss.mjs list [--item-id=REQ-014] [--open]
 *
 * Any command: --misses=<path> --events=<path> overrides.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  defaultMissesPath, defaultEventsPath, readMisses, readEvents, appendRecord,
  phaseWindows, foldAmends, fixesByMiss, isBacklog, findLiveDuplicate,
  nextMissId, buildMissRecord, buildFixRecord, buildAmendRecord,
} from "./miss-lib.mjs";

const args = process.argv.slice(2);
// CLI flags are kebab-case (--miss-class=…); record fields are snake_case —
// normalize once, here, so the builders in miss-lib.mjs see field names.
const flags = Object.fromEntries(args.filter((a) => a.startsWith("--")).map((a) => {
  const i = a.indexOf("=");
  const key = (i === -1 ? a.slice(2) : a.slice(2, i)).replaceAll("-", "_");
  return [key, i === -1 ? true : a.slice(i + 1)];
}));
const positional = args.filter((a) => !a.startsWith("--"));
const command = positional.shift();

const root = process.cwd();
// Preserve absolute overrides and anchor relative ones at the invocation root.
const inputPath = (value, fallback) => typeof value === "string" && value.length ? resolve(root, value) : fallback;
const missesPath = inputPath(flags.misses, defaultMissesPath(root));
const eventsPath = inputPath(flags.events, defaultEventsPath(root));

function projectType() {
  const hiddenProfile = resolve(root, ".playbook/environment-profile.yml");
  const profile = existsSync(hiddenProfile) ? hiddenProfile : resolve(root, "playbook/environment-profile.yml");
  if (!existsSync(profile)) return null;
  const m = readFileSync(profile, "utf8").match(/^project_type:\s*["']?([^"'\n#]+)/m);
  const value = m ? m[1].trim() : null;
  return value && !/^<replace(?:[:>])/i.test(value) ? value : null;
}

try {
  if (!command || command === "help" || flags.help) {
    console.log(`playbook-miss.mjs — the miss-stream CLI (open / close / amend / next-id / list)
stream: ${missesPath} (committed, append-only, never rotated)
fields and lifecycle: docs/Telemetry-Guide.md §7
writes are opt-in: PLAYBOOK_TELEMETRY=1`);
  } else if (command === "next-id") {
    console.log(nextMissId(readMisses(missesPath).records));
  } else if (command === "list") {
    const { folded } = foldAmends(readMisses(missesPath).records);
    const fixes = fixesByMiss(folded);
    const subset = folded.filter((r) =>
      r.kind === "miss"
      && (flags.item_id ? r.item_id === flags.item_id : true)
      && (flags.open ? isBacklog(fixes, r.miss_id) : true));
    for (const r of subset) console.log(JSON.stringify(r));
    if (!subset.length) console.error(`no ${flags.open ? "open " : ""}miss records${flags.item_id ? ` for ${flags.item_id}` : ""} in ${missesPath}`);
  } else if (command === "open" || command === "close" || command === "amend") {
    if (process.env.PLAYBOOK_TELEMETRY !== "1") {
      console.error("miss recording is opt-in: set PLAYBOOK_TELEMETRY=1 (nothing was written)");
    } else if (command === "open") {
      const records = readMisses(missesPath).records;
      if (flags.if_new) {
        const dup = findLiveDuplicate(foldAmends(records).folded, flags.item_id ?? null, flags.miss_class);
        if (dup) {
          console.log(`collapsed: ${dup.miss_id} is still live for ${flags.item_id} / ${flags.miss_class} — nothing written`);
        } else {
          openMiss(records);
        }
      } else {
        openMiss(records);
      }
    } else if (command === "close") {
      closeMiss(readMisses(missesPath).records);
    } else {
      amendMiss(readMisses(missesPath).records);
    }
  } else {
    console.error("unknown command — open | close | amend | next-id | list");
  }
} catch (error) {
  // fire-and-forget: a telemetry failure must never break a phase
  console.error(`playbook-miss: ${error?.message ?? error}`);
}
process.exit(0);

function openMiss(records) {
  const windows = phaseWindows(readEvents(eventsPath));
  const built = buildMissRecord(flags, { records, windows, project_type: projectType() });
  if (built.errors) {
    console.error(`refused (nothing written):\n  - ${built.errors.join("\n  - ")}`);
    return;
  }
  appendRecord(missesPath, built.record);
  console.log(`opened ${built.record.miss_id} (${built.record.found_by}) -> ${missesPath}`);
  if (built.record.origin_run_id != null && built.record.origin_model == null) {
    console.error(`  note: origin_run_id resolved to no window in ${eventsPath} — origin_model forced null, confidence '${built.record.origin_confidence}' (a stale events.ndjson is a normal, expected condition)`);
  }
  if (flags.fixed) {
    // The miss was reported after it was already repaired: close it in the
    // same breath. fix_run_id is passed through only when genuinely
    // identifiable; otherwise omitted and the record costs "none" (§0.6).
    const fix = buildFixRecord({
      miss_id: built.record.miss_id,
      verdict_after: flags.verdict_after,
      fix_run_id: flags.fix_run_id,
      fix_phase: flags.fix_phase,
      actor: flags.actor,
    }, { records: [...records, built.record] });
    if (fix.errors) console.error(`refused --fixed close (miss stays open):\n  - ${fix.errors.join("\n  - ")}`);
    else {
      appendRecord(missesPath, fix.record);
      console.log(`closed ${fix.record.miss_id} (--fixed, verdict ${fix.record.verdict_after}, cost_attribution ${fix.record.cost_attribution ?? "derived at read time"})`);
    }
  }
}

function closeMiss(records) {
  const fix = buildFixRecord({
    miss_id: flags.miss_id,
    item_id: flags.item_id,
    verdict_after: flags.verdict_after,
    fix_run_id: flags.fix_run_id,
    fix_phase: flags.fix_phase,
    actor: flags.actor,
  }, { records });
  if (fix.errors) {
    console.error(`refused (nothing written):\n  - ${fix.errors.join("\n  - ")}`);
    return;
  }
  appendRecord(missesPath, fix.record);
  console.log(`closed ${fix.record.miss_id} attempt ${fix.record.fix_attempt} (verdict ${fix.record.verdict_after}${fix.record.reopened ? ", reopened" : ""}) -> ${missesPath}`);
  if (fix.record.fix_run_id == null) {
    console.error("  note: no fix_run_id — cost_attribution none (never approximate a phase window, §0.6)");
  }
}

function amendMiss(records) {
  const [missId, field, value] = positional;
  const amend = buildAmendRecord(missId, field, value, { records });
  if (amend.errors) {
    console.error(`refused (nothing written):\n  - ${amend.errors.join("\n  - ")}`);
    return;
  }
  appendRecord(missesPath, amend.record);
  console.log(`amended ${amend.record.miss_id}.${amend.record.field} = '${amend.record.value}' -> ${missesPath}`);
}
