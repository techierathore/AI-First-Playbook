# Installation

## From npm (OpenCode)

```bash
npx @ai-first/playbook@latest --target="/absolute/path/to/project"
```

Preview first with `--dry-run`. Existing files are kept. To upgrade package-managed files:

```bash
npx @ai-first/playbook@latest --target="/absolute/path/to/project" --force
```

The installer adds `.opencode/`, `opencode.json`, `AGENTS.md`, `Context-Prompt.md`,
`playbook/environment-profile.yml`, docs and onboarding. Replace the profile placeholders, then
restart OpenCode. It does not create secrets, start application services or guess commands.

## From A Clone (OpenCode)

```bash
git clone <repository-url> ai-first-playbook
node ai-first-playbook/scripts/install.mjs --target="/absolute/path/to/project"
```

PowerShell:

```powershell
git clone <repository-url> ai-first-playbook
node .\ai-first-playbook\scripts\install.mjs --target="C:\work\my-project"
```

Terminal/macOS/Linux uses the same `node` command with a POSIX path. The installer creates a
missing target folder. Use `--uninstall --force` only after reviewing the dry run.

## Claude Code

The same framework runs on Claude Code via a generated pack (same command bodies, the
guardrail as a PreToolUse hook, the Verifier as a subagent):

```bash
git clone <repository-url> ai-first-playbook
node ai-first-playbook/scripts/harness-install.mjs claude-code --target="/absolute/path/to/project"
```

This installs `.claude/commands/`, `.claude/agents/`, `.claude/hooks/`,
`.claude/settings.json`, `CLAUDE.md` (imports `@AGENTS.md`) and `.mcp.json`. Add `AGENTS.md`
from `templates/agents-md-template.md` and fill in `playbook/environment-profile.yml`, exactly
as for OpenCode. If the target already has a `.claude/settings.json`, merge the pack's `hooks`
block into it by hand. Both harnesses can coexist in one repository — OpenCode reads
`AGENTS.md` and ignores `CLAUDE.md`.

## Model tiers (both harnesses)

Commands ship tier-stamped: planning on the frontier model, build/verify on standard,
mechanical commands on economy (`playbook/model-tiers.yml`). To substitute your own models:

```bash
# edit playbook/model-tiers.yml, then
node scripts/apply-model-tiers.mjs              # restamps the OpenCode frontmatter
node scripts/harness-install.mjs claude-code    # regenerates the Claude Code pack
node scripts/apply-model-tiers.mjs --check      # CI-friendly consistency check
```

## Windows

Run the harness inside WSL, not on Windows directly — see
[OpenCode-Guide.md](OpenCode-Guide.md) for the full corporate deployment guide (SSL
certificates, proxy, topology) and `scripts/provision-wsl.sh` for the scripted setup.

Package maintainers should use the separate GUI-friendly [`Npm-Publishing-Guide.md`](Npm-Publishing-Guide.md).
