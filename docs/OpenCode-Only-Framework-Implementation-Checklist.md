# OpenCode-Only Framework Implementation Checklist

**Feature state:** verified  
**Created:** 2026-09-01T19:44:43Z  
**Scope:** Remove all Claude Code integration from the AI-First Playbook and enforce OpenCode-only behavior.

## Status Table

| ID | Item | Status | Misses | Evidence |
|---|---|---|---|---|
| OC-001 | Remove Claude Code adapter artifacts and ignored local configuration | pass | MISS-20260901-178829186493506095556203685008360 | Fresh 354-file scan excluded only this checklist and found 0 markers/artifacts |
| OC-002 | Make YOLO supervision, prompts, and guardrail policies OpenCode-only | pass | - | Fresh guardrail suite and direct OpenCode dry-run/removed-option probes passed |
| OC-003 | Make model routing and miss telemetry OpenCode-only | pass | - | Fresh 24/24 miss checks and OpenCode routing probes passed |
| OC-004 | Replace Claude parity validation/tests with OpenCode-only rejection gates | pass | - | Fresh validation and negative guardrail gates passed |
| OC-005 | Remove Claude Code integration references from framework documentation | pass | MISS-20260902-178832396309000395852217471838650, MISS-20260902-178832554127300801341913028999155 | 100-file link audit, source scan, and exact long-form materiality checks passed |
| OC-006 | Prove npm and target installation contain only OpenCode runtime/user assets | pass | - | Fresh 75-file tarball installed 73 OpenCode-only target files |
| OC-007 | Run source, policy, telemetry, installer, package, and packed-CLI verification | pass | MISS-20260902-178832397198414589995842893072461 | npm 11.5.1 full gate and transport-level regression passed |

## Root Cause And Miss

The previous run regenerated the Claude Code adapter even though the Playbook is OpenCode-only.
The loaded project context was not treated as an authoritative scope constraint, and generated-copy
drift was fixed by restoring an integration that should have been deleted. This is recorded as
`MISS-20260901-178829186493506095556203685008360` (`scope-creep`, `instruction-ignored`).

## YOLO Decisions

- 2026-09-01T19:44:43Z - Created this checklist because no governing checklist/status matrix existed for the package-slimming run; this restores the single build-and-verify contract; reverse by archiving it only after all items independently pass.
- 2026-09-01T19:44:43Z - Delete Claude Code adapters, generator paths, hooks, settings, tests, and documentation because the framework is OpenCode-only; reverse only through a separately approved future feature.
- 2026-09-01T19:44:43Z - Keep `anthropic/claude-*` model IDs where they are OpenCode provider model identifiers, because model identity is not Claude Code integration; reverse by changing the OpenCode provider tier map.
- 2026-09-01T19:44:43Z - Add negative validation for Claude Code integration artifacts and terms so this scope regression cannot recur; reverse by changing the validator and tests through an approved checklist.
- 2026-09-02T04:36:00Z - Used repository npm scripts and source assertions because the distributable environment profile contains placeholders; reverse by replacing the profile placeholders and following its commands in a target project.
- 2026-09-02T04:36:00Z - Did not deploy or publish because this is local package verification and Deployment Steps says none; reverse only through the separate human release process.
- 2026-09-02T04:36:00Z - Continued with parallel parent-session probes after all child launches were refused by the session depth limit; reverse by enabling deeper child sessions for a future run.
- 2026-09-02T04:41:00Z - Ran the full gate through ephemeral npm 11.5.1 because local npm 10.9.8 is below the declared engine; reverse by removing the ephemeral npm cache entry if desired.
- 2026-09-02T04:50:07Z - Automatically ran the user-specified repository, package, and packed-install verification gates under YOLO approval; reverse by deleting only `verification/opencode-only/20260902-opencode-only-verify-02/`.
- 2026-09-02T04:50:07Z - Continued with concurrent parent-session probes after both requested child verifiers were refused by the session-depth limit; reverse by enabling deeper child sessions for a future run.
- 2026-09-02T04:50:07Z - Did not deploy, publish, stage, or commit because Deployment Steps is none and the user explicitly prohibited those actions; no reversal is needed.
- 2026-09-02T09:46:40Z - Recovered long-form OpenCode documentation after an over-broad cleanup and retained only integration-specific removals; reverse only with the repository owner's pre-run backup because exact uncommitted deltas are unavailable.
- 2026-09-02T09:58:45Z - Ran the user-specified fresh source, documentation, npm 11.5.1, package, and packed-install gates under YOLO pre-approval; reverse by deleting only `verification/opencode-only/20260902-opencode-only-verify-03/`.
- 2026-09-02T09:58:45Z - Used repository verification scripts and the exact user-supplied command because the distributable environment profile contains placeholders and this static package run needs no app, DB, browser, service, or secret; reverse by configuring the profile for a future target-application run.
- 2026-09-02T09:58:45Z - Did not deploy, publish, stage, commit, or rewrite history because Deployment Steps is none and the user prohibited those actions; no reversal is needed.

