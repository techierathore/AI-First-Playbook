---
description: Independently verify a built feature against its checklist
agent: verifier
subtask: true
model: anthropic/claude-sonnet-5
---

Read `playbook/environment-profile.yml` before probing. All URLs, ports, commands, config paths,
database methods, browser endpoints, logs and cleanup come from that profile; ask for missing
values rather than use examples or defaults. Never put secrets in arguments, Markdown, logs or
evidence.

Verify the implementation against the checklist and supporting documents.

## User's full input
$ARGUMENTS

## How to parse the input
The user's input contains:
1. **File paths** — the implementation checklist and optionally the verification
   guide and DB changes document. Read ALL referenced files.
2. **Additional instructions** — any extra focus areas or constraints. Examples:
   - "Only verify the UI items for now"
   - "The app is running on http://localhost:3000"
   - "Skip Playwright, do code audit only"
   - "Focus on the cost sync service, ignore the report UI"

## Required context
You must have:
- **Implementation checklist** (REQUIRED) - e.g., `ImplDocs/CostDocs/App-CostOptDashboard-FullStack-Implementation-Checklist.md`
- **Verification/testing guide** (helpful) - e.g., `ImplDocs/CostDocs/App-CostOptDashboard-Verification-Guide.md`
- **DB changes document** (helpful) - e.g., `ImplDocs/CostDocs/App-CostOptDashboard-DB-Changes.md`

If the user has NOT provided the checklist path, **ASK for it**.
Also ask for the verification guide and DB changes doc paths if not provided.

## What to verify
Go through EVERY item in the checklist and verify it using the method
specified in each item's "Verify" field. Follow the verification procedures
defined in the verifier agent instructions. If the user gave additional
instructions about scope or focus, respect those.

## Where to write the results
**Inline, in the checklist itself. There is no separate gap-report file.**

Append a `**Verifier Result**` line to each in-scope item, update the Status
Table, and append a run entry to `## Verifier Run Log` — all inside the
checklist the user pointed you at. Creating a `*-Gap-Report.md` (or any
other separate report file) violates Rule 6 of the verifier agent and is
blocked at the tool level by `.opencode/plugin/spec-guardrails.ts`.
