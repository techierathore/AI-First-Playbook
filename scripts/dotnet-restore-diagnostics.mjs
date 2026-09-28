#!/usr/bin/env node
/**
 * dotnet-restore-diagnostics.mjs — optional adapter for .NET projects: read a
 * failed `dotnet restore` log and say what is actually wrong, before anyone
 * writes BLOCKED.
 *
 *   node .playbook/scripts/dotnet-restore-diagnostics.mjs <restore.log> [--root=<repo>]
 *
 * For each feed that answered 401 or 403 it reports whether a nuget.config
 * under the root declares that source, whether packageSourceCredentials exist
 * for it, whether the password is a %VAR% reference and whether that variable
 * is set (its value is never read out), and whether HintPath DLL fallbacks in
 * the .csproj files exist so `dotnet build --no-restore` can be tried. It prints
 * one next action per feed and never prints a credential.
 */
import { existsSync, readFileSync, readdirSync, statSync, realpathSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function walk(dir, pred, out = [], depth = 0) {
  if (depth > 6) return out;
  for (const e of readdirSync(dir)) {
    if (["node_modules", "bin", "obj", ".git"].includes(e)) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, pred, out, depth + 1);
    else if (pred(e)) out.push(p);
  }
  return out;
}

export function diagnose(logText, root, env = process.env) {
  const feeds = [...new Set([...logText.matchAll(/(https?:\/\/[^\s'"]+?)(?:[.'"]?\s|$)[^\n]*?\b(401|403)\b|\b(401|403)\b[^\n]*?(https?:\/\/[^\s'"]+)/g)].map((m) => (m[1] ?? m[4]).replace(/[.,;)]+$/, "")))];
  const configs = walk(root, (e) => e.toLowerCase() === "nuget.config").map((p) => ({ path: p, text: readFileSync(p, "utf8") }));
  const hints = walk(root, (e) => e.endsWith(".csproj")).flatMap((p) => [...readFileSync(p, "utf8").matchAll(/<HintPath>([^<]+)<\/HintPath>/g)].map((m) => ({ csproj: p, dll: resolve(dirname(p), m[1].replaceAll("\\", "/")) })));
  const fallbacks = hints.length ? hints.every((h) => existsSync(h.dll)) : false;
  return feeds.map((feed) => {
    const out = { feed, configs: [], credentials: false, reference: null, referenceSet: null, fallbacks, next: "" };
    for (const c of configs) {
      const source = [...c.text.matchAll(/<add\s+key="([^"]+)"\s+value="([^"]+)"/g)].find((m) => feed.startsWith(m[2].replace(/\/index\.json$/, "").replace(/\/$/, "")) || m[2].startsWith(feed));
      if (!source) continue;
      out.configs.push(relative(root, c.path));
      const creds = c.text.match(new RegExp(`<packageSourceCredentials>[\\s\\S]*?<${source[1].replace(/[^A-Za-z0-9_.-]/g, "_")}>([\\s\\S]*?)</`, "i")) ?? c.text.match(new RegExp(`<${source[1]}>([\\s\\S]*?)</${source[1]}>`));
      if (creds) {
        out.credentials = true;
        const pw = creds[1].match(/key="ClearTextPassword"\s+value="%([A-Z0-9_]+)%"/i) ?? creds[1].match(/key="Password"\s+value="%([A-Z0-9_]+)%"/i);
        if (pw) { out.reference = pw[1]; out.referenceSet = Boolean(env[pw[1]]); }
      }
    }
    if (!out.configs.length) out.next = "no nuget.config declares this feed; ask the feed owner how the team restores it";
    else if (!out.credentials) out.next = `add packageSourceCredentials for this feed through the secret manager; ${out.fallbacks ? "meanwhile try dotnet build --no-restore (HintPath DLLs exist)" : "no HintPath fallback exists"}`;
    else if (out.reference && !out.referenceSet) out.next = `set the environment reference ${out.reference} from the secret manager, then retry restore`;
    else out.next = `credentials are declared${out.reference ? ` and ${out.reference} is set` : ""}: retry dotnet restore --configfile ${out.configs[0]}; if it still fails, the token is expired or lacks feed access — ask its owner`;
    return out;
  });
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const log = process.argv[2];
  const root = resolve(process.argv.find((a) => a.startsWith("--root="))?.slice(7) ?? process.cwd());
  if (!log) { console.log("usage: dotnet-restore-diagnostics.mjs <restore.log> [--root=<repo>]"); process.exit(2); }
  const r = diagnose(readFileSync(log, "utf8"), root);
  if (!r.length) { console.log("restore-diagnostics: no 401/403 feed failure in the log; the failure is not a feed credential problem"); process.exit(0); }
  for (const f of r) console.log(`feed ${f.feed}: config ${f.configs.join(", ") || "none"}; credentials ${f.credentials ? "declared" : "absent"}${f.reference ? `; reference ${f.reference} ${f.referenceSet ? "set" : "NOT set"}` : ""}; HintPath fallback ${f.fallbacks ? "present" : "absent"}\n  next: ${f.next}`);
  process.exit(1);
}
