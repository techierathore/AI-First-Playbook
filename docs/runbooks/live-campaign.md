# Runbook — Live OpenCode Grading Campaign (PB-34)

PB-33 proves the packed package installs and every runtime script works from the installed copy,
and that OpenCode resolves the runtime. PB-34 is the part a grader cannot run: a real model taking
the Team Inventory feature through `/feature-plan`, `/implement`, `/verify` and `/fix` on that
installed copy. Run it on a laptop or VM with a model provider; never publish the package or bump
its version during the campaign.

## Before you start

- Node.js 22.14.0+ and npm 11.5.1+ (`node --version`, `npm --version`).
- OpenCode at the supported version in `package.json` `opencode.supported`, logged in to a model
  provider interactively (no key on the command line).
- A clean checkout of this repository at the commit being graded.

## Steps

1. From the checkout: `node scripts/playbook-grade.mjs docs/Playbook-Requirements.md` — note the
   `N of M graded` line; PB-01, PB-19 and PB-33 must pass on this machine.
2. Pack and install into a throwaway project:

   ```bash
   npm pack --pack-destination /tmp && T=$(mktemp -d) && cd "$T" && npm init -y >/dev/null
   npm exec --yes --package=/tmp/techierathore-ai-first-playbook-<version>.tgz -- ai-first-playbook install
   ```

3. Give it a tiny application (an HTTP server with an assets list and a CSV import is enough),
   fill `.playbook/environment-profile.yml`, and confirm `node .playbook/scripts/playbook-probe.mjs`
   prints only `ok` lines.
4. Copy `tests/phase/fixtures/team-inventory-brd.md` into `docs/team-inventory/` and run, each in a
   fresh OpenCode session:
   - `/feature-plan @docs/team-inventory/team-inventory-brd.md` — then approve with
     `handoff-record.mjs create plan-approval`.
   - `/implement @docs/team-inventory/<checklist>` — `phase-complete.mjs build` must pass at the end.
   - Plant the duplicate-import defect (import answers success, writes no rows).
   - `/verify @docs/team-inventory/<checklist>` — expect FAIL on the import items with evidence,
     and a linked miss.
   - `/fix` then a fresh `/verify` — expect ALL PASS.
5. Run it once more in YOLO mode (`/implement YOLO …`) and confirm no git history was written and
   the last line is a `PLAYBOOK_RUN_COMPLETE:` or `PLAYBOOK_RUN_BLOCKED:` sentinel.

## Record the result

- Keep the checklist, the handoff records and `verification/telemetry/misses.ndjson` from the
  throwaway project; copy redacted OpenCode logs (lines with `BLOCKED`, tool names, verdicts and
  the sentinel, project path replaced by `<target>`) to `tests/live/transcripts/PB-34-*.log`.
- Log every deviation with `node scripts/playbook-miss.mjs open ... --protocol=...` in this
  repository.
- PB-34 stays ungraded until a scripted replay of a recorded real-model campaign exists.
