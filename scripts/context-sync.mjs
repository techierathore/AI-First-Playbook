#!/usr/bin/env node
/**
 * context-sync.mjs — keep the cold-start primer (Context-Prompt.md) in step
 * with the commands that actually exist.
 *
 *   node scripts/context-sync.mjs diff   [--context=Context-Prompt.md] [--commands=harness/opencode/command]
 *   node scripts/context-sync.mjs report [...]
 *   node scripts/context-sync.mjs sync   [...]
 *
 * The primer carries a generated block between `<!-- commands:start -->` and
 * `<!-- commands:end -->`: one row per command with its `description:`.
 * `diff` lists commands present but not in the block, commands in the block
 * that no longer exist, and descriptions that drifted, plus backticked file
 * paths in the primer that do not exist; exit 1 on any. `report` prints the
 * same as a change summary. `sync` rewrites only the generated block; the
 * hand-written parts (principles, gotchas, history) are never touched.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));
const START = "<!-- commands:start -->";
const END = "<!-- commands:end -->";

export function commands(dir) {
  return readdirSync(dir).filter((f) => f.endsWith(".md")).sort().map((f) => {
    const text = readFileSync(join(dir, f), "utf8");
    const d = text.match(/^---\n[\s\S]*?^description:\s*>?\s*\n?\s*(.+?)\s*$/m)?.[1] ?? "";
    return { name: `/${f.replace(/\.md$/, "")}`, description: d.trim() };
  });
}

export function block(cmds) {
  return [START, "| Command | Purpose |", "|---|---|", ...cmds.map((c) => `| \`${c.name}\` | ${c.description.replace(/\|/g, "/")} |`), END].join("\n");
}

export function diff(contextText, cmds, root = repo) {
  const problems = [];
  const inner = contextText.includes(START) ? contextText.slice(contextText.indexOf(START), contextText.indexOf(END)) : "";
  if (!inner) problems.push("no generated command block; run context-sync.mjs sync");
  const listed = new Map([...inner.matchAll(/^\| `(\/[a-z-]+)` \| (.*) \|$/gm)].map((m) => [m[1], m[2]]));
  for (const c of cmds) {
    if (!c.description) problems.push(`command ${c.name} has no description: in its front matter`);
    if (!listed.has(c.name)) problems.push(`missing command ${c.name}`);
    else if (listed.get(c.name) !== c.description.replace(/\|/g, "/")) problems.push(`drifted description for ${c.name}`);
  }
  for (const n of listed.keys()) if (!cmds.some((c) => c.name === n)) problems.push(`stale command ${n} no longer exists`);
  for (const m of contextText.matchAll(/`((?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.-]+\.[a-z]+)`/g)) if (!existsSync(join(root, m[1]))) problems.push(`path ${m[1]} does not exist`);
  return problems;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [verb, ...rest] = process.argv.slice(2);
  const opt = (n, d) => rest.find((a) => a.startsWith(`--${n}=`))?.split("=").slice(1).join("=") ?? d;
  const contextPath = join(repo, opt("context", "Context-Prompt.md"));
  const cmds = commands(join(repo, opt("commands", "harness/opencode/command")));
  const text = readFileSync(contextPath, "utf8");
  if (verb === "sync") {
    const next = text.includes(START) ? `${text.slice(0, text.indexOf(START))}${block(cmds)}${text.slice(text.indexOf(END) + END.length)}` : `${text.trimEnd()}\n\n## Command library\n\n${block(cmds)}\n`;
    writeFileSync(contextPath, next);
    console.log(`context-sync: command block rewritten with ${cmds.length} command(s)`);
    process.exit(0);
  }
  if (!["diff", "report"].includes(verb)) { console.log("usage: diff|report|sync [--context=<file>] [--commands=<dir>]"); process.exit(2); }
  const p = diff(text, cmds);
  if (verb === "report") console.log(p.length ? `Context-Prompt.md needs: ${p.join("; ")}.` : "Context-Prompt.md matches the command set.");
  else for (const x of p) console.log(`drift: ${x}`);
  process.exit(p.length ? 1 : 0);
}
