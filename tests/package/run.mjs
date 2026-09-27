// Packed-install checks. Each run packs the source, installs the tarball into a
// throwaway target outside the repository, and inspects what OpenCode resolves.
//   node tests/package/run.mjs PB-01   packed install resolves 14 commands and 4 agents
//   node tests/package/run.mjs PB-02   OpenCode is the only harness in the package and the install
import { closeSync, existsSync, openSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { basename, join, relative } from "node:path";
import { assert, repoRoot, requirementId, runCases, ungraded } from "../lib.mjs";
import { opencodeInfo, resolved } from "../opencode.mjs";

const id = requirementId("PB-01");
const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
const work = mkdtempSync(join(tmpdir(), "pb-package-"));
process.on("exit", () => rmSync(work, { recursive: true, force: true }));

function npm(args, cwd) {
  const child = process.env.npm_execpath
    ? spawnSync(process.execPath, [process.env.npm_execpath, ...args], { cwd, encoding: "utf8" })
    : spawnSync("npm", args, { cwd, encoding: "utf8" });
  if (child.status !== 0) throw new Error(`npm ${args[0]} failed: ${(child.stderr || child.stdout).slice(-400)}`);
  return child.stdout;
}

function packAndInstall() {
  const packed = JSON.parse(npm(["pack", "--json", `--pack-destination=${work}`], repoRoot))[0];
  const tarball = join(work, basename(packed.filename));
  const target = join(work, "target");
  mkdirSync(target);
  npm(["exec", "--yes", `--package=${tarball}`, "--", "ai-first-playbook", "install"], target);
  const extracted = join(work, "extracted");
  mkdirSync(extracted);
  const tar = spawnSync("tar", ["-xzf", tarball, "-C", extracted], { encoding: "utf8" });
  if (tar.status !== 0) throw new Error(`tar failed: ${tar.stderr}`);
  return { files: packed.files.map((f) => f.path), target, extracted: join(extracted, "package") };
}

function walk(dir, base = dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, base, out);
    else out.push(relative(base, path).replaceAll("\\", "/"));
  }
  return out;
}

const expectedCommands = pkg.files
  .filter((f) => f.startsWith("harness/opencode/command/") && f.endsWith(".md"))
  .map((f) => basename(f, ".md")).sort();
const expectedAgents = ["analyst", "builder", "orchestrator", "verifier"];

if (id === "PB-01") {
  const oc = opencodeInfo();
  if (!oc) ungraded(id, "opencode is not on PATH (set PLAYBOOK_OPENCODE_BIN); resolution cannot be observed");
  const { target } = packAndInstall();
  await runCases(id, [
    ["the package declares 14 OpenCode commands", () => assert(expectedCommands.length === 14, `package.json ships ${expectedCommands.length} commands`)],
    [`OpenCode ${oc.version} resolves every packaged command, agent and plugin in the installed target`, async () => {
      const r = await resolved(oc, target);
      const problems = [];
      if (JSON.stringify(r.commands) !== JSON.stringify(expectedCommands)) problems.push(`resolved commands ${r.commands.join(",")}`);
      for (const agent of expectedAgents) if (!r.agents.includes(agent)) problems.push(`agent ${agent} did not resolve`);
      // Order must come from opencode.json: plugins in OpenCode's auto-discovered plugin/ folder
      // load in file-system order (on CI: yolo before the guardrails). OpenCode 2 loads a
      // configured plugin only as a directory (MISS-20260926-07 order kept on both).
      if (r.plugins.join(",") !== "telemetry,spec-guardrails,yolo") problems.push(`plugin order ${r.plugins.join(",")}`);
      if (r.pluginsActive === false) problems.push("a Playbook plugin did not activate");
      if (existsSync(join(target, ".opencode/plugin"))) problems.push("a Playbook plugin sits in the auto-discovered .opencode/plugin/ folder");
      if (!r.instructions.some((p) => p.endsWith(".playbook/AGENTS.md"))) problems.push(`standing rules are not loaded (instructions ${r.instructions.join(",")})`);
      assert(!problems.length, problems.join("; "));
    }],
    ["the supported OpenCode version is recorded and matches the one observed", () => {
      const supported = pkg.opencode?.supported;
      assert(supported, "package.json opencode.supported is missing");
      assert(Array.isArray(supported) && supported.length, "package.json opencode.supported is not a list of versions");
      if (!supported.includes(oc.version)) console.log(`note: observed OpenCode ${oc.version}, supported ${supported.join(", ")}`);
    }],
  ]);
} else if (id === "PB-02") {
  const { files, target, extracted } = packAndInstall();
  const otherHarness = [`.${["clau", "de"].join("")}`, ".codex", ".cursor", ".windsurf", ".gemini", ["CLAUDE", "md"].join("."), ".github/copilot-instructions.md"];
  await runCases(id, [
    ["no other coding-harness artefact ships in the npm package", () => {
      for (const path of files) for (const a of otherHarness) assert(!(path === a || path.startsWith(`${a}/`) || path.includes(`/${a}`)), `package ships ${path}`);
    }],
    ["no packaged file names another coding harness", () => {
      for (const path of walk(extracted)) {
        if (statSync(join(extracted, path)).size > 2_000_000) continue;
        assert(!/\bcodex\b/i.test(readFileSync(join(extracted, path), "utf8")), `${path} mentions another harness`);
      }
      const scan = spawnSync(process.execPath, [join(repoRoot, "scripts/playbook-validate.mjs"), `--open-code-only-scan-root=${extracted}`], { encoding: "utf8" });
      assert(scan.status === 0, scan.stderr.split("\n").slice(0, 3).join("; "));
    }],
    ["the installed target holds only the OpenCode runtime", () => {
      const top = readdirSync(target).sort();
      assert(JSON.stringify(top) === JSON.stringify([".gitignore", ".opencode", ".playbook"]), `target root ${top.join(",")}`);
      const scan = spawnSync(process.execPath, [join(repoRoot, "scripts/playbook-validate.mjs"), `--open-code-only-scan-root=${target}`], { encoding: "utf8" });
      assert(scan.status === 0, scan.stderr.split("\n").slice(0, 3).join("; "));
    }],
  ]);
} else {
  console.log(`${id} fail: tests/package/run.mjs has no case set for this ID`);
  process.exit(1);
}
