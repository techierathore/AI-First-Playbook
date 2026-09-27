// What the installed OpenCode actually resolves, read the same way on 1.x and
// 2.x. OpenCode 1 prints its merged config with `opencode debug config`.
// OpenCode 2 prints only the config sources there, so the resolved commands,
// agents and active plugins come from its own API: a private `opencode serve`
// on 127.0.0.1 with a throwaway password, asked about the target directory.
import { closeSync, openSync, readFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { basename, dirname, join } from "node:path";
import { tmpdir } from "node:os";

export function opencodeInfo() {
  const bin = process.env.PLAYBOOK_OPENCODE_BIN || "opencode";
  const probe = spawnSync(bin, ["--version"], { encoding: "utf8" });
  if (probe.status !== 0) return null;
  const version = probe.stdout.trim().replace(/^opencode\s+v?/i, "");
  return { bin, version, major: Number(version.split(".")[0]) };
}

const env = (target) => ({ ...process.env, PWD: target, OPENCODE_DISABLE_AUTOUPDATE: "1" });

function debugJson(oc, target, args) {
  // OpenCode can exit before a pipe drains; capture through a file.
  const out = join(tmpdir(), `pb-oc-${process.pid}-${randomBytes(4).toString("hex")}.json`);
  const fd = openSync(out, "w");
  const child = spawnSync(oc.bin, args, { cwd: target, stdio: ["ignore", fd, "pipe"], encoding: "utf8", timeout: 180000, env: env(target) });
  closeSync(fd);
  if (child.status !== 0) throw new Error(`opencode ${args.join(" ")} exited ${child.status}: ${(child.stderr || "").slice(-300)}`);
  const text = readFileSync(out, "utf8");
  const start = text.search(/[[{]/);
  return JSON.parse(text.slice(start));
}

const freePort = () => new Promise((resolve, reject) => {
  const server = createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => { const { port } = server.address(); server.close(() => resolve(port)); });
});

async function v2Api(oc, target) {
  const port = await freePort();
  const password = randomBytes(16).toString("hex");
  const child = spawn(oc.bin, ["serve", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: target, stdio: ["ignore", "ignore", "pipe"], env: { ...env(target), OPENCODE_PASSWORD: password },
  });
  let stderr = "";
  child.stderr.on("data", (d) => (stderr = `${stderr}${d}`.slice(-2000)));
  const headers = { authorization: `Basic ${Buffer.from(`opencode:${password}`).toString("base64")}`, "x-opencode-directory": encodeURIComponent(target) };
  const get = async (path) => {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, { headers });
    if (!res.ok) throw new Error(`GET ${path}: ${res.status}`);
    return (await res.json()).data;
  };
  try {
    // The location activates its plugins on first use, in the background: the
    // built-in commands answer before the configured ones. Read once a second
    // until three reads agree (a plugin that never loads settles without it).
    const deadline = Date.now() + 120000;
    let previous = null;
    let agreeing = 0;
    let snapshot = null;
    while (Date.now() < deadline) {
      try {
        snapshot = { commands: await get("/api/command"), agents: await get("/api/agent"), plugins: await get("/api/plugin") };
        const key = JSON.stringify([snapshot.commands.map((c) => c.name), snapshot.agents.map((a) => a.id), snapshot.plugins.map((p) => [p.id, p.state?.status])]);
        agreeing = key === previous ? agreeing + 1 : 0;
        previous = key;
        if (snapshot.agents.length && agreeing >= 2) break;
      } catch {}
      if (child.exitCode !== null) throw new Error(`opencode serve exited ${child.exitCode}: ${stderr}`);
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (!snapshot) throw new Error(`opencode serve did not answer within 120 s: ${stderr}`);
    return snapshot;
  } finally {
    child.kill("SIGTERM");
  }
}

// A plugin directory resolves to its entry file (…/yolo/index.ts): name it by the directory.
const pluginName = (spec) => {
  const path = spec.replace(/^file:\/\//, "");
  return /^(index|server)\.[cm]?[jt]sx?$/.test(basename(path)) ? basename(dirname(path)) : basename(path);
};

/** { commands, agents, plugins (Playbook plugin names in load order), instructions } */
export async function resolved(oc, target) {
  if (oc.major < 2) {
    const config = debugJson(oc, target, ["debug", "config"]);
    return {
      commands: Object.keys(config.command ?? {}).sort(),
      agents: Object.keys(config.agent ?? {}).sort(),
      plugins: (config.plugin ?? []).map((p) => pluginName(String(Array.isArray(p) ? p[0] : p))),
      pluginsActive: null,
      instructions: (config.instructions ?? []).map(String),
    };
  }
  const sources = debugJson(oc, target, ["debug", "config"]);
  const documents = sources.filter((s) => s.type === "document" && s.info);
  const api = await v2Api(oc, target);
  const local = api.plugins.filter((p) => p.source?.type === "local");
  return {
    // OpenCode 2 adds its own built-in commands (init, review); keep only files it resolved from config.
    commands: api.commands.map((c) => c.name).filter((n) => !["init", "review"].includes(n)).sort(),
    agents: api.agents.map((a) => a.id).sort(),
    plugins: local.map((p) => pluginName(p.source.path)),
    pluginsActive: local.every((p) => p.state?.status === "active"),
    instructions: documents.flatMap((d) => d.info.instructions ?? []).map(String),
  };
}

/** Arguments for a headless `opencode run` against the scripted model. */
export function runArgs(oc, { agent, message }) {
  const base = oc.major < 2 ? ["run", "--model", "mock/scripted", "--print-logs"] : ["run", "--standalone", "--model", "mock/scripted", "--print-logs"];
  return [...base, ...(agent ? ["--agent", agent] : []), message];
}

/** Tool names and argument keys differ between OpenCode 1 and 2. */
export function tools(oc) {
  return oc.major < 2
    ? { shell: "bash", write: (path, content) => ({ tool: "write", args: { filePath: path, content } }), subagent: "task" }
    : { shell: "shell", write: (path, content) => ({ tool: "write", args: { path, content } }), subagent: "subagent" };
}
