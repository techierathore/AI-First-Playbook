#!/usr/bin/env node
/**
 * windows-app-bridge-client.mjs — drive an optional Windows desktop GUI bridge
 * for desktop items. The bridge is not shipped; this is its client contract.
 *
 *   node .playbook/scripts/windows-app-bridge-client.mjs health
 *   node .playbook/scripts/windows-app-bridge-client.mjs launch --exe=<path>
 *   node .playbook/scripts/windows-app-bridge-client.mjs click --selector=<selector>
 *   node .playbook/scripts/windows-app-bridge-client.mjs type --selector=<selector> --text=<text>
 *   node .playbook/scripts/windows-app-bridge-client.mjs text --selector=<selector>
 *   node .playbook/scripts/windows-app-bridge-client.mjs screenshot --run-id=<id> [--name=<file.png>]
 *   node .playbook/scripts/windows-app-bridge-client.mjs stop
 *
 * The bridge address comes from the WINAPP_BRIDGE environment reference, never
 * a guessed default; with none set, or `/health` not answering 200, every
 * command prints `absent` and exits 3 — the desktop adapter then uses the
 * headless runner, and absence is never a BLOCKED reason. Screenshots go to
 * verification/runs/<id>/.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runDirectory } from "./profile-lib.mjs";

async function call(base, method, path, body) {
  const res = await fetch(`${base.replace(/\/$/, "")}${path}`, {
    method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000),
  });
  return res;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [verb, ...rest] = process.argv.slice(2);
  const opt = (n) => rest.find((a) => a.startsWith(`--${n}=`))?.split("=").slice(1).join("=");
  const base = process.env.WINAPP_BRIDGE;
  const absent = (why) => { console.log(`bridge absent — ${why}; verify the logic headlessly (never BLOCKED for this)`); process.exit(3); };
  if (!["health", "launch", "click", "type", "text", "screenshot", "stop"].includes(verb)) { console.log("usage: health|launch|click|type|text|screenshot|stop [...]"); process.exit(2); }
  if (!base) absent("WINAPP_BRIDGE is not set");
  try {
    const health = await call(base, "GET", "/health");
    if (health.status !== 200) absent(`/health answered ${health.status}`);
    if (verb === "health") { console.log("bridge up"); process.exit(0); }
    const need = (n) => { if (!opt(n)) { console.log(`usage: ${verb} --${n}=<value>`); process.exit(2); } return opt(n); };
    let res;
    if (verb === "launch") res = await call(base, "POST", "/launch", { exe: need("exe") });
    else if (verb === "click") res = await call(base, "POST", "/click", { selector: need("selector") });
    else if (verb === "type") res = await call(base, "POST", "/type", { selector: need("selector"), text: need("text") });
    else if (verb === "text") res = await call(base, "GET", `/text?selector=${encodeURIComponent(need("selector"))}`);
    else if (verb === "stop") res = await call(base, "POST", "/stop");
    else {
      const id = need("run-id");
      res = await call(base, "GET", "/screenshot");
      if (res.ok) {
        const dir = runDirectory(process.cwd(), id);
        mkdirSync(dir, { recursive: true });
        const out = join(dir, (opt("name") ?? `screenshot-${Date.now()}.png`).replace(/[^A-Za-z0-9_.-]/g, "_"));
        writeFileSync(out, Buffer.from(await res.arrayBuffer()));
        console.log(`bridge: screenshot saved ${out.slice(process.cwd().length + 1)}`);
        process.exit(0);
      }
    }
    const text = await res.text();
    console.log(res.ok ? `bridge: ${verb} ok${verb === "text" ? `: ${text}` : ""}` : `bridge: ${verb} failed ${res.status}: ${text.slice(0, 200)}`);
    process.exit(res.ok ? 0 : 1);
  } catch (error) {
    absent(`unreachable (${error.cause?.code ?? error.name})`);
  }
}
