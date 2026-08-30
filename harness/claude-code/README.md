# Claude Code harness pack

GENERATED from `harness/opencode/` + `playbook/model-tiers.yml` by
`scripts/harness-install.mjs claude-code` — do not hand-edit generated files
(`commands/`, `agents/`, `hooks/write-policy.mjs`, `settings.json`,
`CLAUDE.md`, `mcp.json`); edit the sources and regenerate.
`hooks/spec-guardrails-hook.mjs` and `hooks/yolo-hook.mjs` are authored and maintained here.

## Install

```bash
node scripts/harness-install.mjs claude-code --target=/path/to/your-repo
```

Then add `AGENTS.md` (from templates/agents-md-template.md) and
`playbook/environment-profile.yml` to the target, as for OpenCode.
If the target already has `.claude/settings.json`, merge the `hooks` block
from this pack's settings.json into it by hand. Target files are preserved
unless `--force` is explicit. The installer also delivers the miss/telemetry
scripts plus the environment profile and model-tier runtime.

Smoke-test the guardrail exactly as harness/README.md describes: plant a
bug, run /verify, confirm the FAIL lands inline in the checklist and that
writing `Anything-Gap-Report.md` is blocked.

## YOLO (unattended) mode

`hooks/yolo-hook.mjs` is registered for PreToolUse and PermissionRequest but does
nothing unless `PLAYBOOK_YOLO=1` is set. With it set, every tool call is
auto-approved except git history/index/ref writes, which are blocked (exit 2).
Run unattended with the supervisor, which sets the variable, waits out usage
limits and resumes the session:

```bash
node scripts/playbook-yolo.mjs --harness=claude-code --cwd=/path/to/your-repo \
     --prompt "/implement docs/<Feature>-Implementation-Checklist.md"
```

See docs/YOLO-Mode-Guide.md.
