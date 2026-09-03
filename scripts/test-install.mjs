import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const sandbox = mkdtempSync(join(tmpdir(), "aifp-install-"));
const directTarget = join(sandbox, "direct");
const prohibitedIntegrationArtifacts = [
  `.${["clau", "de"].join("")}`,
  ["CLAUDE", ".md"].join(""),
  [".mcp", ".json"].join(""),
  ["harness", ["claude", "code"].join("-")].join("/"),
  ["scripts/harness", "-install.mjs"].join(""),
];
const prohibitedIntegrationMarkers = [
  ["Claude", "Code"].join(" "),
  ["Claude", "adapter"].join(" "),
  ["Claude", "binary"].join(" "),
  ["Claude", "harness"].join(" "),
  ["Claude", "hook"].join(" "),
  ["Claude", "pack"].join(" "),
  ["Claude", "parity"].join(" "),
  ["claude", "code"].join("-"),
  ["claude", " -p"].join(""),
  ["PLAYBOOK", "CLAUDE", "BIN"].join("_"),
  ["CLAUDE", "PROJECT", "DIR"].join("_"),
  ...prohibitedIntegrationArtifacts,
];
const maintainerOnly = [
  "Context-Prompt.md",
  "harness/README.md",
  "harness/opencode/command/update-context.md",
  "docs/Adapter-Design.md",
  "docs/Brownfield-Case-Study.html",
  "docs/Capability-Matrix.md",
  "docs/Coupling-Points.md",
  "docs/Decisions.md",
  "docs/Getting-Started.html",
  "docs/Greenfield-Case-Study.html",
  "docs/Miss-Telemetry-AI-First-Playbook.md",
  "docs/Miss-Telemetry-TechieFlow.md",
  "docs/Miss-Telemetry-TfLens-From-AIFP.md",
  "docs/Model-Routing-Guide.md",
  "docs/Npm-Publishing-Guide.md",
  "docs/Npm-Release-Guide.md",
  "docs/OpenCode-Guide.md",
  "docs/OpenCode-Setup-Guide.md",
  "docs/Phase-Efficiency-TfLens-Contract.md",
  "docs/Telemetry-Hooks.md",
];

function run(script, args, options = {}) {
  const result = spawnSync(process.execPath, [join(root, script), ...args], {
    cwd: options.cwd ?? root,
    env: { ...process.env, ...options.env },
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(`${script} failed:\n${result.stdout}${result.stderr}`);
}

function runFailure(script, args, options = {}) {
  const result = spawnSync(process.execPath, [join(root, script), ...args], {
    cwd: options.cwd ?? root,
    env: { ...process.env, ...options.env },
    encoding: "utf8",
  });
  assert(result.status !== 0, `${script} unexpectedly succeeded`);
  return `${result.stdout}${result.stderr}`;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitFor(condition, message, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(message);
}

function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : entry.isFile() ? [path] : [];
  });
}

function assertNoIntegrationMarkers(file, displayPath) {
  const text = readFileSync(file, "utf8");
  for (const marker of prohibitedIntegrationMarkers) {
    assert(!text.includes(marker), `prohibited integration marker ${JSON.stringify(marker)} leaked into ${displayPath}`);
  }
}

