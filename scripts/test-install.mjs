import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
  mkdirSync(join(directTarget, "docs"));
  writeFileSync(join(directTarget, "docs/Usage.md"), "project-owned usage\n");
  run("scripts/install.mjs", ["install", `--target=${directTarget}`]);
  for (const path of [
    ".opencode/command/verify.md",
    ".opencode/agent/verifier.md",
    ".opencode/plugin/spec-guardrails.ts",
    "opencode.json",
    "AGENTS.md",
    "playbook/environment-profile.yml",
    "scripts/playbook-miss.mjs",
    "docs/Repository-Structure.md",
    "phases/01-plan.md",
    "templates/checklist-item-template.md",
    "templates/checklist-metadata.yml",
    "templates/deployment-steps-template.md",
    "templates/handoffs/plan-approval.md",
    "templates/issues-file-template.md",
    ".playbook/installation.json",
  ]) assert(existsSync(join(directTarget, path)), `direct install is missing ${path}`);
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
  assert(!existsSync(join(directTarget, "harness")), "source-only harness/ leaked into the target");
  assert(!existsSync(join(directTarget, "templates/agents-md-template.md")), "maintainer-only template leaked into the target");

  const gitignorePath = join(directTarget, ".gitignore");
  const gitignore = readFileSync(gitignorePath, "utf8");
  assert(gitignore.startsWith(projectGitignore), "installer replaced existing project .gitignore rules");
  const gitignoreLines = new Set(gitignore.split("\n"));
  for (const rule of ["/.opencode/", "/.playbook/", "/phases/", "/playbook/", "/scripts/playbook-miss.mjs", "/templates/checklist-item-template.md", "/templates/handoffs/", "/verification/telemetry/events.ndjson"]) {
    assert(gitignoreLines.has(rule), `.gitignore is missing ${rule}`);
  }
  assert(gitignoreLines.has("/docs/Repository-Structure.md"), ".gitignore does not ignore an installed framework document");
  assert(!gitignoreLines.has("/docs/Usage.md"), ".gitignore hides a preserved project-owned document");
  for (const tracked of ["/docs/", "/verification/"]) {
    assert(!gitignoreLines.has(tracked), `.gitignore must not hide project-owned ${tracked}`);
  }

  const agentsPath = join(directTarget, "AGENTS.md");
  writeFileSync(agentsPath, "project-owned\n");
  run("scripts/install.mjs", ["install", `--target=${directTarget}`]);
  assert(readFileSync(agentsPath, "utf8") === "project-owned\n", "install did not preserve an existing file");
  const repeatedGitignore = readFileSync(gitignorePath, "utf8");
  assert(repeatedGitignore === gitignore, "reinstall duplicated or changed the managed .gitignore block");

  run("scripts/install.mjs", ["uninstall", `--target=${directTarget}`, "--force"]);
  const uninstalledGitignore = readFileSync(gitignorePath, "utf8");
  assert(!uninstalledGitignore.includes("AI-First Playbook framework"), "uninstall left the managed .gitignore block");
  assert(uninstalledGitignore === projectGitignore, "uninstall changed existing project .gitignore rules");

  const dryRunTarget = join(sandbox, "dry-run");
  run("scripts/install.mjs", ["install", `--target=${dryRunTarget}`, "--dry-run"]);
  assert(!existsSync(dryRunTarget), "dry-run wrote to the target");

  const noGitignoreTarget = join(sandbox, "no-gitignore");
  run("scripts/install.mjs", ["install", `--target=${noGitignoreTarget}`, "--no-gitignore", "--no-docs"]);
  assert(!existsSync(join(noGitignoreTarget, ".gitignore")), "--no-gitignore created .gitignore");
  assert(!existsSync(join(noGitignoreTarget, "docs")), "--no-docs installed docs");
  assert(!existsSync(join(noGitignoreTarget, "phases")), "--no-docs installed phases");
  assert(!existsSync(join(noGitignoreTarget, "templates")), "--no-docs installed templates");

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
  for (const path of ["scripts/install.mjs", "scripts/postinstall.mjs", "harness/opencode/command/verify.md", "docs/Usage.md", "phases/01-plan.md", "templates/checklist-item-template.md", "templates/checklist-metadata.yml", "templates/deployment-steps-template.md", "templates/handoffs/plan-approval.md", "templates/issues-file-template.md", "AGENTS.md"]) {
    assert(packedFiles.has(path), `required file is missing from npm package: ${path}`);
  }

  const npxTarget = join(sandbox, "npx-skip");
  mkdirSync(npxTarget);
  writeFileSync(join(npxTarget, "package.json"), JSON.stringify({ dependencies: { "@techierathore/ai-first-playbook": "latest" } }));
  run("scripts/postinstall.mjs", [], { cwd: root, env: { INIT_CWD: npxTarget, npm_command: "exec" } });
  assert(!existsSync(join(npxTarget, ".opencode")), "postinstall scaffold ran during npx execution");

  const packed = process.env.npm_execpath
    ? spawnSync(process.execPath, [process.env.npm_execpath, "pack", "--json", `--pack-destination=${sandbox}`], { cwd: root, encoding: "utf8" })
    : spawnSync("npm", ["pack", "--json", `--pack-destination=${sandbox}`], { cwd: root, encoding: "utf8" });
  if (packed.status !== 0) throw new Error(`npm pack for lifecycle test failed:\n${packed.stdout}${packed.stderr}`);
  const tarball = join(sandbox, basename(JSON.parse(packed.stdout)[0].filename));
  const npmTarget = join(sandbox, "npm-install");
  mkdirSync(npmTarget);
  const npmInstall = process.env.npm_execpath
    ? spawnSync(process.execPath, [process.env.npm_execpath, "install", tarball], { cwd: npmTarget, encoding: "utf8" })
    : spawnSync("npm", ["install", tarball], { cwd: npmTarget, encoding: "utf8" });
  if (npmInstall.status !== 0) throw new Error(`npm install lifecycle test failed:\n${npmInstall.stdout}${npmInstall.stderr}`);
  for (const path of [".opencode/command/verify.md", "AGENTS.md", "playbook/environment-profile.yml", ".playbook/installation.json"]) {
    assert(existsSync(join(npmTarget, path)), `plain npm install did not scaffold ${path} into the project root`);
  }
  assert(existsSync(join(npmTarget, "node_modules/@techierathore/ai-first-playbook")), "npm did not retain its dependency package");

  console.log("installer tests passed");
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}
