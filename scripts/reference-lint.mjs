#!/usr/bin/env node
/**
 * reference-lint.mjs — every relative Markdown link, heading anchor and
 * backticked repository path in a document resolves.
 *
 *   node .playbook/scripts/reference-lint.mjs <file.md|folder> ... [--root=<repo>] [--paths]
 *
 * Links `[text](relative/path.md#anchor)` must point at an existing file and,
 * with an anchor, at an existing heading. With --paths, backticked tokens that
 * look like repository paths (`src/app.ts`, `docs/x.md`) must exist under the
 * root; checklist Location lines are always checked. External URLs are not
 * fetched. One line per broken reference; exit 1 on any.
 */
import { existsSync, readFileSync, readdirSync, statSync, realpathSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const slug = (heading) => heading.toLowerCase().trim().replace(/<[^>]+>/g, "").replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s/g, "-");

function anchors(file) {
  const out = new Set();
  let fence = false;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (/^\s*```/.test(line)) fence = !fence;
    const m = !fence && line.match(/^#{1,6}\s+(.*)$/);
    if (m) {
      let s = slug(m[1]);
      let n = 1;
      while (out.has(s)) s = `${slug(m[1])}-${n++}`;
      out.add(s);
    }
  }
  return out;
}

export function lintFile(file, { root = process.cwd(), paths = false } = {}) {
  const problems = [];
  const text = readFileSync(file, "utf8");
  const prose = text.replace(/```[\s\S]*?```/g, (m) => m.replace(/[^\n]/g, " "));
  prose.split("\n").forEach((line, i) => {
    for (const m of line.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      const target = m[1];
      if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("//")) continue;
      const [pathPart, anchor] = target.split("#");
      const dest = pathPart ? resolve(dirname(file), decodeURI(pathPart)) : file;
      if (!existsSync(dest)) { problems.push(`${relative(root, file)}:${i + 1}: broken link ${target}`); continue; }
      if (anchor && dest.endsWith(".md") && !anchors(dest).has(anchor.toLowerCase())) problems.push(`${relative(root, file)}:${i + 1}: missing anchor #${anchor} in ${relative(root, dest)}`);
    }
    const location = /^\s*- Location:/.test(line);
    if (paths || location) {
      for (const m of line.matchAll(/`([A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.*<>-]+)+\/?)`/g)) {
        const p = m[1];
        if (/[<>*]/.test(p) || /^(\.\.?\/)?(node_modules|verification\/runs)\//.test(p)) continue;
        if (!existsSync(join(root, p)) && !existsSync(resolve(dirname(file), p))) problems.push(`${relative(root, file)}:${i + 1}: path \`${p}\` does not exist`);
      }
    }
  });
  return problems;
}

function collect(paths) {
  const out = [];
  for (const p of paths) {
    if (statSync(p).isDirectory()) for (const f of readdirSync(p).sort()) { const q = join(p, f); if (statSync(q).isDirectory()) out.push(...collect([q])); else if (f.endsWith(".md")) out.push(q); }
    else out.push(p);
  }
  return out;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const root = resolve(args.find((a) => a.startsWith("--root="))?.slice(7) ?? process.cwd());
  const files = collect(args.filter((a) => !a.startsWith("--")));
  if (!files.length) { console.log("usage: reference-lint.mjs <file.md|folder> ... [--root=<repo>] [--paths]"); process.exit(2); }
  const problems = files.flatMap((f) => lintFile(f, { root, paths: args.includes("--paths") }));
  for (const p of problems) console.log(p);
  console.log(`reference-lint: ${files.length} file(s), ${problems.length} broken reference(s)`);
  process.exit(problems.length ? 1 : 0);
}
