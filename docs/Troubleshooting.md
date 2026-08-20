# Troubleshooting

| Symptom | Action |
|---|---|
| Plugin not loaded | Restart OpenCode and validate `opencode.json`. |
| `DATA-GAP` | Seed approved synthetic data and verify again; do not release. |
| `BLOCKED` | Resolve the profile blocker or record an expiring exception. |
| Secret in evidence | Rotate it, remove the artifact and rerun with redaction. |
| Verifier write denied | Write only the selected checklist or `verification/<feature>/<run-id>/`. |
| A phase runs on the wrong / expensive model | Command-frontmatter `model:` overrides the model picked in the TUI — that is by design. Check the stamps with `node scripts/apply-model-tiers.mjs --check`; change tiers in `playbook/model-tiers.yml` and restamp. |
| Guardrail not blocking in Claude Code | Confirm `.claude/settings.json` registers the PreToolUse hook and `node` is on PATH. Test directly: `echo '{"tool_name":"Write","tool_input":{"file_path":"x-Gap-Report.md"}}' \| node .claude/hooks/spec-guardrails-hook.mjs` must exit 2. |
| CI error `write-policy.mjs drift` or `regenerate the pack` | The generated Claude Code pack is stale. Run `node scripts/harness-install.mjs claude-code` and commit the result. |
| Telemetry file empty or missing | Start the harness with `PLAYBOOK_TELEMETRY=1`. Launching the **Windows** OpenCode binary from WSL additionally needs `WSLENV=PLAYBOOK_TELEMETRY` (custom env vars do not cross the WSL→Windows boundary by default). |
| Playwright MCP never connects (OpenCode) | The URL must use `{env:PLAYWRIGHT_MCP_URL}` — OpenCode does not expand `${VAR}` syntax. Set the variable, enable the server in `opencode.json`, restart. |
| TLS / certificate errors on a corporate network | Install the corporate CA into the OS trust store (WSL: `update-ca-certificates`) — see [OpenCode-Guide.md](OpenCode-Guide.md) §4. Never disable TLS verification; no such option exists and none should be added. |
