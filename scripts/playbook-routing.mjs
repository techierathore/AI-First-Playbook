#!/usr/bin/env node
/**
 * playbook-routing.mjs — the ONE command for model routing.
 *
 *   node scripts/playbook-routing.mjs status                       what is routing doing right now?
 *   node scripts/playbook-routing.mjs on                           turn routing ON  (stamps model: into OpenCode files)
 *   node scripts/playbook-routing.mjs off                          turn routing OFF (removes every stamp)
 *   node scripts/playbook-routing.mjs set-tier <command|agent> <tier>
 *                                                                  e.g. set-tier verify economy · set-tier builder inherit
 *   node scripts/playbook-routing.mjs set-model <tier> <model>
 *                                                                  e.g. set-model standard opencode/hy3-free
 *   node scripts/playbook-routing.mjs set-escalation <command> <attempts> <tier>
 *                                                                  e.g. set-escalation fix 2 frontier
 *                                                                  ADVISORY: applied by whoever launches the command;
 *                                                                  nothing switches a running phase's model
 *   node scripts/playbook-routing.mjs bind                         re-apply after editing model-tiers.yml by hand
 *
 * Every verb edits playbook/model-tiers.yml IN PLACE (comments preserved) and
 * then re-applies it through scripts/apply-model-tiers.mjs, so the map and the
 * OpenCode frontmatter never disagrees. Idempotent — run it as often as you like.
 * Ported from TechieFlow's tf-routing.sh; design: docs/Decisions.md 2026-08-21.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { applyTiers, loadConfig, tiersPath, printResolved } from "./apply-model-tiers.mjs";
import { routingEnabled, UNROUTED_TIERS } from "./tier-lib.mjs";

const TIERS = ["frontier", "standard", "economy"];
const [verb = "status", ...rest] = process.argv.slice(2);

const usage = (msg) => {
  if (msg) console.error(msg);
  console.error(readFileSync(new URL(import.meta.url), "utf8").split("\n").slice(2, 21).map((l) => l.replace(/^ \*\s?/, "")).join("\n"));
  process.exit(2);
};

const read = () => readFileSync(tiersPath, "utf8");
const write = (text) => writeFileSync(tiersPath, text.endsWith("\n") ? text : text + "\n");
const isTop = (line) => /^\S/.test(line) && !line.trimStart().startsWith("#");
const topKey = (line) => line.split(":")[0].trim();

/** Re-apply the map to the OpenCode files and report; exit 1 on problems. */
function bind() {
  const r = applyTiers({ log: console.log });
  if (r.problems.length) { console.error(r.problems.map((p) => `ERROR ${p}`).join("\n")); process.exit(1); }
  console.log(`bind: routing ${r.enabled ? "ON" : "OFF"} — ${r.stamped} stamped, ${r.stripped} stripped, ${r.files.length} mapped file(s) in sync`);
}

function setEnabled(value) {
  const text = read();
  const out = /^enabled:.*$/m.test(text)
    ? text.replace(/^enabled:.*$/m, `enabled: ${value}`)
    : text.replace(/^version:.*$/m, (m) => `${m}\n\nenabled: ${value}`);
  write(out);
}

/** Keep a trailing `# comment` in its original column when the value length changes. */
function realign(oldValue, newValue, tail) {
  if (!tail) return "";
  const ws = tail.match(/^\s*/)[0].length;
  return " ".repeat(Math.max(1, ws + oldValue.length - newValue.length)) + tail.trimStart();
}

/** Replace `  <name>: <value>` inside one top-level section, keeping the trailing comment. */
function setSectionEntry(text, section, name, value) {
  const lines = text.split("\n");
  let sect = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isTop(line)) { sect = topKey(line); continue; }
    if (sect !== section) continue;
    const m = line.match(new RegExp(`^(  ${name}:\\s*)(\\S+)(\\s*#.*)?$`));
    if (m) { lines[i] = `${m[1]}${value}${realign(m[2], value, m[3])}`; return { text: lines.join("\n"), found: true }; }
  }
  return { text, found: false };
}

