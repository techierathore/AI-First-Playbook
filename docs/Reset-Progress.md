# Reset Progress

The running record of the Playbook reset (`docs/Playbook-Reset-Plan.md` §8). Resume from the
first session not marked Done. The headline is the grader's output after that session:
`node scripts/playbook-grade.mjs docs/Playbook-Requirements.md`.

| Session | Goal | Status | Grader headline after the session |
|---:|---|---|---|
| 1 | Requirement list, grader, shared rules | Done 2026-09-26 | 6 of 18 graded; pass 6, fail 0, ungraded 12 |
| 2 | Live OpenCode enforcement | Not started | — |
| 3 | Verifier core plus adapters | Not started | — |
| 4 | Checklist and handoff schemas | Not started | — |
| 5 | Plan, build, fix, analyze commands | Not started | — |
| 6 | Document tools | Not started | — |
| 7 | Reader navigation | Not started | — |
| 8 | Historical proof and retention | Not started | — |
| 9 | Grading campaign and CI | Not started | — |

## Word counts (prose removed or moved)

| Session | File | Before | After | What left the prose, and where it went |
|---:|---|---:|---:|---|
| 1 | `AGENTS.md` | 943 | 485 | WSL stale-metadata procedure moved to `docs/OpenCode-WSL-Setup-Guide.md` §10f; YOLO and completion text compressed with no rule dropped. |
| 1 | `playbook/environment-profile.yml` | 119 | 149 | Grew: names the four secret channels and the retention periods as machine values. |

## Decisions taken

Decisions the run took alone, each the smaller reversible choice.

| Session | Decision | Why | How to reverse |
|---:|---|---|---|
| 1 | Supported OpenCode version recorded as 1.18.32 in `package.json` `opencode.supported`. | The owner's value was an unfilled placeholder; `opencode --version` from the current npm release `opencode-ai@1.18.32` printed it. It is a tested version, not a pin (Decisions 2026-08-20). | Change the field. |
| 1 | Grader verdicts go to `verification/telemetry/grades.ndjson`, committed like the miss stream; Session 8 sweeps records older than 365 days. | No external telemetry store is approved; GitHub artefacts cannot hold a year on a public repository. | Point `--telemetry` elsewhere and delete the file. |
| 1 | A check passes only on exit 0 plus a printed `<ID> pass` line; exit 77 plus `<ID> ungraded: <reason>` is ungraded (for example, OpenCode absent). | Makes "never infer PASS from missing output" mechanical. | Edit `scripts/playbook-grade.mjs`. |
| 1 | Live-model probes get their own ungraded IDs (PB-19 onward) with a runbook, instead of weakening PB-04/PB-05. | Keeps the 18 approved lines as written. | Merge the lines back. |
| 1 | Local checks ran on Node 22.22.2 with npm 10.9.7 (the container's npm); npm 11.20.0 is installed for the Session 9 campaign. | The container ships npm 10; every existing check passes on it. | — |
