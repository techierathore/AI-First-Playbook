# Phase 4 — Self-review (build + smoke test)

**Persona:** Orchestrator (inside `/implement`, and again inside `/fix`)

Before declaring done, the orchestrator re-reads the checklist and confirms each item
against its **own diff**, then proves the build actually runs:

1. `dotnet build` on every touched .NET project; `npm run build` on the frontend if
   touched.
2. Ask the user to start the apps locally — or offer to start them.
3. One `curl` per new/touched endpoint, confirming the response status.
4. **Query the real database** for data-touching items — *"a 200 with no data written is
   a FAIL, not a pass."*
5. One Playwright snapshot per new/touched page, confirming it renders.
6. One log grep per new sync/job for the required INFO line.
7. Kill any apps it started; declare done **with a smoke-test summary**; update the
   checklist Status Table.

If self-review catches a genuine defect (not routine implementation churn), it may record
a miss with `found_by=self-review` and `found_phase=self-review`, link the returned or
collapsed ID in item metadata, and record an addressed miss as `deferred` after self-test.
It must not claim telemetry `pass`; the independent Verifier is authoritative. Miss writes
are fire-and-forget and cannot change the self-review result.

## Rules

- The smoke test uses the Developer-Flow-Guide as the execution script: for each value,
  the **screen, the API response, and the DB row must agree**.
- Green build ≠ smoke test. The forbidden excuses ("no SQL access", "can't run the web
  app", "can't run the Windows app") apply here exactly as they do to the Verifier.
- **Only the user may authorize skipping the smoke test.**

This self-check catches runtime breakage cheaply during build. It does not replace
anything: the independent Verifier still does the deep audit next.

**Next:** [Phase 5 — Verify](05-verify.md)
