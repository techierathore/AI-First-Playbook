# Mac and OpenCode 2 Progress

Running record of the `mac-and-opencode-2` branch: make the grader and the four npm test scripts
pass on macOS, in any time zone, and on OpenCode 2. Updated and pushed after each step.

| Step | Goal | Status |
|---:|---|---|
| 1 | CI on macos-latest and ubuntu-latest, TZ=UTC and TZ=Asia/Kolkata, OpenCode 1.18.32; reproduce the owner's 23 macOS failures | In progress |
| 2 | Fix every macOS and time-zone failure at its cause; record each as a miss | Not started |
| 3 | OpenCode 2: plugins load on 1.18.x and 2.x in the order telemetry, guardrails, YOLO; 2.0.18 in CI | Not started |
| 4 | Guard: a session without the guard plugins says so loudly at start; requirement line | Not started |
| 5 | Supported versions (1.18.32, 2.0.18) in `package.json` and the docs | Not started |

## Step 1 — CI

- Added `.github/workflows/platforms.yml`: matrix `os` × `tz` × `opencode`
  (`ubuntu-latest`, `macos-latest`) × (`UTC`, `Asia/Kolkata`) × (`1.18.32`), `fail-fast: false`;
  each job runs `validate`, `test:guardrails`, `test:misses`, `test:install` and the grader (each
  step runs even when an earlier one fails) and uploads `grader-output/`.
- Results: pending the first run.
