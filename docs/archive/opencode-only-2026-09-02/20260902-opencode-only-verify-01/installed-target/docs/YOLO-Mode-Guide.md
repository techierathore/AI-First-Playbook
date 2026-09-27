# YOLO Mode Guide — OpenCode Unattended Runs

YOLO mode lets OpenCode continue an approved Playbook goal without stopping at ordinary permission
or in-command approval prompts. It does not relax the single-checklist contract, secret rules,
Verifier write scope, evidence requirements, or the prohibition on agent-authored git history.

## 1. Activation paths

| Activation | Effect |
|---|---|
| Put the token `YOLO` in a Playbook command | Prompt-level gates are treated as pre-approved for that run and its delegated workers. |
| Start OpenCode with `PLAYBOOK_YOLO=1` | Activates prompt rules and the OpenCode permission/rate-limit plugin. |
| Run `scripts/playbook-yolo.mjs` from a source checkout | Starts/resumes headless OpenCode, injects unattended rules, persists state, and handles usage-limit waits. |

For a supervised goal:

```bash
node scripts/playbook-yolo.mjs --cwd=/path/to/repo --agent=orchestrator \
  --goal "Implement the approved checklist, verify, fix, and continue until every item PASSes"
```

Status and resume:

```bash
node scripts/playbook-yolo.mjs status --cwd=/path/to/repo
node scripts/playbook-yolo.mjs resume --cwd=/path/to/repo
```

For an interactive OpenCode TUI with mechanical permissions:

```bash
PLAYBOOK_YOLO=1 opencode
```

The variable must exist before OpenCode starts. When WSL launches a Windows executable, explicitly
forward it through `WSLENV`; native WSL OpenCode does not need that bridge.

## 2. Permission policy

`harness/opencode/plugin/yolo-policy.mjs` is the pure policy used by the OpenCode plugin and
source-checkout supervisor.

In active mode:

- ordinary file, shell, install, process, and read-only git operations may proceed;
- git history/index/ref/config/stash mutations are denied;
- publishing operations such as PR creation are denied;
- unknown git subcommands fail closed; and
- the stricter spec guardrail still blocks forbidden report/checklist writes first.

Without `PLAYBOOK_YOLO=1`, the permission plugin is inert and ordinary OpenCode permissions apply.

## 3. Prompt-level behavior

The standing rules and command bodies treat approval questions as pre-approved. The agent makes the
sensible decision, records one reversible line under `## YOLO Decisions` in the checklist, and
continues. Every delegated builder or verifier receives the mode explicitly.

Missing required input is still not guessed. A genuine external dependency is completed around,
then reported with what is missing and who supplies it.

## 4. Build completion contract

Unattended operation does not mean partial delivery. `/implement` must finish every item in scope,
move it to verification-ready state, or annotate a genuine infrastructure/external blocker and
supplier. Context pressure is solved with smaller slices and additional waves, not by handing the
remainder back to the operator.

`/fix` applies the same contract to the complete active FAIL set.

## 5. Rate-limit handling

When OpenCode reports a provider usage limit, `.opencode/plugin/yolo.ts` records normalized retry
information under `verification/yolo/rate-limit.json`. The external supervisor can then:

1. parse absolute, relative, wall-clock, and provider-reset hints;
2. apply the configured safety buffer (15 minutes by default);
3. persist `retryAt` and session identity in `verification/yolo/state.json`;
4. sleep until the safe retry time; and
5. resume the same OpenCode session and goal.

Use `PLAYBOOK_TZ=<IANA zone>` when provider text gives a bare local wall-clock time. A retry time
must be bounded by the policy maximum; unparseable limits use the documented conservative fallback.

## 6. State, logs, and sentinels

Supervisor state lives under `verification/yolo/`:

| Path | Purpose |
|---|---|
| `state.json` | Session, goal, cycle, retry, and outcome state. |
| `rate-limit.json` | Latest plugin-observed provider limit and normalized retry plan. |
| `supervisor.log` | Supervisor decisions and lifecycle. |
| `cycles/<n>.log` | OpenCode output for each run/resume cycle. |

The agent ends with exactly one sentinel:

- `PLAYBOOK_RUN_COMPLETE: <summary>` when the entire goal is complete.
- `PLAYBOOK_RUN_BLOCKED: <missing input and supplier>` when only a genuine external blocker remains.

An exit without a sentinel is a pause, not success. The supervisor nudges the same session and
stops after the configured consecutive no-outcome limit rather than looping forever.

## 7. Security

- Use a disposable VM/container or a dedicated working copy with development-scoped credentials.
- Never expose secrets in prompts, arguments, URLs, logs, evidence, or process dumps.
- Keep protected branches, release credentials, and production access outside the unattended
  environment unless an approved process explicitly requires them.
- Agents still never stage, commit, push, tag, rewrite history, or publish.
- Review working-tree changes, checklist decisions, evidence, and external-blocker annotations
  before a human commits or deploys.

## 8. Verification

Automated policy checks cover allowed operations, denied git/publishing forms, unknown git
subcommands, inactive-mode no-op behavior, rate-limit parsing, retry buffers, sentinels, and state
resume. A live smoke run should additionally prove the OpenCode plugin loads after restart and the
spec guardrail remains stricter than broad unattended permissions.

## 9. Troubleshooting

| Symptom | Action |
|---|---|
| OpenCode still prompts | Confirm `PLAYBOOK_YOLO=1` existed before startup and restart OpenCode. |
| Command asks for approval | Put the standalone token `YOLO` in the command or use the supervisor. |
| Git write is blocked | Expected. Leave the working tree for the human to review and commit. |
| Forbidden report write is blocked | Expected. Write findings inline in the checklist or approved verification evidence path. |
| Supervisor sleeps too long | Check `PLAYBOOK_TZ`, `state.json`, and the parsed `retryAt`. |
| Run exits without completion | Inspect the cycle log; resume the same state or address the named external dependency. |
| State points to the wrong repository | Stop and start a new supervisor state from the intended `--cwd`; never reuse state across repositories. |