## Checklist Items

<!-- metadata: {"schema":1,"id":"OC-001","title":"Remove Claude Code adapter artifacts and ignored local configuration","owner":"orchestrator","priority":"P0","risk":"high","status":"pass","created_at":"2026-09-01T19:44:43Z","updated_at":"2026-09-02T09:58:45Z","evidence":[{"run_id":"20260902-opencode-only-verify-01","verdict":"PASS","observed_at":"2026-09-02T04:42:00Z","links":["verification/opencode-only/20260902-opencode-only-verify-01/source-scan.mjs","verification/opencode-only/20260902-opencode-only-verify-01/git-status-ignored.txt"]},{"run_id":"20260902-opencode-only-verify-03","verdict":"PASS","observed_at":"2026-09-02T09:58:45Z","links":["verification/opencode-only/20260902-opencode-only-verify-03/source-scan.txt","verification/opencode-only/20260902-opencode-only-verify-03/prepublish-npm-11.5.1.txt"]}],"misses":["MISS-20260901-178829186493506095556203685008360"]} -->
- [x] **OC-001 - Remove Claude Code adapter artifacts and ignored local configuration**
  - Type: config
  - Behavior: No Claude Code harness, hooks, settings, shim, MCP pack, generator, or ignored local integration remains.
  - Location: `harness/claude-code/`, `.claude/`, `.gitignore`, `scripts/harness-install.mjs`
  - Logging: None.
  - Acceptance: Repository and ignored-file scans find no Claude Code adapter artifact.
  - Verify: Filesystem scan plus OpenCode-only validator.
  - Coding Standards: Minimal deletion; preserve unrelated OpenCode behavior.
  - **Verifier Result** (2026-09-02): PASS — Evidence: `source-scan.mjs` scanned 208 source files (excluding only this checklist) with 0 prohibited markers/artifacts; focused present/ignored scans found none, and `npm run validate` exited 0.
  - **Verifier Result** (2026-09-02): PASS — Evidence: Fresh final-tree scan covered 354 source/evidence/installed files, excluded exactly this active checklist, found 0 prohibited integration markers and 0 prohibited artifacts, and npm 11.5.1 validation passed.

<!-- metadata: {"schema":1,"id":"OC-002","title":"Make YOLO supervision prompts and guardrail policies OpenCode-only","owner":"orchestrator","priority":"P0","risk":"high","status":"pass","created_at":"2026-09-01T19:44:43Z","updated_at":"2026-09-02T09:58:45Z","evidence":[{"run_id":"20260902-opencode-only-verify-01","verdict":"PASS","observed_at":"2026-09-02T04:42:00Z","links":["verification/opencode-only/20260902-opencode-only-verify-01/yolo-dry-run"]},{"run_id":"20260902-opencode-only-verify-03","verdict":"PASS","observed_at":"2026-09-02T09:58:45Z","links":["verification/opencode-only/20260902-opencode-only-verify-03/prepublish-npm-11.5.1.txt","verification/opencode-only/20260902-opencode-only-verify-03/yolo-direct.txt"]}],"misses":[]} -->
- [x] **OC-002 - Make YOLO supervision prompts and guardrail policies OpenCode-only**
  - Type: cross-cutting
  - Behavior: YOLO launches and resumes only OpenCode; no `/goal`, Claude hook dialect, or Claude binary option remains.
  - Location: `scripts/playbook-yolo.mjs`, `AGENTS.md`, OpenCode commands/agents/plugins, templates and phase rules.
  - Logging: Existing YOLO state and cycle logs remain unchanged.
  - Acceptance: OpenCode dry-run/resume and policy tests pass; forbidden git writes remain denied.
  - Verify: OpenCode-only unit checks and source scan.
  - Coding Standards: Keep current sentinels and rate-limit behavior.
  - **Verifier Result** (2026-09-02): PASS — Evidence: `npm run test:guardrails` exited 0 with guardrail and YOLO policy checks; YOLO dry-run launched `opencode run --auto`, removed `--claude-bin` was rejected with exit 2, and behavioral tests denied forbidden git writes.
  - **Verifier Result** (2026-09-02): PASS — Evidence: Fresh guardrail/YOLO policy tests passed; a direct dry-run emitted `opencode run --auto`, and the removed binary option was rejected with exit 2.