switch (verb) {
  case "on":
  case "off": {
    setEnabled(verb === "on");
    console.log(`routing: ${verb === "on" ? "ENABLED" : "DISABLED"} in playbook/model-tiers.yml`);
    bind();
    if (verb === "on") console.log("Check with: node scripts/playbook-routing.mjs status");
    break;
  }

  case "bind":
    bind();
    break;

  case "set-tier": {
    const [name, tier] = rest;
    if (!name || !tier) usage("usage: playbook-routing.mjs set-tier <command|agent> <frontier|standard|economy|inherit>");
    if (![...TIERS, ...UNROUTED_TIERS].includes(tier)) usage(`unknown tier '${tier}' — use ${TIERS.join("|")}|inherit`);
    const config = loadConfig();
    const section = name in (config.commands ?? {}) ? "commands" : name in (config.agents ?? {}) ? "agents" : null;
    if (!section) usage(`'${name}' is not a command or agent in the tier map (commands: ${Object.keys(config.commands ?? {}).join(", ")}; agents: ${Object.keys(config.agents ?? {}).join(", ")})`);
    const { text, found } = setSectionEntry(read(), section, name, tier);
    if (!found) usage(`could not locate '${name}' under ${section}: in ${tiersPath}`);
    write(text);
    console.log(`set ${section}.${name} -> ${tier}`);
    bind();
    break;
  }

  case "set-model": {
    const [tier, model, ...extra] = rest;
    if (!tier || !model || extra.length) usage("usage: playbook-routing.mjs set-model <frontier|standard|economy> <provider/model-id>");
    if (!TIERS.includes(tier)) usage(`unknown tier '${tier}' — use ${TIERS.join("|")}`);
    if (!/^[^\s/]+\/[^\s/]+$/.test(model)) usage("OpenCode model must be a provider/model-id (list with: opencode models)");
    const lines = read().split("\n");
    let sect = null, inTier = false, done = false;
    for (let i = 0; i < lines.length && !done; i++) {
      const line = lines[i];
      if (isTop(line)) { sect = topKey(line); inTier = false; continue; }
      if (sect !== "tiers") continue;
      const t = line.match(/^  ([\w-]+):\s*$/);
      if (t) { inTier = t[1] === tier; continue; }
      const m = inTier && line.match(/^(    opencode:\s*)(\S+)(\s*#.*)?$/);
      if (m) { lines[i] = `${m[1]}"${model}"${realign(m[2], `"${model}"`, m[3])}`; done = true; }
    }
    if (!done) usage(`tiers.${tier}.opencode not found in ${tiersPath}`);
    write(lines.join("\n"));
    console.log(`set tiers.${tier}.opencode -> ${model}`);
    bind();
    break;
  }

  case "set-escalation": {
    const [command, attempts, tier] = rest;
    if (!command || !attempts || !tier) usage("usage: playbook-routing.mjs set-escalation <command> <attempts> <frontier|standard|economy>");
    if (!/^[1-9]\d*$/.test(attempts)) usage("attempts must be a positive integer (e.g. 2)");
    if (!TIERS.includes(tier)) usage(`unknown tier '${tier}' — use ${TIERS.join("|")}`);
    const config = loadConfig();
    if (!(command in (config.commands ?? {}))) usage(`'${command}' is not a command in the tier map`);
    const lines = read().split("\n");
    const block = [`  ${command}:`, `    after_attempts: ${attempts}`, `    tier: ${tier}`];
    let sect = null, escAt = null, start = null, end = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (isTop(line)) {
        if (sect === "escalation" && start !== null && end === null) end = i;
        sect = topKey(line);
        if (sect === "escalation") escAt = i;
        continue;
      }
      if (sect !== "escalation") continue;
      if (/^  [\w-]+:\s*$/.test(line) && line.trim().slice(0, -1) === command) start = i;
      else if (start !== null && end === null && /^  [\w-]+:\s*$/.test(line)) end = i;
    }
    let what;
    if (start !== null) {
      if (end === null) { end = lines.length; while (end > start + 1 && !lines[end - 1].trim()) end--; }
      lines.splice(start, end - start, ...block);
      what = "updated";
    } else if (escAt !== null) {
      lines.splice(escAt + 1, 0, ...block);
      what = "added";
    } else {
      while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
      lines.push("", "# Advisory escalation, applied by whoever launches the command.", "escalation:", ...block);
      what = "added (new escalation: section)";
    }
    write(lines.join("\n"));
    console.log(`escalation.${command} ${what} -> after_attempts: ${attempts}, tier: ${tier} (advisory — applied at launch, never mid-run)`);
    // No bind: escalation is advisory and produces no frontmatter stamp.
    break;
  }

  case "status": {
    const config = loadConfig();
    const enabled = routingEnabled(config);
    const r = applyTiers({ check: true, config });
    const stamped = r.files.filter((f) => f.current).length;
    console.log(`Routing: ${enabled ? "ON" : "OFF"}   (model: stamps on disk: ${stamped}/${r.files.length} mapped files${r.problems.length ? `; ${r.problems.length} out of sync` : ""})`);
    if (r.problems.length) console.log("  !! map and stamps disagree — run: node scripts/playbook-routing.mjs bind");
    console.log("\nTier models:");
    for (const t of TIERS) {
      const m = config.tiers?.[t] ?? {};
      console.log(`  ${t.padEnd(9)} opencode: ${m.opencode ?? "-"}`);
    }
    console.log("\nCommands by tier:");
    for (const t of [...TIERS, "inherit"]) {
      const names = Object.entries(config.commands ?? {}).filter(([, v]) => v === t || (t === "inherit" && UNROUTED_TIERS.has(v))).map(([k]) => k).sort();
      if (names.length) console.log(`  ${t.padEnd(9)} ${names.join(", ")}`);
    }
    const agents = Object.entries(config.agents ?? {}).sort().map(([k, v]) => `${k}=${v}`);
    if (agents.length) console.log(`Agents:    ${agents.join(", ")}`);
    console.log("\nEscalation (ADVISORY — applied by whoever launches the command; nothing switches a model mid-run):");
    const esc = Object.entries(config.escalation ?? {}).filter(([, v]) => typeof v === "object");
    if (esc.length) {
      for (const [cmd, e] of esc) console.log(`  ${cmd.padEnd(18)} after ${e.after_attempts ?? "?"} attempt(s) -> launch the next /${cmd} on ${e.tier ?? "?"} (base tier: ${config.commands?.[cmd] ?? "?"})`);
      console.log("  attempt count: the checklist Run Log (### Run on …) — also the `attempt` field in telemetry records");
      console.log("  change:        node scripts/playbook-routing.mjs set-escalation <command> <attempts> <tier>");
    } else {
      console.log("  none declared — add one: node scripts/playbook-routing.mjs set-escalation fix 2 frontier");
    }
    console.log();
    if (enabled) {
      console.log("Routed phases run on their tier model when entered through their command (/verify, /implement, …);");
      console.log("your default chat is never routed. OpenCode: the command's model STAYS for the session afterwards —");
      console.log("re-pick your model or start a new session if you keep chatting.");
    } else {
      console.log("Every phase runs on the session model. Turn on with:  node scripts/playbook-routing.mjs on");
    }
    break;
  }

  case "print":
    if (rest.length) usage("usage: playbook-routing.mjs print");
    console.log(JSON.stringify(printResolved(loadConfig()), null, 2));
    break;

  case "-h": case "--help": case "help":
    usage();
    break;

  default:
    usage(`unknown verb '${verb}'`);
}
