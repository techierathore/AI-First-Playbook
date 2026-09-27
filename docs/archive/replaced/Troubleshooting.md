# Troubleshooting

| Symptom | Action |
|---|---|
| Plugin not loaded | Restart OpenCode and validate `opencode.json`. |
| `DATA-GAP` | Seed approved synthetic data and verify again; do not release. |
| `BLOCKED` | Resolve the profile blocker or record an expiring exception. |
| Secret in evidence | Rotate it, remove the artifact and rerun with redaction. |
| Verifier write denied | Write only the selected checklist or `verification/<feature>/<run-id>/`. |
| A phase runs on the wrong / expensive model | Command-frontmatter `model:` overrides the model picked in the TUI — that is by design. Check with `node scripts/playbook-routing.mjs status`; change tiers with `set-tier`, or turn routing `off` to run everything on the session model. |
| Telemetry file empty or missing | Start the harness with `PLAYBOOK_TELEMETRY=1`. Launching the **Windows** OpenCode binary from WSL additionally needs `WSLENV=PLAYBOOK_TELEMETRY` (custom env vars do not cross the WSL→Windows boundary by default). |
| Playwright MCP never connects (OpenCode) | The URL must use `{env:PLAYWRIGHT_MCP_URL}` — OpenCode does not expand `${VAR}` syntax. Set the variable, enable the server in `opencode.json`, restart. |
| Still prompted for permission in YOLO mode | `PLAYBOOK_YOLO=1` is not reaching OpenCode (WSL → Windows binary needs `WSLENV=$WSLENV:PLAYBOOK_YOLO`). See [YOLO-Mode-Guide.md](YOLO-Mode-Guide.md) §8. |
| Agent asked "Proceed?" despite YOLO | It did not see the trigger: put `YOLO` right after the command name, or run via `scripts/playbook-yolo.mjs`, which injects the rules. |
| Build phase stopped with "run /implement again for remaining items" | That is a completion-contract violation (AGENTS.md → "Build phase"). Re-run `/implement YOLO @checklist`; the updated command plans further waves instead of handing back. |
| Run died on "You've hit your … limit · resets …" | Start the phase through `scripts/playbook-yolo.mjs`; it parses the reset time, sleeps until reset + 15 min and resumes the session. `status` shows the retry time; `resume` continues after a reboot. |
| Supervisor slept past the reset by hours | Bare wall-clock times are read in the VM's local zone; set `PLAYBOOK_TZ=<IANA zone>` to the zone the harness prints in. |
| TLS / certificate errors on a corporate network | Install the corporate CA into the OS trust store (WSL: `update-ca-certificates`) — see [OpenCode-WSL-Setup-Guide.md](OpenCode-WSL-Setup-Guide.md) Phase 3–4 and [OpenCode-Guide.md](OpenCode-Guide.md) §4. Never disable TLS verification; no such option exists and none should be added. |