<!-- metadata: {"schema":1,"id":"OC-003","title":"Make model routing and miss telemetry OpenCode-only","owner":"orchestrator","priority":"P0","risk":"high","status":"pass","created_at":"2026-09-01T19:44:43Z","updated_at":"2026-09-02T09:58:45Z","evidence":[{"run_id":"20260902-opencode-only-verify-01","verdict":"PASS","observed_at":"2026-09-02T04:42:00Z","links":[]},{"run_id":"20260902-opencode-only-verify-03","verdict":"PASS","observed_at":"2026-09-02T09:58:45Z","links":["verification/opencode-only/20260902-opencode-only-verify-03/prepublish-npm-11.5.1.txt","verification/opencode-only/20260902-opencode-only-verify-03/regression-gates.txt"]}],"misses":[]} -->
- [x] **OC-003 - Make model routing and miss telemetry OpenCode-only**
  - Type: backend-service
  - Behavior: Harness vocabulary and model routing accept only OpenCode while preserving Anthropic models used through OpenCode.
  - Location: `playbook/model-tiers.yml`, routing scripts, `scripts/miss-lib.mjs`, telemetry tests.
  - Logging: Existing OpenCode telemetry schema remains compatible.
  - Acceptance: `claude-code` is rejected and `opencode` records still validate.
  - Verify: Routing, miss, and telemetry tests.
  - Coding Standards: No backward compatibility for the removed unshipped integration.
  - **Verifier Result** (2026-09-02): PASS — Evidence: `npm run test:misses` passed 24 checks; focused `buildMissRecord` probe returned 0 errors for `opencode` and rejected `claude-code`; routing status/print resolved all tiers to valid `anthropic/claude-*` OpenCode provider IDs.
  - **Verifier Result** (2026-09-02): PASS — Evidence: Fresh miss telemetry suite passed 24/24 checks, and routing status/print resolved every command and agent tier to valid OpenCode provider model IDs.

<!-- metadata: {"schema":1,"id":"OC-004","title":"Replace Claude parity validation tests with OpenCode-only rejection gates","owner":"orchestrator","priority":"P0","risk":"high","status":"pass","created_at":"2026-09-01T19:44:43Z","updated_at":"2026-09-02T09:58:45Z","evidence":[{"run_id":"20260902-opencode-only-verify-01","verdict":"PASS","observed_at":"2026-09-02T04:42:00Z","links":["verification/opencode-only/20260902-opencode-only-verify-01/source-scan.mjs"]},{"run_id":"20260902-opencode-only-verify-03","verdict":"PASS","observed_at":"2026-09-02T09:58:45Z","links":["verification/opencode-only/20260902-opencode-only-verify-03/source-scan.txt","verification/opencode-only/20260902-opencode-only-verify-03/prepublish-npm-11.5.1.txt"]}],"misses":[]} -->
- [x] **OC-004 - Replace Claude parity validation/tests with OpenCode-only rejection gates**
  - Type: tests
  - Behavior: Validation fails when Claude Code integration artifacts or integration terms return.
  - Location: `scripts/playbook-validate.mjs`, `scripts/test-guardrails.mjs`, installer/package tests.
  - Logging: Validation errors name the prohibited artifact.
  - Acceptance: Positive OpenCode checks pass and a maintained deny-list covers Claude integration markers.
  - Verify: Full validation and targeted negative assertions.
  - Coding Standards: Do not reject `anthropic/claude-*` OpenCode model identifiers.
  - **Verifier Result** (2026-09-02): PASS — Evidence: `npm run validate` and `npm run test:guardrails` exited 0; targeted fixtures named and rejected every deny-list marker/artifact while accepting `anthropic/claude-sonnet-5` and the intentionally excluded active checklist.
  - **Verifier Result** (2026-09-02): PASS — Evidence: Fresh validation and OpenCode-only negative guardrail tests passed while the independent current-tree deny-list scan found 0 prohibited markers/artifacts.

