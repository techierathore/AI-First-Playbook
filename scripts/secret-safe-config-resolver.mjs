#!/usr/bin/env node
/**
 * secret-safe-config-resolver.mjs — hand a configuration value (a connection
 * string, an API key) to a command without it ever reaching an argument, a
 * log, Markdown or this script's own output.
 *
 *   node .playbook/scripts/secret-safe-config-resolver.mjs file --key=<ref> --run-id=<id> [--config=<path>]
 *   node .playbook/scripts/secret-safe-config-resolver.mjs pipe --key=<ref> [--config=<path>] -- <command> [args...]
 *
 * <ref> is `env:NAME` (an environment reference) or a dotted JSON path such as
 * `ConnectionStrings.Default` read from --config, else the profile's
 * `database.config_path`. `file` writes the value to a protected temporary
 * file (mode 0600) under verification/runs/<id>/ and prints only its path and
 * length; `pipe` runs the command without a shell and feeds the value on
 * stdin. A missing key or config is `BLOCKED` naming the reference, never a
 * guessed default. The value is never printed.
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { field, readProfile, runDirectory } from "./profile-lib.mjs";
import { fileURLToPath } from "node:url";

export function resolveValue(ref, { config, root = process.cwd(), env = process.env } = {}) {
  if (!ref) return { blocked: "no --key given" };
  if (ref.startsWith("env:")) {
    const name = ref.slice(4);
    return env[name] ? { value: env[name] } : { blocked: `environment reference ${name} is not set` };
  }
  let path = config;
  if (!path) {
    const { profile } = readProfile(root);
    const f = profile ? field(profile, "database.config_path") : { blocked: "no environment profile" };
    if (f.blocked) return { blocked: `no --config and ${f.blocked}` };
    path = f.value;
  }
  const abs = join(root, path);
  if (!existsSync(abs)) return { blocked: `config file ${path} does not exist` };
  let node;
  try { node = JSON.parse(readFileSync(abs, "utf8")); } catch { return { blocked: `config file ${path} is not JSON` }; }
  for (const part of ref.split(".")) node = node && typeof node === "object" ? node[part] : undefined;
  if (typeof node !== "string" || !node) return { blocked: `key ${ref} is missing in ${path}` };
  return { value: node };
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const dash = argv.indexOf("--");
  const own = dash === -1 ? argv : argv.slice(0, dash);
  const command = dash === -1 ? [] : argv.slice(dash + 1);
  const [mode] = own;
  const opt = (n) => own.find((a) => a.startsWith(`--${n}=`))?.split("=").slice(1).join("=");
  const r = resolveValue(opt("key"), { config: opt("config") });
  if (r.blocked) { console.log(`BLOCKED — ${r.blocked}`); process.exit(2); }
  if (mode === "file") {
    const id = opt("run-id");
    if (!id) { console.log("usage: file --key=<ref> --run-id=<id>"); process.exit(2); }
    const dir = runDirectory(process.cwd(), id);
    mkdirSync(dir, { recursive: true });
    const out = join(dir, `secret-${opt("key").replace(/[^A-Za-z0-9_.-]/g, "_")}`);
    writeFileSync(out, r.value, { mode: 0o600 });
    chmodSync(out, 0o600);
    console.log(`resolver: wrote ${out.slice(process.cwd().length + 1)} (mode 0600, ${r.value.length} characters); pass the path, never the value`);
    process.exit(0);
  }
  if (mode === "pipe" && command.length) {
    const child = spawnSync(command[0], command.slice(1), { input: r.value, stdio: ["pipe", "inherit", "inherit"] });
    process.exit(child.status ?? 1);
  }
  console.log("usage: file --key=<ref> --run-id=<id> | pipe --key=<ref> -- <command> [args]");
  process.exit(2);
}
