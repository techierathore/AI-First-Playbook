#!/usr/bin/env node
/**
 * opencode-command.mjs — run a Playbook command (/verify, /implement, …)
 * headlessly, the same way on OpenCode 1 and 2.
 *
 *   node .playbook/scripts/opencode-command.mjs <command> [text…] [--model=provider/model]
 *        [--agent=<name>] [--auto] [--print-logs] [--format=json] [--timeout=<minutes>]
 *
 * OpenCode 1 runs `opencode run --command <command> <text>`. OpenCode 2's
 * `run` has no command flag and sends "/verify …" to the agent as plain text,
 * so the command's template, agent and subtask never apply. On 2.x this starts
 * a private `opencode serve` (127.0.0.1, throwaway password) in the current
 * directory, creates a session and posts the command through the server's
 * session.command route, then waits until the session and its subagent
 * sessions are idle. The private server inherits this environment, so
 * PLAYBOOK_* variables reach the plugins (the background service would not).
 * --auto answers each permission request with "once", as `run --auto` does;
 * without it a request is rejected, since nobody is there to answer it.
 *
 * Prints the root session's assistant text (--format=json: one JSON line per
 * text part, each carrying "sessionID"). Exit 0 when the command ran, 1 when
 * the session failed, 2 on usage errors, 5 when OpenCode is missing.
 */
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { realpathSync } from "node:fs";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function parseArgs(argv) {
  const opts = { command: null, text: [], model: null, agent: null, auto: false, printLogs: false, format: "default", timeout: 240 };
  for (const arg of argv) {
    if (!arg.startsWith("--")) { if (opts.command === null) opts.command = arg.replace(/^\//, ""); else opts.text.push(arg); continue; }
    const [name, value] = [arg.slice(2).split("=")[0], arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : undefined];
    if (name === "auto" || name === "print-logs") { if (value !== undefined) throw new Error(`--${name} takes no value`); opts[name === "auto" ? "auto" : "printLogs"] = true; continue; }
    if (!["model", "agent", "format", "timeout"].includes(name) || !value) throw new Error(`unknown or empty option ${arg}`);
    opts[name] = name === "timeout" ? Number(value) : value;
  }
  if (!opts.command || !/^[a-z][a-z0-9-]*$/.test(opts.command)) throw new Error("a command name is required, e.g. verify");
  if (!["default", "json"].includes(opts.format)) throw new Error("--format is default or json");
  if (!(opts.timeout > 0)) throw new Error("--timeout is a number of minutes");
  if (opts.model && !/^[^/\s]+\/\S+$/.test(opts.model)) throw new Error("--model is provider/model");
  return { ...opts, text: opts.text.join(" ") };
}

export function opencodeMajor(bin) {
  const r = spawnSync(bin, ["--version"], { encoding: "utf8" });
  if (r.status !== 0) return null;
  return Number(r.stdout.trim().replace(/^opencode\s+v?/i, "").split(".")[0]);
}

/** OpenCode 1: the arguments for `opencode run --command`. */
export function v1Args(o) {
  return ["run", ...(o.model ? ["--model", o.model] : []), ...(o.agent ? ["--agent", o.agent] : []), ...(o.auto ? ["--auto"] : []),
    ...(o.printLogs ? ["--print-logs"] : []), ...(o.format === "json" ? ["--format", "json"] : []), "--command", o.command, ...(o.text ? [o.text] : [])];
}

const freePort = () => new Promise((resolve, reject) => {
  const s = createServer();
  s.once("error", reject);
  s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

/** OpenCode 2: run the command through a private server. Returns the exit code. */
export async function runV2(bin, o, dir = process.cwd(), out = process.stdout) {
  const port = await freePort();
  const password = randomBytes(16).toString("hex");
  const child = spawn(bin, ["serve", "--hostname", "127.0.0.1", "--port", String(port), ...(o.printLogs ? ["--print-logs"] : [])], {
    cwd: dir, stdio: ["ignore", o.printLogs ? "inherit" : "ignore", o.printLogs ? "inherit" : "ignore"],
    env: { ...process.env, OPENCODE_PASSWORD: password, OPENCODE_DISABLE_AUTOUPDATE: "1" }, detached: process.platform !== "win32",
  });
  const headers = { "content-type": "application/json", authorization: `Basic ${Buffer.from(`opencode:${password}`).toString("base64")}`, "x-opencode-directory": encodeURIComponent(dir) };
  const call = async (method, path, body) => {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${path}: HTTP ${res.status} ${text.slice(0, 300)}`);
    return text ? JSON.parse(text).data : null;
  };
  // Every assistant message, oldest first: the first page is newest-first by default and paged.
  const assistantMessages = async (id) => {
    const all = [];
    let url = `/api/session/${id}/message?type=assistant&order=asc&limit=200`;
    while (url) {
      const res = await fetch(`http://127.0.0.1:${port}${url}`, { headers });
      if (!res.ok) throw new Error(`GET ${url}: HTTP ${res.status}`);
      const body = await res.json();
      all.push(...(body.data ?? []));
      const next = body.cursor?.next;
      url = next && body.data?.length === 200 ? `/api/session/${id}/message?type=assistant&limit=200&cursor=${encodeURIComponent(next)}` : null;
    }
    return all;
  };
  try {
    // The location loads its configured commands in the background after the server answers.
    const deadline = Date.now() + 120000;
    let names = [];
    while (Date.now() < deadline && !names.includes(o.command)) {
      if (child.exitCode !== null) throw new Error(`opencode serve exited ${child.exitCode}`);
      try { names = (await call("GET", "/api/command")).map((c) => c.name); } catch {}
      if (!names.includes(o.command)) await sleep(1000);
    }
    if (!names.includes(o.command)) throw new Error(`OpenCode does not know the command /${o.command} here (known: ${names.join(", ") || "none"})`);
    const [providerID, ...rest] = (o.model ?? "").split("/");
    const session = await call("POST", "/api/session", {
      location: { directory: dir }, ...(o.agent ? { agent: o.agent } : {}), ...(o.model ? { model: { providerID, id: rest.join("/") } } : {}),
    });
    if (o.format === "json") out.write(`${JSON.stringify({ type: "session", sessionID: session.id })}\n`);
    await call("POST", `/api/session/${session.id}/command`, { name: o.command, text: o.text });

    // Idle = the session has messages and neither it nor any subagent session
    // has been running for three polls in a row.
    const stop = Date.now() + o.timeout * 60000;
    let idle = 0;
    while (idle < 3) {
      if (Date.now() > stop) throw new Error(`/${o.command} still running after ${o.timeout} min`);
      if (child.exitCode !== null) throw new Error(`opencode serve exited ${child.exitCode}`);
      await sleep(2000);
      const tree = [session.id];
      for (let i = 0; i < tree.length; i++) for (const s of (await call("GET", `/api/session?parentID=${tree[i]}`)) ?? []) if (!tree.includes(s.id)) tree.push(s.id);
      for (const id of tree) for (const p of (await call("GET", `/api/session/${id}/permission`)) ?? []) {
        await call("POST", `/api/session/${id}/permission/${p.id}/reply`, { decision: o.auto ? "once" : "reject" });
      }
      const running = Object.keys((await call("GET", "/api/session/active")) ?? {});
      const messages = (await call("GET", `/api/session/${session.id}/message?limit=1`)) ?? [];
      idle = messages.length && !tree.some((id) => running.includes(id)) ? idle + 1 : 0;
    }
    for (const m of await assistantMessages(session.id)) for (const part of m.content ?? []) {
      if (part.type !== "text" || !part.text) continue;
      out.write(o.format === "json" ? `${JSON.stringify({ type: "text", sessionID: session.id, text: part.text })}\n` : `${part.text}\n`);
    }
    const info = await call("GET", `/api/session/${session.id}`);
    return info?.outcome === "failed" ? 1 : 0;
  } finally {
    try { process.platform === "win32" ? child.kill() : process.kill(-child.pid, "SIGTERM"); } catch {}
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let o;
  try { o = parseArgs(process.argv.slice(2)); } catch (error) {
    console.error(`opencode-command: ${error.message}\nusage: node .playbook/scripts/opencode-command.mjs <command> [text…] [--model=provider/model] [--agent=<name>] [--auto] [--print-logs] [--format=json] [--timeout=<minutes>]`);
    process.exit(2);
  }
  const bin = process.env.PLAYBOOK_OPENCODE_BIN || "opencode";
  const major = opencodeMajor(bin);
  if (major === null) { console.error(`opencode-command: ${bin} --version failed; is OpenCode on PATH?`); process.exit(5); }
  if (major < 2) {
    const r = spawnSync(bin, v1Args(o), { stdio: "inherit", shell: process.platform === "win32" });
    process.exit(r.status ?? 1);
  }
  runV2(bin, o).then((code) => process.exit(code), (error) => { console.error(`opencode-command: ${error.message}`); process.exit(1); });
}