<!-- metadata: {"schema":1,"id":"OC-005","title":"Remove Claude Code integration references from framework documentation","owner":"orchestrator","priority":"P0","risk":"medium","status":"pass","created_at":"2026-09-01T19:44:43Z","updated_at":"2026-09-02T09:58:45Z","evidence":[{"run_id":"20260902-opencode-only-verify-01","verdict":"FAIL","observed_at":"2026-09-02T04:42:00Z","links":["verification/opencode-only/20260902-opencode-only-verify-01/source-scan.mjs","verification/opencode-only/20260902-opencode-only-verify-01/link-audit.mjs"]},{"run_id":"20260902-opencode-only-verify-02","verdict":"PASS","observed_at":"2026-09-02T04:50:07Z","links":["verification/opencode-only/20260902-opencode-only-verify-01/source-scan.mjs","verification/opencode-only/20260902-opencode-only-verify-01/link-audit.mjs"]},{"run_id":"20260902-opencode-only-verify-03","verdict":"PASS","observed_at":"2026-09-02T09:58:45Z","links":["verification/opencode-only/20260902-opencode-only-verify-03/source-scan.txt","verification/opencode-only/20260902-opencode-only-verify-03/link-audit.txt","verification/opencode-only/20260902-opencode-only-verify-03/doc-integrity-structure.txt"]}],"misses":["MISS-20260902-178832396309000395852217471838650","MISS-20260902-178832554127300801341913028999155"]} -->
- [x] **OC-005 - Remove Claude Code integration references from framework documentation**
  - Type: docs
  - Behavior: Framework documentation describes only OpenCode installation, operation, telemetry, routing, and YOLO behavior.
  - Location: Root README, `docs/`, `harness/README.md`, templates, phases.
  - Logging: None.
  - Acceptance: Scans find no Claude Code integration language; OpenCode provider model names remain valid.
  - Verify: Documentation scan and relative-link audit.
  - Coding Standards: Remove obsolete prose rather than retaining migration compatibility.
  - **Verifier Result** (2026-09-02): FAIL — Evidence: Integration-language scan passed across 208 files, but `node verification/opencode-only/20260902-opencode-only-verify-01/link-audit.mjs .` exited 1 with broken `Enablement.md` links at `README.md:194` and `README.md:222`; no such file exists.
    - Suggested fix: Restore and package the intended `Enablement.md`, or replace both README links/references with an existing maintained document.
  - **Verifier Result** (2026-09-02): PASS — Evidence: Fresh real audit scanned exactly 100 Markdown files with 0 broken relative links; the 208-file source/artifact scan excluded only this active checklist and found 0 prohibited integration markers or artifacts while OpenCode routing retained valid `anthropic/claude-*` provider model IDs.
  - **Verifier Result** (2026-09-02): PASS — Evidence: Fresh 100-file relative-link audit and 354-file final-tree integration scan passed; exact materiality checks preserved Getting Started 601, Brownfield 537, Greenfield 540, Telemetry 232, and YOLO 244 lines with 16–41 headings, 2,217–5,363 words, and all required substantive sections.

