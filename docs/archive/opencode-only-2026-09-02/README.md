# HISTORICAL — OpenCode-only verification campaigns of 2026-09-02

This folder is a read-only historical record. Nothing here is run, installed or maintained, and no
current document depends on it. It moved here from `verification/opencode-only/` and
`verification/yolo/` in reset Session 8 (2026-09-26) because the owner approved no external
evidence store; it is kept inside the repository instead.

| Campaign | What it proved |
|---|---|
| `20260902-opencode-only-verify-01` | 5 of 7 items passed; the link audit found 2 broken README links. |
| `20260902-opencode-only-verify-02` | The failed scope was rerun: 7 of 7 PASS. |
| `20260902-opencode-only-verify-03` | All 7 items repeated; 354 files scanned for removed integration markers, 100 Markdown files with 0 broken links, a 75-file npm archive packed, 73 target files installed, 72 installed source files scanned with 0 banned markers. |
| `yolo-supervisor-state` | The YOLO supervisor state and log of the run that built the OpenCode-only checklist. |

The checklist that these campaigns verified is
`docs/archive/checklists/OpenCode-Only-Framework-Implementation-Checklist.md`; its 27 evidence
links point here.

**Integrity.** `MANIFEST.sha256` holds the SHA-256 of every file and a tree hash over them.
`node scripts/archive-manifest.mjs docs/archive/opencode-only-2026-09-02 --check` fails if any
file changes. Retention: the owner's one-year period for graded verdicts applies; removal is an
owner decision.

**The durable proof is now rerunnable.** The same checks — source scan for removed integration
markers, relative-link audit, document structure, packed install and installed-source scan — run
on every grader pass as `node tests/opencode-only/run.mjs PB-15`, against the current tree.
