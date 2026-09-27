#!/usr/bin/env node
/**
 * render-docs.mjs — render human Markdown documents to standalone HTML with
 * the shared shell (.opencode/templates/doc-shell.html). Agent documents
 * (checklists, Issues files, AGENTS.md, requirement lists) are never rendered.
 *
 *   node .playbook/scripts/render-docs.mjs <file.md|folder> ... [--overwrite] [--include-agent-docs]
 *
 * The Markdown is HTML-escaped into the shell's hidden source block, so a
 * document containing `</textarea>` or `<script>` cannot break or inject into
 * the page. An existing .html is kept unless --overwrite is given. Every
 * written page is read back and checked for its title and its full source.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isAgentDocument } from "./doc-lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));
export function shellPath(root = process.cwd()) {
  for (const p of [join(root, ".opencode/templates/doc-shell.html"), join(here, "../harness/opencode/templates/doc-shell.html")]) if (existsSync(p)) return p;
  throw new Error("doc-shell.html not found");
}
const escapeHtml = (s) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const unescapeHtml = (s) => s.replaceAll("&quot;", '"').replaceAll("&gt;", ">").replaceAll("&lt;", "<").replaceAll("&amp;", "&");

export function renderOne(mdPath, shell) {
  const md = readFileSync(mdPath, "utf8");
  const title = md.match(/^#\s+(.+)$/m)?.[1].trim() ?? basename(mdPath, ".md");
  const html = shell.replace("{{TITLE}}", () => escapeHtml(title)).replace("{{MARKDOWN}}", () => escapeHtml(md));
  const source = html.match(/<textarea id="src" hidden>([\s\S]*?)<\/textarea>/)?.[1];
  if (source == null || unescapeHtml(source) !== md) throw new Error(`${mdPath}: rendered page does not carry the full source`);
  if (!html.includes(`<title>${escapeHtml(title)}</title>`)) throw new Error(`${mdPath}: rendered page lost its title`);
  return html;
}

function collect(paths) {
  const out = [];
  for (const p of paths) {
    if (statSync(p).isDirectory()) for (const f of readdirSync(p).sort()) { if (f.endsWith(".md")) out.push(join(p, f)); }
    else out.push(p);
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const inputs = args.filter((a) => !a.startsWith("--"));
  if (!inputs.length) { console.log("usage: render-docs.mjs <file.md|folder> ... [--overwrite] [--include-agent-docs]"); process.exit(2); }
  const shell = readFileSync(shellPath(), "utf8");
  let rendered = 0, failed = 0;
  for (const md of collect(inputs)) {
    const out = md.replace(/\.md$/, ".html");
    if (isAgentDocument(md) && !args.includes("--include-agent-docs")) { console.log(`skip ${md} — agent document, never rendered`); continue; }
    if (existsSync(out) && !args.includes("--overwrite")) { console.log(`skip ${md} — ${basename(out)} exists (use --overwrite)`); continue; }
    try { writeFileSync(out, renderOne(md, shell)); rendered += 1; console.log(`rendered ${out}`); }
    catch (error) { failed += 1; console.log(`failed ${md}: ${error.message}`); }
  }
  console.log(`render-docs: ${rendered} rendered, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