<!-- metadata: {"schema":1,"id":"OC-006","title":"Prove npm and target installation contain only OpenCode runtime and user assets","owner":"orchestrator","priority":"P0","risk":"high","status":"pass","created_at":"2026-09-01T19:44:43Z","updated_at":"2026-09-02T09:58:45Z","evidence":[{"run_id":"20260902-opencode-only-verify-01","verdict":"PASS","observed_at":"2026-09-02T04:42:00Z","links":["verification/opencode-only/20260902-opencode-only-verify-01/pack.json","verification/opencode-only/20260902-opencode-only-verify-01/installed-target"]},{"run_id":"20260902-opencode-only-verify-03","verdict":"PASS","observed_at":"2026-09-02T09:58:45Z","links":["verification/opencode-only/20260902-opencode-only-verify-03/pack.json","verification/opencode-only/20260902-opencode-only-verify-03/installed-target","verification/opencode-only/20260902-opencode-only-verify-03/installed-assets.txt","verification/opencode-only/20260902-opencode-only-verify-03/installed-source-scan.txt"]}],"misses":[]} -->
- [x] **OC-006 - Prove npm and target installation contain only OpenCode runtime and user assets**
  - Type: tests
  - Behavior: npm and installed targets contain OpenCode runtime/user assets and no Claude Code artifacts.
  - Location: `package.json`, `scripts/install.mjs`, `scripts/test-install.mjs`
  - Logging: Installer summary remains OpenCode-specific.
  - Acceptance: Dry-run package and real tarball install pass explicit positive and negative assertions.
  - Verify: `npm run test:install`, `npm pack`, packed `npx` install.
  - Coding Standards: Keep the explicit allowlist.
  - **Verifier Result** (2026-09-02): PASS — Evidence: Installer tests passed; real tarball contained 75 files (209,979 bytes) with required OpenCode assets and 0 prohibited artifacts; packed CLI installed 73 target files whose independent marker scan found 0 hits.
  - **Verifier Result** (2026-09-02): PASS — Evidence: Fresh 75-file, 242,115-byte tarball installed 73 target files; all 15 required OpenCode assets were present and the independent 72-file installed-source scan found 0 prohibited markers/artifacts.

<!-- metadata: {"schema":1,"id":"OC-007","title":"Run source policy telemetry installer package and packed CLI verification","owner":"verifier","priority":"P0","risk":"high","status":"pass","created_at":"2026-09-01T19:44:43Z","updated_at":"2026-09-02T09:58:45Z","evidence":[{"run_id":"20260902-opencode-only-verify-01","verdict":"FAIL","observed_at":"2026-09-02T04:42:00Z","links":["verification/opencode-only/20260902-opencode-only-verify-01/pack.json","verification/opencode-only/20260902-opencode-only-verify-01/source-scan.mjs","verification/opencode-only/20260902-opencode-only-verify-01/link-audit.mjs"]},{"run_id":"20260902-opencode-only-verify-02","verdict":"PASS","observed_at":"2026-09-02T04:50:07Z","links":["verification/opencode-only/20260902-opencode-only-verify-01/link-audit.mjs","verification/opencode-only/20260902-opencode-only-verify-01/source-scan.mjs","verification/opencode-only/20260902-opencode-only-verify-02/package/techierathore-ai-first-playbook-0.1.0.tgz","verification/opencode-only/20260902-opencode-only-verify-02/installed-target"]},{"run_id":"20260902-opencode-only-verify-03","verdict":"PASS","observed_at":"2026-09-02T09:58:45Z","links":["verification/opencode-only/20260902-opencode-only-verify-03/prepublish-npm-11.5.1.txt","verification/opencode-only/20260902-opencode-only-verify-03/source-scan.txt","verification/opencode-only/20260902-opencode-only-verify-03/link-audit.txt","verification/opencode-only/20260902-opencode-only-verify-03/pack.json","verification/opencode-only/20260902-opencode-only-verify-03/installed-target"]}],"misses":["MISS-20260902-178832397198414589995842893072461"]} -->
- [x] **OC-007 - Run source, policy, telemetry, installer, package, and packed-CLI verification**
  - Type: tests
  - Behavior: The complete OpenCode-only framework passes all gates and transport-level installation.
  - Location: Repository-wide.
  - Logging: Verification commands and outcomes are appended below.
  - Acceptance: Validation, guardrail, miss, installer, package, link/dependency audit, and packed install all pass.
  - Verify: Fresh full suite and tarball installation outside the repository.
  - Coding Standards: No commit, staging, or history rewrite.
  - **Verifier Result** (2026-09-02): FAIL — Evidence: Validation, guardrail, 24 miss, installer, 75-file package, dependency, source-scan, YOLO, and real packed-CLI gates passed (including npm 11.5.1), but the required link audit failed on two broken README links.
    - Suggested fix: Resolve the two `Enablement.md` README links, then rerun the link audit and `npm run prepublishOnly`.
  - **Verifier Result** (2026-09-02): PASS — Evidence: Fresh npm 11.5.1 `prepublishOnly` passed validation, guardrails, 24 miss checks, installer tests, and the 75-file pack gate; the 100-file link and 208-file source audits passed, and a fresh 75-file tarball installed 73 target files with 0 prohibited markers/artifacts.
  - **Verifier Result** (2026-09-02): PASS — Evidence: Exact npm 11.5.1 `prepublishOnly` passed validation, guardrails, 24/24 misses, installer and 75-file pack gates; fresh source/link/materiality audits and a real packed-CLI install all passed.

