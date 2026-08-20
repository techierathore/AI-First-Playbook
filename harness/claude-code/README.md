# Claude Code harness pack

GENERATED from `harness/opencode/` + `playbook/model-tiers.yml` by
`scripts/harness-install.mjs claude-code` — do not hand-edit generated files
(`commands/`, `agents/`, `hooks/write-policy.mjs`, `settings.json`,
`CLAUDE.md`, `mcp.json`); edit the sources and regenerate.
`hooks/spec-guardrails-hook.mjs` is authored and maintained here.

## Install

```bash
node scripts/harness-install.mjs claude-code --target=/path/to/your-repo
```

Then add `AGENTS.md` (from templates/agents-md-template.md) and
`playbook/environment-profile.yml` to the target, as for OpenCode.
If the target already has `.claude/settings.json`, merge the `hooks` block
from this pack's settings.json into it by hand.

Smoke-test the guardrail exactly as harness/README.md describes: plant a
bug, run /verify, confirm the FAIL lands inline in the checklist and that
writing `Anything-Gap-Report.md` is blocked.
