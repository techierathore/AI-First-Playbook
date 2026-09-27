# Troubleshooting

| Symptom | Action |
|---|---|
| Plugin not loaded | Restart OpenCode and validate `opencode.json`. |
| `DATA-GAP` | Seed approved synthetic data and verify again; do not release. |
| `BLOCKED` | Resolve the profile blocker or record an expiring exception. |
| Secret in evidence | Rotate it, remove the artifact and rerun with redaction. |
| Verifier write denied | Write only the selected checklist or `verification/<feature>/<run-id>/`. |
| A phase runs on the wrong / expensive model | Command-frontmatter `model:` overrides the model picked in the TUI. Inspect the affected file under `.opencode/command/` or `.opencode/agent/`; remove its `model:` field to use the session model. A framework source checkout also provides optional routing utilities, but they are not part of the target install. |
| Telemetry file empty or missing | Start OpenCode with `PLAYBOOK_TELEMETRY=1`; setting it after startup is too late. Restart and preserve missing windows as unavailable. |
| Playwright MCP never connects (OpenCode) | The URL must use `{env:PLAYWRIGHT_MCP_URL}` — OpenCode does not expand `${VAR}` syntax. Set the variable, enable the server in `opencode.json`, restart. |
| Still prompted in YOLO mode | Confirm `PLAYBOOK_YOLO=1` reached OpenCode before startup, then restart. See [YOLO-Mode-Guide.md](YOLO-Mode-Guide.md). |
| Build phase stopped with "run /implement again for remaining items" | Re-run `/implement YOLO @checklist`; the command must plan further waves instead of handing back unfinished items. |
| Supervisor stopped on a provider limit | Inspect `verification/yolo/state.json` and `rate-limit.json`; resume the same state after the buffered retry time. |
| TLS / certificate errors on a corporate network | Install the corporate CA into the OS trust store (WSL: `update-ca-certificates`) — see [OpenCode-WSL-Setup-Guide.md](OpenCode-WSL-Setup-Guide.md) Phase 3–4. Never disable TLS verification; no such option exists and none should be added. |