## Infrastructure Requirements

None. Verification uses local Node.js/npm and temporary directories only.

## Deployment Steps

None. Publishing remains a human action after review and commit.

## Verifier Run Log

### Run on 2026-09-02 04:42 UTC

- Run ID: `20260902-opencode-only-verify-01`
- Environment: Linux/WSL host; Playwright N/A (no UI items); distributable environment profile remains a placeholder as explicitly permitted for this repository-only run.
- Tooling: Node 22.23.2; local npm/npx 10.9.8; ephemeral npm 11.5.1; curl and `ss` present; NuGet config N/A. The declared npm version was used for the final full gate.
- Apps/DB: N/A — OpenCode framework/package verification only; no service, browser, database, secret, deployment, or publication used.
- Deployment Steps: None; publishing remains deferred to the human release process.
- Parallelization: five child sub-verifiers were launched together but refused by the session depth limit; independent bucket probes then ran concurrently in the parent session. This did not block any item.
- Bucket counts: artifact/config 1 PASS; YOLO/policy 1 PASS; routing/telemetry 1 PASS; validator 1 PASS; docs/link 1 FAIL; installer/package 1 PASS; aggregate build/test gate 1 FAIL. DATA-GAP 0; BLOCKED 0; out-of-scope skipped 0.
- Exact commands and outcomes:
  - `npm run validate` — exit 0, including post-evidence regression run.
  - `npm run test:guardrails` — exit 0: negative validation, write guardrails, YOLO policy, and telemetry accounting passed.
  - `npm run test:misses` — exit 0: 24/24 checks passed.
  - `npm run test:install` — exit 0.
  - `npm run prepublishOnly` — exit 0 under local npm 10.9.8.
  - `npx --yes npm@11.5.1 run prepublishOnly` — exit 0 under the package's declared npm baseline.
  - `npm ls --all` — exit 0 with an empty dependency tree.
  - `node scripts/playbook-routing.mjs status && node scripts/playbook-routing.mjs print` — exit 0; 22 mapped files, valid OpenCode tier models.
  - `node scripts/playbook-yolo.mjs --cwd=verification/opencode-only/20260902-opencode-only-verify-01/yolo-dry-run --prompt='/verify YOLO docs/Feature-Implementation-Checklist.md' --dry-run` — exit 0; emitted `opencode run --auto`.
  - `node scripts/playbook-yolo.mjs --cwd=verification/opencode-only/20260902-opencode-only-verify-01/yolo-dry-run --prompt=x --claude-bin=forbidden --dry-run` — exit 2; unknown removed option rejected.
  - `node verification/opencode-only/20260902-opencode-only-verify-01/source-scan.mjs .` — exit 0; 208 files, 0 marker hits, 0 prohibited artifacts, only this checklist excluded.
  - `node verification/opencode-only/20260902-opencode-only-verify-01/link-audit.mjs .` — exit 1; 100 Markdown files, broken links at `README.md:194` and `README.md:222`.
  - `npm pack --pack-destination verification/opencode-only/20260902-opencode-only-verify-01/package --json` — exit 0; 75 files, 209,979-byte tarball; details in `pack.json`.
  - `npm exec --yes --package ./verification/opencode-only/20260902-opencode-only-verify-01/package/techierathore-ai-first-playbook-0.1.0.tgz -- ai-first-playbook install --target=verification/opencode-only/20260902-opencode-only-verify-01/installed-target` — exit 0; 73 installed files and 0 prohibited marker hits.
  - `git diff --check` — exit 0; no commit, staging, or history rewrite performed.
