# Decision Log

## ADR-001 — Ship the Playbook as a sibling repo ("team edition"), not merged into TechieFlow

**Date:** 2026-08-05
**Status:** Accepted
**Deciders:** Techie Rathore (owner); analysis by Claude Code

### Context

Two assets exist, sharing one philosophy (spec → build → independently verify, with an
agent that must *prove* work by executing it):

- **TechieFlow** (github.com/techierathore/TechieFlow) — public, Apache-2.0, explicitly a
  **"Solo-Dev Delivery Framework"** for one person + Claude Max shipping .NET/Blazor/MAUI
  apps. Compressed 5-phase flow (Day-1 → Split → Build → Verify → Handoff), its own
  Verifier agent (headless Playwright / Appium + `dotnet test`, hook-enforced verify
  ledger), 27 tasks, dual Claude-Code/OpenCode harness. The multi-role, story-by-story
  flow was **deliberately trimmed on 2026-06-12** — solo focus is a design decision, not
  an accident.
- **AI-First Development Playbook** (private, built at the office) — a team-scale process
  on OpenCode + BMAD v4: a 10-step lifecycle with 4 gates, a 13-command library (core
  loop: `/feature-plan` → `/implement` → `/verify` → `/fix`), an independent Verifier
  native agent (Playwright MCP, `verification/` dotnet integration-test runners, optional
  Windows-app bridge), a prescribed document set, and 42 documented process gotchas.
  Adoption at the office stalled at **2 of 15 developers**.

**Hard constraint:** public ship date 2026-08-11. Merging is allowed ONLY if it fits in
one weekend / two days of Claude Code (Opus) work; otherwise default to sibling +
cross-link.

### Options considered

**A. Merge the Playbook into TechieFlow.**
An honest merge is not a docs copy-paste; it requires:
1. Reconciling two different, working verification systems (TechieFlow's Vidur verifier
   with guard-verify ledger vs the Playbook's OpenCode native Verifier with inline
   checklist annotation) or shipping two verifiers under one roof with a routing story.
2. Reconciling two vocabularies and document sets (REQ-rows / one-checklist-per-app vs
   `*-FullStack-Implementation-Checklist` / Status Table / Run Log / Verified History).
3. Rewriting TechieFlow's 888-line README and its positioning — reversing the 2026-06-12
   solo-only trim on a live public repo.
4. Handling third-party BMAD v4 content (the Playbook rides on it; TechieFlow doesn't).
5. Full sanitization of employer-internal material (required in every option).

Items 1–3 alone exceed two days at any model tier, and carry regression risk on a repo
users already consume. **Fails the hard constraint.**

**B. Sibling repo, cross-linked (chosen).**
"One philosophy at two scales": TechieFlow = solo edition, Playbook = team edition. Each
repo keeps its coherent, tested identity; the Playbook gets a clean public telling
without disturbing a live repo; sanitization is the only mandatory heavy work before
Aug 11. Skeleton achievable same-day; content port is a bounded conversion pipeline.

### Decision

**Sibling repo.** Not merely by default: even without the deadline, the merge is the
worse design — the two frameworks share philosophy but have divergent, individually
coherent implementations, and TechieFlow's sharpest asset is its unambiguous solo
positioning. Cross-links in both READMEs carry the "one philosophy, two scales" story at
zero structural cost. A future merge remains possible; an unmerge after Aug 11 would not
be.

### Consequences

- This repo (`AI-First-Playbook`) is the team edition. TechieFlow's README gets a short
  "Team edition" cross-link section (snippet in SHIP-PLAN.md — owner applies it, since
  TechieFlow commits are owner-manual by policy).
- BMAD v4 stock content is **not** redistributed here. The repo documents the process and
  ships only original work (command specs, Verifier spec, templates, diagrams), with
  attribution pointing to upstream BMAD-METHOD.
- All employer-internal names are sanitized per the ledger in SHIP-PLAN.md.

### Fidelity notes (source vs. earlier working descriptions)

Recorded so the public repo never overstates or misstates the source:

- The lifecycle in the source Playbook is **10 numbered steps, 4 of them gates** — not 7
  phases. This repo ships the real 10-step structure (`phases/01…10`).
- The command library is **13 commands**, with a **4-command core loop**
  (`/feature-plan`, `/implement`, `/verify`, `/fix`). "Four-command library" undersells
  the source; the README presents "4 core + 9 supporting".
- The Verifier's toolset per source: Playwright MCP (accessibility tree + screenshots),
  self-written dotnet integration tests / SQL runner consoles under `verification/`,
  environment probing, real-config-only rule, optional Windows-app bridge (FlaUI). Code
  audit is the explicit last resort.

## ADR-002 — License: Apache-2.0

**Date:** 2026-08-05 · **Status:** Accepted

Original spec said MIT; owner confirmed Apache-2.0 is also acceptable. Apache-2.0 chosen
to match TechieFlow exactly, so content can move between the two editions with zero
license friction. Upstream BMAD-METHOD (MIT) is referenced, not redistributed; if any
BMAD-derived text is ever included, carry its MIT notice alongside.
