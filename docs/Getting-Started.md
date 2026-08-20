# Getting Started

1. Pick your harness: **OpenCode** (the original) or **Claude Code** (generated pack) — same
   commands, same process. See [Installation.md](Installation.md) for both paths. On Windows,
   run the whole stack in WSL: [OpenCode-Guide.md](OpenCode-Guide.md) and
   `scripts/provision-wsl.sh`.
2. Run the npm installer or clone and run `scripts/install.mjs` (OpenCode), or
   `scripts/harness-install.mjs claude-code --target=...` (Claude Code).
3. Replace placeholders in `playbook/environment-profile.yml` (including `project_type`).
4. Model tiers: the defaults in `playbook/model-tiers.yml` work out of the box — planning
   phases run frontier, build/verify run standard, mechanical commands run economy. To use
   different models, edit the tier map and run `node scripts/apply-model-tiers.mjs`
   (then regenerate the Claude Code pack if you use it).
5. Restart OpenCode (Claude Code re-reads commands automatically).
6. Smoke test: run `/verify` on a small checklist with a planted defect — the FAIL must land
   **inline** in the checklist, and writing any `*-Gap-Report.md` must be blocked.
7. Run `/feature-plan`, plan approval, `/implement`, `/verify`, acceptance and release readiness.
8. Optional — per-phase cost telemetry: start the harness with `PLAYBOOK_TELEMETRY=1`, then
   `node scripts/playbook-telemetry.mjs --checklist=<path>` emits per-phase records
   (phase, model, tier, tokens, cost, attempt, gate verdict). See
   [Telemetry-Hooks.md](Telemetry-Hooks.md).

For a live demonstration, use `Greenfield-Case-Study.md` or `Brownfield-Case-Study.md`.