- FAIL items: OC-005 and OC-007. Both trace to the same two missing `Enablement.md` link targets in README.
- Miss telemetry: closed linked `MISS-20260901-178829186493506095556203685008360` as pass for OC-001; opened `MISS-20260902-178832396309000395852217471838650` for OC-005 and `MISS-20260902-178832397198414589995842893072461` for OC-007. No CLI refusals; telemetry did not affect outcomes or the overall verdict.
- Verdict: 2 FAILs (5 PASS / 7 in scope).
- Deliverables: checklist annotations/status/run log are in this file; reproducible non-report evidence is under `verification/opencode-only/20260902-opencode-only-verify-01/`. No separate report file produced (per Rule 6).

### Run on 2026-09-02 04:50 UTC

- Run ID: `20260902-opencode-only-verify-02`
- Environment: Linux container; Playwright N/A (no UI items); the distributable profile placeholders were not required because this repository-only run used the exact user-specified Node/package gates and no app, DB, browser, service, or secret.
- Tooling: Node 22.23.2; local npm/npx 10.9.8; ephemeral npm 11.5.1; curl and `ss` present; NuGet config N/A. `dotnet`, `jq`, and `sqlcmd` were absent and not required.
- Apps/DB: N/A — OpenCode framework/package verification only.
- Deployment Steps: None; no deployment, publication, staging, commit, or history write was performed.
- Parallelization: source/docs and build/package child verifiers were launched together but refused by the session-depth limit; equivalent independent parent-session probes then ran concurrently. This did not block any gate.
- Bucket counts: targeted docs/source 1 PASS; aggregate build/package 1 PASS; regression coverage 5 prior PASS items remained valid; DATA-GAP 0; BLOCKED 0; out-of-scope skipped 0.
- Exact commands and outcomes:
  - `node verification/opencode-only/20260902-opencode-only-verify-01/link-audit.mjs .` — exit 0; exactly 100 Markdown files and 0 broken relative links.
  - `node verification/opencode-only/20260902-opencode-only-verify-01/source-scan.mjs .` — exit 0; 208 files, 0 prohibited marker hits, 0 prohibited artifacts, and only this active checklist excluded for its intentional root-cause terms.
  - `node scripts/playbook-routing.mjs status && node scripts/playbook-routing.mjs print` — exit 0; OpenCode routing retained the valid `anthropic/claude-opus-5`, `anthropic/claude-sonnet-5`, and `anthropic/claude-haiku-4-5` provider model IDs.
  - `npx --yes npm@11.5.1 run prepublishOnly` — exit 0; validation, guardrails, 24/24 miss checks, installer tests, and 75-file pack dry run passed.
  - `npm ls --all` — exit 0 with an empty dependency tree.
  - `npm pack --pack-destination verification/opencode-only/20260902-opencode-only-verify-02/package --json` — exit 0; 75 files, 209,940-byte tarball.
  - Packed CLI install into `verification/opencode-only/20260902-opencode-only-verify-02/installed-target` — exit 0; 73 installed files, all 6 asserted OpenCode assets present, and the independent 72-file installed-source scan found 0 prohibited marker hits/artifacts.
  - `git diff --check` — exit 0; line-ending advisory only, with no whitespace error.
- PASS items: OC-005 and OC-007 were freshly reverified; OC-001, OC-002, OC-003, OC-004, and OC-006 retained PASS through the full regression suite.
- DATA-GAP count + setup needed: 0; no test-data setup is needed.
- BLOCKED items: 0.
- Skipped out-of-scope items: 0.
- Miss telemetry: closed linked `MISS-20260902-178832396309000395852217471838650` for OC-005 and `MISS-20260902-178832397198414589995842893072461` for OC-007 as `verdict_after=pass`, `fix_phase=verify`, attempt 1 through the approved CLI. No CLI refusals; telemetry did not affect item outcomes or the overall verdict.
- Handoff packet: producer `verifier`; consumer `human acceptance`; accountable approver `repository maintainer`; identity `OpenCode verifier`; timestamp `2026-09-02T04:50:07Z`; transition `verification-failed -> verified`; evidence links are the scripts and run directory listed above; open decisions none; escalation owner `repository maintainer`; exception expiry N/A (no exception).
- Verdict: ALL PASS (7/7 in scope).
- Deliverables: inline checklist annotations, Status Table, metadata, feature state, and this Run Log entry are in this file; reproducible non-report evidence is under `verification/opencode-only/20260902-opencode-only-verify-02/`. No separate report file produced (per Rule 6).