try {
  mkdirSync(directTarget);
  const projectGitignore = "# Project rules\n/dist/\n";
  writeFileSync(join(directTarget, ".gitignore"), projectGitignore);
  run("scripts/install.mjs", ["install", `--target=${directTarget}`]);
  for (const path of [
    ".opencode/command/verify.md",
    ".opencode/agent/verifier.md",
    ".opencode/plugin/spec-guardrails.ts",
    ".opencode/opencode.json",
    ".playbook/AGENTS.md",
    ".playbook/environment-profile.yml",
    ".playbook/model-tiers.yml",
    ".playbook/scripts/playbook-miss.mjs",
    ".playbook/scripts/miss-lib.mjs",
    ".playbook/scripts/playbook-telemetry.mjs",
    ".playbook/installation.json",
  ]) assert(existsSync(join(directTarget, path)), `direct install is missing ${path}`);
  for (const path of ["AGENTS.md", "opencode.json", "docs", "harness", "onboarding", "phases", "playbook", "scripts", "templates", "verification", "node_modules", "package.json", "package-lock.json"]) {
    assert(!existsSync(join(directTarget, path)), `default install leaked visible or package-manager artifact: ${path}`);
  }
  assert(JSON.stringify(readdirSync(directTarget).sort()) === JSON.stringify([".gitignore", ".opencode", ".playbook"]), "default install created entries outside the two hidden framework directories and .gitignore");
  for (const path of prohibitedIntegrationArtifacts) {
    assert(!existsSync(join(directTarget, path)), `prohibited integration artifact leaked into install: ${path}`);
  }
  for (const file of filesUnder(directTarget)) {
    assertNoIntegrationMarkers(file, `installed file ${file.slice(directTarget.length + 1)}`);
  }
  for (const path of maintainerOnly) {
    const installedPath = path.replace(/^harness\/opencode\//, ".opencode/");
    assert(!existsSync(join(directTarget, installedPath)), `maintainer-only file leaked into install: ${installedPath}`);
  }
  const hiddenAgents = readFileSync(join(directTarget, ".playbook/AGENTS.md"), "utf8");
  assert(hiddenAgents.includes(".playbook/environment-profile.yml"), "installed standing rules point at the visible legacy profile path");
  const hiddenConfig = readFileSync(join(directTarget, ".opencode/opencode.json"), "utf8");
  assert(hiddenConfig.includes("../.playbook/AGENTS.md"), "hidden OpenCode config does not load hidden standing rules");
  for (const path of [".opencode/agent/orchestrator.md", ".opencode/agent/verifier.md", ".opencode/command/fix.md", ".opencode/command/implement.md", ".opencode/command/legacy-audit.md"]) {
    const installedPrompt = readFileSync(join(directTarget, path), "utf8");
    assert(installedPrompt.includes(".playbook/AGENTS.md"), `installed prompt does not reference hidden standing rules: ${path}`);
    assert(!installedPrompt.includes("`AGENTS.md`"), `installed prompt still references a root standing-rules file: ${path}`);
    assert(!installedPrompt.includes(".playbook/AGENTS.md` at the repo root"), `installed prompt describes the hidden standing-rules file as a root file: ${path}`);
  }

  const gitignorePath = join(directTarget, ".gitignore");
  const gitignore = readFileSync(gitignorePath, "utf8");
  assert(gitignore.startsWith(projectGitignore), "installer replaced existing project .gitignore rules");
  const gitignoreLines = new Set(gitignore.split("\n"));
  for (const rule of ["/.opencode/", "/.playbook/", "/verification/telemetry/events.ndjson"]) {
    assert(gitignoreLines.has(rule), `.gitignore is missing ${rule}`);
  }
  for (const tracked of ["/docs/", "/verification/", "/onboarding/", "/phases/", "/playbook/", "/scripts/", "/templates/"]) {
    assert(!gitignoreLines.has(tracked), `.gitignore must not hide project-owned ${tracked}`);
  }

  const agentsPath = join(directTarget, ".playbook/AGENTS.md");
  writeFileSync(agentsPath, "project-owned\n");
  run("scripts/install.mjs", ["install", `--target=${directTarget}`]);
  assert(readFileSync(agentsPath, "utf8") === "project-owned\n", "install did not preserve an existing file");
  const repeatedGitignore = readFileSync(gitignorePath, "utf8");
  assert(repeatedGitignore === gitignore, "reinstall duplicated or changed the managed .gitignore block");

  run("scripts/install.mjs", ["uninstall", `--target=${directTarget}`]);
  assert(readFileSync(agentsPath, "utf8") === "project-owned\n", "uninstall without --force deleted a locally modified file");
  assert(existsSync(join(directTarget, ".playbook/installation.json")), "uninstall without --force removed its ownership record");
  assert(readFileSync(gitignorePath, "utf8") === repeatedGitignore, "uninstall without --force changed .gitignore");

  run("scripts/install.mjs", ["uninstall", `--target=${directTarget}`, "--force"]);
  const uninstalledGitignore = readFileSync(gitignorePath, "utf8");
  assert(!uninstalledGitignore.includes("AI-First Playbook framework"), "uninstall left the managed .gitignore block");
  assert(uninstalledGitignore === projectGitignore, "uninstall changed existing project .gitignore rules");
  assert(!existsSync(join(directTarget, ".opencode")), "forced uninstall left the installed .opencode directory");
  assert(!existsSync(join(directTarget, ".playbook")), "forced uninstall left the installed .playbook directory");

  const migrationTarget = join(sandbox, "legacy-layout");
  mkdirSync(join(migrationTarget, ".playbook"), { recursive: true });
  for (const [path, content] of [["AGENTS.md", "legacy\n"], ["opencode.json", "{}\n"], ["playbook/environment-profile.yml", "legacy\n"], ["scripts/playbook-miss.mjs", "legacy\n"], ["docs/Installation.md", "legacy\n"]]) {
    mkdirSync(join(migrationTarget, path, ".."), { recursive: true });
    writeFileSync(join(migrationTarget, path), content);
  }
  const legacyCreated = ["AGENTS.md", "opencode.json", "playbook/environment-profile.yml", "scripts/playbook-miss.mjs", "docs/Installation.md"];
  writeFileSync(join(migrationTarget, ".playbook/installation.json"), `${JSON.stringify({ package: "@techierathore/ai-first-playbook", version: "0.0.1", created: legacyCreated })}\n`);
  run("scripts/install.mjs", ["install", `--target=${migrationTarget}`]);
  for (const path of legacyCreated) assert(existsSync(join(migrationTarget, path)), `non-forced upgrade deleted legacy asset ${path}`);
  const preservedMarker = JSON.parse(readFileSync(join(migrationTarget, ".playbook/installation.json"), "utf8"));
  for (const path of legacyCreated) assert(preservedMarker.created.includes(path), `non-forced upgrade dropped legacy ownership for ${path}`);
  run("scripts/install.mjs", ["install", `--target=${migrationTarget}`, "--force"]);
  for (const path of legacyCreated) assert(!existsSync(join(migrationTarget, path)), `forced upgrade left legacy visible asset ${path}`);
  assert(existsSync(join(migrationTarget, ".opencode/opencode.json")), "forced upgrade did not install the hidden OpenCode config");
  const migratedMarker = JSON.parse(readFileSync(join(migrationTarget, ".playbook/installation.json"), "utf8"));
  for (const path of legacyCreated) assert(!migratedMarker.created.includes(path), `forced upgrade retained stale ownership for ${path}`);

  const unsafeTarget = join(sandbox, "unsafe-marker");
  mkdirSync(join(unsafeTarget, ".playbook"), { recursive: true });
  writeFileSync(join(unsafeTarget, ".playbook/installation.json"), `${JSON.stringify({ package: "@techierathore/ai-first-playbook", version: "0.1.0", created: ["../outside"] })}\n`);
  const unsafeOutput = runFailure("scripts/install.mjs", ["uninstall", `--target=${unsafeTarget}`, "--force"]);
  assert(unsafeOutput.includes("escapes the target"), "unsafe ownership record was not rejected for the expected reason");

  const unsupportedTarget = join(sandbox, "unsupported-marker");
  mkdirSync(join(unsupportedTarget, ".playbook"), { recursive: true });
  writeFileSync(join(unsupportedTarget, ".playbook/installation.json"), `${JSON.stringify({ package: "@techierathore/ai-first-playbook", version: "0.1.0", created: ["src/app.js"] })}\n`);
  const unsupportedOutput = runFailure("scripts/install.mjs", ["uninstall", `--target=${unsupportedTarget}`, "--force"]);
  assert(unsupportedOutput.includes("unsupported managed path"), "unsupported ownership entry was not rejected for the expected reason");

  const projectOwnedTarget = join(sandbox, "project-owned");
  mkdirSync(join(projectOwnedTarget, ".opencode"), { recursive: true });
  writeFileSync(join(projectOwnedTarget, ".opencode/opencode.json"), "project-owned\n");
  run("scripts/install.mjs", ["install", `--target=${projectOwnedTarget}`, "--force"]);
  assert(readFileSync(join(projectOwnedTarget, ".opencode/opencode.json"), "utf8") === "project-owned\n", "--force overwrote an unowned pre-existing file");

  const symlinkTarget = join(sandbox, "symlink-target");
  const symlinkOutside = join(sandbox, "symlink-outside");
  mkdirSync(symlinkTarget);
  mkdirSync(symlinkOutside);
  symlinkSync(symlinkOutside, join(symlinkTarget, ".opencode"), "dir");
  const symlinkOutput = runFailure("scripts/install.mjs", ["install", `--target=${symlinkTarget}`]);
  assert(symlinkOutput.includes("symbolic link"), "installer did not reject a symlinked managed directory");
  assert(readdirSync(symlinkOutside).length === 0, "installer wrote through a symlinked managed directory");

  const dryRunTarget = join(sandbox, "dry-run");
  run("scripts/install.mjs", ["install", `--target=${dryRunTarget}`, "--dry-run"]);
  assert(!existsSync(dryRunTarget), "dry-run wrote to the target");

  const noGitignoreTarget = join(sandbox, "no-gitignore");
  run("scripts/install.mjs", ["install", `--target=${noGitignoreTarget}`, "--no-gitignore"]);
  assert(!existsSync(join(noGitignoreTarget, ".gitignore")), "--no-gitignore created .gitignore");
  assert(!existsSync(join(noGitignoreTarget, ".playbook/guides")), "default install included optional guides");

  const guidesTarget = join(sandbox, "guides");
  run("scripts/install.mjs", ["install", `--target=${guidesTarget}`, "--with-guides"]);
  for (const path of [".playbook/guides/docs/Usage.md", ".playbook/guides/onboarding/first-week.md", ".playbook/guides/phases/01-plan.md", ".playbook/guides/templates/checklist-item-template.md"]) {
    assert(existsSync(join(guidesTarget, path)), `--with-guides is missing ${path}`);
  }
  for (const path of ["docs", "onboarding", "phases", "templates"]) assert(!existsSync(join(guidesTarget, path)), `--with-guides leaked visible ${path}/`);

  const npmResult = process.env.npm_execpath
    ? spawnSync(process.execPath, [process.env.npm_execpath, "pack", "--json", "--dry-run"], { cwd: root, encoding: "utf8" })
    : spawnSync("npm", ["pack", "--json", "--dry-run"], { cwd: root, encoding: "utf8" });
  if (npmResult.status !== 0) throw new Error(`npm pack failed:\n${npmResult.stdout}${npmResult.stderr}`);
  const packedFiles = new Set(JSON.parse(npmResult.stdout)[0].files.map((file) => file.path));
  for (const artifact of prohibitedIntegrationArtifacts) {
    assert(![...packedFiles].some((path) => path === artifact || path.startsWith(`${artifact}/`)), `prohibited integration artifact leaked into npm package: ${artifact}`);
  }
  for (const path of packedFiles) assertNoIntegrationMarkers(join(root, path), `npm package file ${path}`);
  for (const path of maintainerOnly) assert(!packedFiles.has(path), `maintainer-only file leaked into npm package: ${path}`);
  for (const path of ["scripts/install.mjs", "scripts/npm-lifecycle.mjs", "scripts/npm-cleanup.mjs", "harness/opencode/opencode.json", "harness/opencode/command/verify.md", "docs/Usage.md", "phases/01-plan.md", "templates/checklist-item-template.md", "templates/checklist-metadata.yml", "templates/deployment-steps-template.md", "templates/handoffs/plan-approval.md", "templates/issues-file-template.md", "AGENTS.md"]) {
    assert(packedFiles.has(path), `required file is missing from npm package: ${path}`);
  }

  const packed = process.env.npm_execpath
    ? spawnSync(process.execPath, [process.env.npm_execpath, "pack", "--json", `--pack-destination=${sandbox}`], { cwd: root, encoding: "utf8" })
    : spawnSync("npm", ["pack", "--json", `--pack-destination=${sandbox}`], { cwd: root, encoding: "utf8" });
  if (packed.status !== 0) throw new Error(`npm pack for npx test failed:\n${packed.stdout}${packed.stderr}`);
  const tarball = join(sandbox, basename(JSON.parse(packed.stdout)[0].filename));
  const dependencyTarget = join(sandbox, "dependency-install");
  mkdirSync(dependencyTarget);
  const npmInstall = process.env.npm_execpath
    ? spawnSync(process.execPath, [process.env.npm_execpath, "install", tarball], { cwd: dependencyTarget, encoding: "utf8" })
    : spawnSync("npm", ["install", tarball], { cwd: dependencyTarget, encoding: "utf8" });
  if (npmInstall.status !== 0) throw new Error(`plain npm install compatibility test failed:\n${npmInstall.stdout}${npmInstall.stderr}`);
  await waitFor(
    () => JSON.stringify(readdirSync(dependencyTarget).sort()) === JSON.stringify([".gitignore", ".opencode", ".playbook"]),
    "plain npm install did not settle to the hidden-only framework layout",
  );
  for (const path of ["node_modules", "package.json", "package-lock.json", "AGENTS.md", "opencode.json"]) {
    assert(!existsSync(join(dependencyTarget, path)), `plain npm install left deployment artifact ${path}`);
  }

  const npxTarget = join(sandbox, "npx-install");
  mkdirSync(npxTarget);
  const npmExecArgs = ["exec", "--yes", `--package=${tarball}`, "--", "ai-first-playbook", "install"];
  const npmExec = process.env.npm_execpath
    ? spawnSync(process.execPath, [process.env.npm_execpath, ...npmExecArgs], { cwd: npxTarget, encoding: "utf8" })
    : spawnSync("npm", npmExecArgs, { cwd: npxTarget, encoding: "utf8" });
  if (npmExec.status !== 0) throw new Error(`one-shot npm exec test failed:\n${npmExec.stdout}${npmExec.stderr}`);
  assert(JSON.stringify(readdirSync(npxTarget).sort()) === JSON.stringify([".gitignore", ".opencode", ".playbook"]), "one-shot npm exec left package-manager or visible framework artifacts in the target");

  console.log("installer tests passed");
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}
