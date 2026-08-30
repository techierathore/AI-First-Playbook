#!/usr/bin/env node
/**
 * harness-install.mjs — the adapter boundary as a script (docs/Adapter-Design.md).
 *
 * Generates a harness pack from the canonical framework sources
 * (harness/opencode command/agent bodies + playbook/model-tiers.yml) and
 * optionally installs it into a target repository. Command bodies are never
 * forked — only frontmatter, file locations, and the guardrail carrier differ
 * per harness.
 *
 * Usage:
 *   node scripts/harness-install.mjs claude-code                  # (re)generate harness/claude-code/
 *   node scripts/harness-install.mjs claude-code --target=/repo   # generate + install into /repo/.claude
 *   node scripts/harness-install.mjs opencode --target=/repo      # install harness/opencode into /repo/.opencode
 *   Add --force to overwrite existing target files; default is preserve.
 *
 * Claude Code notes:
 *   - Command `model:` frontmatter is honored (verified live on Claude Code
 *     2.1.237) but undocumented; the pack also stamps subagent models
 *     (documented), so routing survives even if command-level stamping stops
 *     working — see docs/Adapter-Design.md.
 *   - The guardrail is a PreToolUse hook consuming the same write-policy.mjs
 *     as the OpenCode plugin; the YOLO carrier (PreToolUse + PermissionRequest
 *     hook) consumes the same yolo-policy.mjs as the OpenCode yolo.ts plugin.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, cpSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseTiersYaml, resolveModel, splitMarkdown, routingEnabled, UNROUTED_TIERS } from "./tier-lib.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const [harness] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const targetArg = process.argv.find((a) => a.startsWith("--target="));
const target = targetArg ? resolve(targetArg.slice("--target=".length)) : null;
const force = process.argv.includes("--force");

if (!["claude-code", "opencode"].includes(harness ?? "")) {
  console.error("usage: node scripts/harness-install.mjs <claude-code|opencode> [--target=/path/to/repo] [--force]");
  process.exit(1);
}

const tiers = parseTiersYaml(readFileSync(join(root, "playbook/model-tiers.yml"), "utf8"));
// Routing is OFF by default (model-tiers.yml `enabled:`); when off the pack carries no model: stamps.
const routed = (tier) => routingEnabled(tiers) && tier && !UNROUTED_TIERS.has(tier);
const packDir = join(root, "harness/claude-code");

// ── Claude Code pack generation ─────────────────────────────────────────────

const VOCAB_PREAMBLE =
  "> Harness note (Claude Code): where this prompt says the `task` tool, use the\n" +
  "> `Agent` tool; spawn the named subagent types it asks for. Parallel means\n" +
  "> multiple Agent calls in one message.\n\n";

const VERIFY_PREAMBLE =
  "**IMPORTANT — independence gate:** delegate ALL of the work below to the\n" +
  "`verifier` subagent in a single Agent call (fresh, isolated context — it must\n" +
  "have no memory of the build). Pass it the user's input verbatim plus the full\n" +
  "instructions below. Do NOT verify inline in this session; if the Agent tool is\n" +
  "unavailable, stop and tell the user instead of proceeding inline.\n\n";

const AGENT_TOOLS = {
  analyst: "Read, Grep, Glob, Edit, Write",                 // bash: deny (mirrors opencode.json)
  orchestrator: "Read, Grep, Glob, Edit, Write, Bash, Agent",
  builder: "Read, Grep, Glob, Edit, Write, Bash",
  verifier: "Read, Grep, Glob, Edit, Write, Bash",          // no Agent: CC subagents cannot nest
};

function generateClaudeCodePack() {
  for (const d of ["commands", "agents", "hooks"]) mkdirSync(join(packDir, d), { recursive: true });

  // commands
  for (const file of readdirSync(join(root, "harness/opencode/command")).filter((f) => f.endsWith(".md"))) {
    const name = file.replace(/\.md$/, "");
    const { fields, body } = splitMarkdown(readFileSync(join(root, "harness/opencode/command", file), "utf8"));
    const tier = tiers.commands?.[name];
    const head = ["---"];
    if (fields.description) head.push(`description: ${fields.description}`);
    if (routed(tier)) head.push(`model: ${resolveModel(tiers.tiers, tier, "claude-code")}`);
    head.push("---", "");
    let preamble = "";
    if (fields.agent === "verifier" || fields.subtask === "true") preamble += VERIFY_PREAMBLE;
    if (body.includes("`task`")) preamble += VOCAB_PREAMBLE;
    const translated = body
      .replaceAll(".opencode/agent/", ".claude/agents/")
      .replaceAll(".opencode/plugin/", ".claude/hooks/")
      .replaceAll("spec-guardrails.ts", "spec-guardrails-hook.mjs")
      .replaceAll("--harness=opencode", "--harness=claude-code");
    writeFileSync(join(packDir, "commands", file), head.join("\n") + preamble + translated);
  }

  // agents
  for (const file of readdirSync(join(root, "harness/opencode/agent")).filter((f) => f.endsWith(".md"))) {
    const name = file.replace(/\.md$/, "");
    const { fields, body } = splitMarkdown(readFileSync(join(root, "harness/opencode/agent", file), "utf8"));
    const tier = tiers.agents?.[name];
    const head = ["---", `name: ${name}`];
    head.push(`description: ${(fields.description ?? name).replace(/\s+/g, " ").trim()}`);
    if (AGENT_TOOLS[name]) head.push(`tools: ${AGENT_TOOLS[name]}`);
    if (routed(tier)) head.push(`model: ${resolveModel(tiers.tiers, tier, "claude-code")}`);
    head.push("---", "");
    const translated = body.replaceAll("--harness=opencode", "--harness=claude-code");
    writeFileSync(join(packDir, "agents", file), head.join("\n") + translated);
  }

  // guardrail carrier + shared policy
  cpSync(join(root, "harness/opencode/plugin/write-policy.mjs"), join(packDir, "hooks/write-policy.mjs"));
  cpSync(join(root, "harness/opencode/plugin/yolo-policy.mjs"), join(packDir, "hooks/yolo-policy.mjs"));
  // the two hook carriers are authored, not generated — keep the existing ones.
  for (const authored of ["hooks/spec-guardrails-hook.mjs", "hooks/yolo-hook.mjs"]) {
    if (!existsSync(join(packDir, authored))) throw new Error(`harness/claude-code/${authored} missing — it is authored, not generated`);
  }

  // settings: PreToolUse guardrail registration + the YOLO carrier (inert unless PLAYBOOK_YOLO=1).
  // Order matters: spec-guardrails runs first so a forbidden write is blocked before YOLO can allow it.
  writeFileSync(join(packDir, "settings.json"), JSON.stringify({
    hooks: {
      PreToolUse: [
        {
          matcher: "Write|Edit|NotebookEdit|Bash",
          hooks: [{ type: "command", command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/spec-guardrails-hook.mjs"' }],
        },
        {
          matcher: "",
          hooks: [{ type: "command", command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/yolo-hook.mjs"' }],
        },
      ],
      PermissionRequest: [
        {
          matcher: "",
          hooks: [{ type: "command", command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/yolo-hook.mjs"' }],
        },
      ],
    },
  }, null, 2) + "\n");

  // standing-rules shim: OpenCode prefers AGENTS.md and ignores this file, so
  // both harnesses can coexist in one repo.
  writeFileSync(join(packDir, "CLAUDE.md"),
    "@AGENTS.md\n\n" +
    "<!-- Claude Code shim: the standing rules live in AGENTS.md (imported above)\n" +
    "     so OpenCode and Claude Code read the same contract. Edit AGENTS.md,\n" +
    "     not this file. -->\n");

  // MCP registration (Claude Code reads .mcp.json; ${VAR} expansion is native here)
  writeFileSync(join(packDir, "mcp.json"), JSON.stringify({
    mcpServers: {
      playwright: { type: "http", url: "${PLAYWRIGHT_MCP_URL}" },
    },
  }, null, 2) + "\n");

  writeFileSync(join(packDir, "README.md"),
    "# Claude Code harness pack\n\n" +
    "GENERATED from `harness/opencode/` + `playbook/model-tiers.yml` by\n" +
    "`scripts/harness-install.mjs claude-code` — do not hand-edit generated files\n" +
    "(`commands/`, `agents/`, `hooks/write-policy.mjs`, `settings.json`,\n" +
    "`CLAUDE.md`, `mcp.json`); edit the sources and regenerate.\n" +
    "`hooks/spec-guardrails-hook.mjs` and `hooks/yolo-hook.mjs` are authored and maintained here.\n\n" +
    "## Install\n\n" +
    "```bash\n" +
    "node scripts/harness-install.mjs claude-code --target=/path/to/your-repo\n" +
    "```\n\n" +
    "Then add `AGENTS.md` (from templates/agents-md-template.md) and\n" +
    "`playbook/environment-profile.yml` to the target, as for OpenCode.\n" +
    "If the target already has `.claude/settings.json`, merge the `hooks` block\n" +
    "from this pack's settings.json into it by hand. Target files are preserved\n" +
    "unless `--force` is explicit. The installer also delivers the miss/telemetry\n" +
    "scripts plus the environment profile and model-tier runtime.\n\n" +
    "Smoke-test the guardrail exactly as harness/README.md describes: plant a\n" +
    "bug, run /verify, confirm the FAIL lands inline in the checklist and that\n" +
    "writing `Anything-Gap-Report.md` is blocked.\n\n" +
    "## YOLO (unattended) mode\n\n" +
    "`hooks/yolo-hook.mjs` is registered for PreToolUse and PermissionRequest but does\n" +
    "nothing unless `PLAYBOOK_YOLO=1` is set. With it set, every tool call is\n" +
    "auto-approved except git history/index/ref writes, which are blocked (exit 2).\n" +
    "Run unattended with the supervisor, which sets the variable, waits out usage\n" +
    "limits and resumes the session:\n\n" +
    "```bash\n" +
    "node scripts/playbook-yolo.mjs --harness=claude-code --cwd=/path/to/your-repo \\\n" +
    "     --prompt \"/implement docs/<Feature>-Implementation-Checklist.md\"\n" +
    "```\n\n" +
    "See docs/YOLO-Mode-Guide.md.\n");

  console.log(`generated ${packDir.replace(root, "")}`);
}

// ── install into a target repo ──────────────────────────────────────────────

function ensureSafeInstallTarget(targetRoot) {
  if (targetRoot === resolve(root)) throw new Error("Refusing to install a generated pack into the framework source directory");
  if (targetRoot === "/" || targetRoot === resolve(process.env.HOME || "/")) throw new Error("Refusing to install into a filesystem or home root");
  if (existsSync(targetRoot) && !statSync(targetRoot).isDirectory()) throw new Error(`Target is not a directory: ${targetRoot}`);
}

function installInto(targetRoot) {
  const runtime = [
    "scripts/playbook-miss.mjs",
    "scripts/miss-lib.mjs",
    "scripts/playbook-telemetry.mjs",
    "playbook/model-tiers.yml",
    "playbook/environment-profile.yml",
  ];
  const missingSources = runtime.filter((item) => !existsSync(join(root, item)));
  if (missingSources.length) throw new Error(`Package is missing required telemetry runtime: ${missingSources.join(", ")}`);

  const put = (src, dst) => {
    if (statSync(src).isDirectory()) {
      if (!existsSync(dst)) mkdirSync(dst, { recursive: true });
      for (const child of readdirSync(src)) put(join(src, child), join(dst, child));
      return;
    }
    const exists = existsSync(dst);
    if (exists && !force) { console.log(`preserve ${dst}`); return; }
    mkdirSync(dirname(dst), { recursive: true });
    cpSync(src, dst, { force: true });
    console.log(`${exists ? "overwrite" : "install  "} ${dst}`);
  };
  if (harness === "opencode") {
    put(join(root, "harness/opencode"), join(targetRoot, ".opencode"));
    put(join(root, "opencode.json"), join(targetRoot, "opencode.json"));
  } else {
    put(join(packDir, "commands"), join(targetRoot, ".claude/commands"));
    put(join(packDir, "agents"), join(targetRoot, ".claude/agents"));
    put(join(packDir, "hooks"), join(targetRoot, ".claude/hooks"));
    put(join(packDir, "settings.json"), join(targetRoot, ".claude/settings.json"));
    put(join(packDir, "CLAUDE.md"), join(targetRoot, "CLAUDE.md"));
    put(join(packDir, "mcp.json"), join(targetRoot, ".mcp.json"));
  }
  for (const item of runtime) put(join(root, item), join(targetRoot, item));
  const missing = runtime.filter((item) => !existsSync(join(targetRoot, item)));
  if (missing.length) throw new Error(`Telemetry runtime verification failed; missing: ${missing.join(", ")}`);
  console.log(`verified telemetry runtime (${runtime.length} files)`);
  console.log(`installed ${harness} pack into ${targetRoot}`);
  console.log("Next: add AGENTS.md at the target root (templates/agents-md-template.md) and fill in playbook/environment-profile.yml.");
}

if (target) ensureSafeInstallTarget(target);
if (harness === "claude-code") generateClaudeCodePack();
if (target) installInto(target);