### Run on 2026-09-02 09:58 UTC

- Run ID: `20260902-opencode-only-verify-03`
- Environment: Linux container; Playwright N/A (no UI items). The distributable environment profile contains placeholders, but this repository-only run used the exact user-specified Node/package gate and required no app, DB, browser, service, credential, or secret.
- Tooling: Node 22.23.2; local npm/npx 10.9.8; exact gate via ephemeral npm 11.5.1; curl and `ss` available; no `nuget.config`. `dotnet`, `jq`, and `rg` were absent and not required; Node replaced only the supplemental documentation structure count.
- Apps/DB: N/A — static OpenCode framework/package verification only; base URLs and DB environment do not apply.
- Deployment Steps: None. No deploy, publish, staging, commit, or history write was performed.
- Parallelization: four child sub-verifiers were launched concurrently but refused by the configured session-depth limit; six independent parent-session buckets then ran concurrently. This did not block any gate.
- Bucket counts: source/policy/telemetry regression 4 PASS; documentation/link/materiality 1 PASS; installer/package 1 PASS; aggregate build/test gate 1 PASS; DATA-GAP 0; BLOCKED 0.
- Exact commands and outcomes:
  - `node verification/opencode-only/20260902-opencode-only-verify-01/source-scan.mjs .` — exit 0; 354 files scanned, only this active checklist excluded, 0 prohibited marker hits, 0 prohibited artifacts.
  - `node verification/opencode-only/20260902-opencode-only-verify-01/link-audit.mjs .` — exit 0; exactly 100 Markdown files, 0 broken relative links.
  - `node verification/opencode-only/20260902-opencode-only-verify-03/verify-doc-integrity.mjs` — exit 0; exact lengths 601/537/540/232/244, 16–41 headings, 2,217–5,363 words, and all required substantive sections present.
  - `npx --yes npm@11.5.1 run prepublishOnly` — exit 0; validation, guardrails, 24/24 miss checks, installer tests, and 75-file pack dry run passed.
  - `npm ls --all` — exit 0 with an empty dependency tree; routing status/print retained valid OpenCode provider model IDs; `git diff --check` exited 0.
  - Direct YOLO dry-run — exit 0 and emitted `opencode run --auto`; removed binary option probe — exit 2 as required.
  - `npm pack --pack-destination verification/opencode-only/20260902-opencode-only-verify-03/package --json` — exit 0; 75 files, 242,115-byte tarball.
  - Real packed CLI install — exit 0; 73 installed target files, all 15 required OpenCode assets present, 72 installed source files scanned with 0 prohibited markers/artifacts.
- PASS items: OC-001 through OC-007. Build/test gate: PASS.
- DATA-GAP count + setup needed: 0; no test-data setup is needed.
- BLOCKED items: 0.
- Skipped out-of-scope items: 0 within the user-requested OC-001 through OC-007 scope.
- Miss telemetry: linked prior misses for OC-001, OC-005 link repair, and OC-007 were already closed as pass; freshly closed still-live `MISS-20260902-178832554127300801341913028999155` as `verdict_after=pass`, `fix_phase=verify`, attempt 1, exact run `20260902-opencode-only-verify-03`, through the approved CLI with `--harness=opencode`. No CLI refusals; telemetry did not affect outcomes or the overall verdict.
- Handoff packet: producer `verifier`; consumer `human acceptance`; accountable approver `repository maintainer`; identity `OpenCode verifier`; timestamp `2026-09-02T09:58:45Z`; transition `verification-in-progress -> verified`; evidence links are the run directory listed above; open decisions none; escalation owner `repository maintainer`; exception expiry N/A.
- Verdict: ALL PASS (7/7 in scope).
- Deliverables: inline checklist annotations, Status Table, metadata, feature state, YOLO Decisions, and this Run Log entry are in this file; reproducible non-report evidence is under `verification/opencode-only/20260902-opencode-only-verify-03/`. No separate report file produced (per Rule 6).
