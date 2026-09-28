#!/usr/bin/env node
/**
 * smoke-runner.mjs — the build self-test's probes, from a declared list rather
 * than improvised commands.
 *
 *   node .playbook/scripts/smoke-runner.mjs <smoke.json> --run-id=<id> [--items=ID,ID]
 *
 * smoke.json lists probes per item:
 *   [{ "item": "INV-002", "http": { "method": "POST", "url": "/imports", "body": "…",
 *        "status": 422, "contains": "DUPLICATE_TAG" } },
 *    { "item": "INV-003", "command": ["node", "verification/inventory/count-assets.mjs"],
 *        "exit": 0, "contains": "unchanged" }]
 * A relative URL is joined to the profile's application.api_url. A command runs
 * without a shell. Each probe's full output goes to verification/runs/<id>/;
 * the results file `smoke-results.json` there feeds self-test-result-writer.mjs.
 * Exit 1 when any probe fails; a profile placeholder is BLOCKED (exit 2).
 */
import { mkdirSync, readFileSync, writeFileSync, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { field, readProfile, runDirectory } from "./profile-lib.mjs";
import { fileURLToPath } from "node:url";

export async function runSmoke(probes, { root = process.cwd(), runId, only = null } = {}) {
  const dir = runDirectory(root, runId);
  mkdirSync(dir, { recursive: true });
  const { profile } = readProfile(root);
  const results = [];
  for (const [n, p] of probes.entries()) {
    if (only && !only.includes(p.item)) continue;
    const log = join(dir, `smoke-${n + 1}.log`);
    let ok = false, detail = "";
    if (p.http) {
      let url = p.http.url;
      if (!/^https?:/.test(url)) {
        const base = profile ? field(profile, "application.api_url") : { blocked: "no environment profile" };
        if (base.blocked) return { blocked: base.blocked };
        url = new URL(url, base.value.endsWith("/") ? base.value : `${base.value}/`).href;
      }
      try {
        const res = await fetch(url, { method: p.http.method ?? "GET", body: p.http.body, headers: p.http.headers, signal: AbortSignal.timeout(15000) });
        const body = await res.text();
        writeFileSync(log, `${p.http.method ?? "GET"} ${url}\n${res.status}\n${body}`);
        ok = res.status === (p.http.status ?? 200) && (!p.http.contains || body.includes(p.http.contains));
        detail = `${p.http.method ?? "GET"} ${p.http.url} -> ${res.status}${p.http.contains ? ok ? ` with "${p.http.contains}"` : ` (expected ${p.http.status ?? 200}${p.http.contains ? ` and "${p.http.contains}"` : ""})` : ""}`;
      } catch (error) {
        writeFileSync(log, `${url}\n${error.message}`);
        detail = `${p.http.url} unreachable: ${error.cause?.code ?? error.name}`;
      }
    } else if (Array.isArray(p.command)) {
      const r = spawnSync(p.command[0], p.command.slice(1), { cwd: root, encoding: "utf8" });
      writeFileSync(log, `$ ${p.command.join(" ")}\n${r.stdout ?? ""}${r.stderr ?? ""}`);
      ok = r.status === (p.exit ?? 0) && (!p.contains || `${r.stdout}${r.stderr}`.includes(p.contains));
      detail = `${p.command.join(" ")} -> exit ${r.status}${p.contains && !ok ? ` (expected "${p.contains}")` : ""}`;
    } else detail = "probe has neither http nor command";
    results.push({ item: p.item, outcome: ok ? "PASS" : "FAIL", evidence: `${detail}; log ${log.slice(root.length + 1)}` });
  }
  writeFileSync(join(dir, "smoke-results.json"), `${JSON.stringify({ run_id: runId, results }, null, 2)}\n`);
  return { results, file: join(dir, "smoke-results.json") };
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [spec, ...rest] = process.argv.slice(2);
  const runId = rest.find((a) => a.startsWith("--run-id="))?.slice(9);
  const only = rest.find((a) => a.startsWith("--items="))?.slice(8).split(",");
  if (!spec || !runId) { console.log("usage: smoke-runner.mjs <smoke.json> --run-id=<id> [--items=ID,ID]"); process.exit(2); }
  const r = await runSmoke(JSON.parse(readFileSync(spec, "utf8")), { runId, only });
  if (r.blocked) { console.log(`BLOCKED — ${r.blocked}`); process.exit(2); }
  for (const x of r.results) console.log(`${x.outcome} ${x.item} — ${x.evidence}`);
  console.log(`smoke: ${r.results.filter((x) => x.outcome === "PASS").length} of ${r.results.length} probe(s) passed; results ${r.file.slice(process.cwd().length + 1)}`);
  process.exit(r.results.every((x) => x.outcome === "PASS") ? 0 : 1);
}
