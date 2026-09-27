# YOLO Mode Guide — unattended, end-to-end runs

YOLO mode is how you run the playbook on a VM and come back to a finished feature. It
solves the three things that turned a one-evening build into a three-day babysit:

| Problem | What YOLO does |
|---|---|
| The harness stops for permission (delete a folder, run a command, read git) even though you said "just do it" | Every permission prompt is auto-approved **mechanically** by an OpenCode plugin — except git history writes, which stay denied |
| The command prompts themselves stop for approval ("Proceed? (yes/no)", "Approve the smoke test?") | The standing rules (`AGENTS.md` → "YOLO mode") pre-approve every in-command gate; the agent decides, logs the decision, and continues |
| The provider's 5-hour / weekly usage limit kills the run and nobody is there to restart it | A supervisor script detects the limit error, parses the stated reset time, waits for it **+ 15 minutes**, and resumes the same session — until the agent prints the completion sentinel |
| The build phase stops part-way: "items #1–#9 done, run `/implement` again for the rest" | The **completion contract** makes that a violation: `/implement` plans more waves until every item is to-verify, and hands off to `/verify` once |

What YOLO does **not** change: the guardrail plugin (no Gap-Report files; Verifier write
scope), the five verdict tiers, the evidence rules, and — above all — **agents never
commit**. YOLO turns that last rule from prose into a mechanical deny.

---

## 1. Turning it on

Any one of these switches YOLO mode on for the whole run and every sub-agent:

| Trigger | Where it is read | Scope |
|---|---|---|
| The token `YOLO` in the command arguments — `/implement YOLO @checklist`, `/fix docs/x.md *YOLO*` | The command bodies and `AGENTS.md` | Prompt-level gates only |
| `PLAYBOOK_YOLO=1` in the environment | The hook / plugin **and** the prompts | Prompt-level gates **and** harness permission prompts |

The first two are enough when you are at the keyboard and only want the agent to stop
asking. For a truly unattended run you need the environment variable, because a hook cannot
see the conversation — and the supervisor sets it for you.

```bash
# End-to-end goal: implement → verify → fix → verify … until every item PASSes
node scripts/playbook-yolo.mjs --harness=opencode --cwd=/path/to/repo --agent=orchestrator \
     --goal "App-Cost dashboard: implement docs/Cost/App-Cost-FullStack-Implementation-Checklist.md, verify, fix until all PASS"

# After a VM reboot or a killed terminal
node scripts/playbook-yolo.mjs resume --cwd=/path/to/repo
node scripts/playbook-yolo.mjs status --cwd=/path/to/repo
```

Run it under `nohup`, `tmux`, or a systemd unit on the VM; it is a plain long-running Node
process. Output is mirrored to `verification/yolo/cycles/<n>.log`; the supervisor's own
narration goes to `verification/yolo/supervisor.log` and the console.

### Interactive TUI with YOLO permissions

You can also keep the TUI and just stop the prompts:

```bash
PLAYBOOK_YOLO=1 opencode            # OpenCode: the yolo.ts plugin answers every permission.ask
```

Windows binaries launched from WSL only see variables listed in `WSLENV`
(`export WSLENV=$WSLENV:PLAYBOOK_YOLO`); the supervisor adds it automatically.

---

## 2. What the agent may do in YOLO mode

| Action | Normal mode | YOLO mode |
|---|---|---|
| Edit / create files the guardrail permits | allowed, may prompt | allowed, no prompt |
| Delete files and folders in the repo, build output, verification output | prompts | **allowed** |
| Run build / start / test / install commands | prompts | **allowed** |
| Kill processes it started | prompts | allowed |
| Read-only git: `status` `log` `diff` `show` `blame` `branch` `fetch` `stash list` | prompts | **allowed** |
| `git commit` `push` `tag` `add` `rebase` `reset` `merge` `checkout` `stash` `clean`, `gh pr create` | prompts / forbidden by rules | **denied mechanically** |
| Write `*-Gap-Report.md` and other forbidden files | blocked | blocked (spec-guardrails runs first) |
| Verifier writing outside its scope | blocked | blocked |
| Stop to ask "Proceed?" / "Approve?" | yes | **no** — decides and logs under `## YOLO Decisions` |
| Ask for a missing checklist path | yes | yes, once, at the very start |

Decisions the agent takes on your behalf land in the checklist under `## YOLO Decisions`,
one line each: *what* it chose, *why*, and *how to reverse it*. Read that section first
when you come back.

---

## 3. The completion contract (build phase)

Independently of YOLO, `/implement` now ends only when **every item in scope** is
implemented, built, self-tested and marked to-verify in the Status Table, or carries an
explicit `[INFRA BLOCKER]` / `[EXTERNAL BLOCKER]` annotation saying what is missing and who
supplies it. The orchestrator's "When done" section starts with a completion check; if any
item is still planned or in-progress without a blocker tag, it plans the next wave instead
of writing the summary.

Why this is a rule and not advice: the model's natural move under context pressure is to
summarise progress and suggest "run `/implement` again for the remaining items". That is
cheap for the model and expensive for you — each re-run re-reads the checklist, re-plans
waves and re-spawns builders. Smaller slices and more waves cost far less. `/fix` carries
the same contract for its FAIL set; `/verify` already required a verdict on every item.

---

## 4. Usage-limit handling

Subscription plans can enforce a 5-hour window and a weekly cap; the API
itself returns HTTP 429 `rate_limit_error` (and `overloaded_error` under load). When that
stops a run, the supervisor:

1. **Recognises** the error from the harness output (or, on OpenCode, from
   `verification/yolo/rate-limit.json`, which the `yolo.ts` plugin writes the moment it sees
   a `session.error` carrying a limit message — including the `retry-after` /
   `anthropic-ratelimit-*-reset` headers).
2. **Parses the reset time** from whatever shape it came in:
   `You've hit your session limit · resets 3:45pm` · `resets Mon 12:00am` ·
   `resets at 2:30pm (America/Los_Angeles)` · `resets in 2 hours 13 minutes` ·
   `retry-after: 120` · `You will regain access on 2026-09-01 at 00:00 UTC` ·
   any ISO-8601 timestamp · epoch seconds.
   Bare wall-clock times with no zone are read in the supervisor's local zone; set
   `PLAYBOOK_TZ=Asia/Kolkata` (any IANA name) if the VM's clock zone differs from the one
   the harness prints.
3. **Adds the buffer** — 15 minutes by default (`--buffer=<min>`) — and prints
   `sleeping until <ISO time> … Restart the agent at that time.` The retry time is also
   saved to `verification/yolo/state.json`, so `status` shows it and `resume` honours it
   after a reboot.
4. **Resumes the same session** (`opencode run --session <id>`)
   with a short instruction: re-read the Status Table, continue from the first unfinished
   item, do not redo finished work.

If a limit message carries no usable time, it waits 60 minutes (`--default-wait`), doubling
on each consecutive unparsed hit, never more than 24 hours per cycle. A weekly limit that
resets days away is therefore re-checked once a day, not slept through blindly.

---

## 5. How a run ends

The agent's last line tells the supervisor what happened:

| Last line | Meaning | Supervisor exit code |
|---|---|---|
| `PLAYBOOK_RUN_COMPLETE: <summary>` | Goal / phase fully done. Working tree ready for your review and commit | 0 |
| `PLAYBOOK_RUN_BLOCKED: <missing thing + owner>` | Everything possible is done; one external blocker remains (a secret, an infra resource, a decision only you can take) | 3 |
| neither | The agent paused (asked a question, hit the context limit, crashed). The supervisor nudges it to continue — up to `--max-nudges` (8) consecutive times — then gives up | 4 |
| auth / binary error | Fix the environment, then `resume` | 5 |

`git status` is reported at the end; nothing is committed. Review `## YOLO Decisions`, the
Status Table and the Verifier Run Log, then commit yourself.

---

## 6. What ships

| Component | OpenCode implementation |
|---|---|
| Policy | `harness/opencode/plugin/yolo-policy.mjs` |
| Permission bypass | `plugin/yolo.ts` → `permission.ask` sets `allow` / `deny`; `tool.execute.before` throws on git writes even when the agent's config already says `bash: allow` |
| Limit detection | `event` → `session.error` → `verification/yolo/rate-limit.json` |
| Launch flags used by the supervisor | `opencode run --auto --format json [--agent …] [--session …]` |
| Registration | `opencode.json` → `"plugin": [spec-guardrails.ts, yolo.ts]` (order matters: guardrail first) |

The YOLO carrier is **inert without `PLAYBOOK_YOLO=1`** — an ordinary interactive session is
unchanged.

### OpenCode specifics

- `opencode run --auto` approves everything not explicitly denied; the plugin additionally
  answers `permission.ask` so the TUI path works too, and denies git writes on both paths.
- The plugin is discovered from `.opencode/plugin/` and must be listed **after**
  `spec-guardrails.ts` in `opencode.json` so a forbidden filename is blocked before YOLO
  could allow it. `scripts/playbook-validate.mjs` checks the order.

### Permission decision flow

The OpenCode carrier evaluates each request in a fixed order:

1. If YOLO is off, it returns without changing normal OpenCode behavior.
2. The spec guardrail evaluates protected paths and Verifier write scope first.
3. The YOLO policy rejects git history, index, ref, and publish operations.
4. Ordinary repository commands and read-only git operations are allowed.
5. The decision is returned to OpenCode without asking the operator.

This ordering matters. YOLO is a permission convenience, not a bypass around specification,
secrets, verification-evidence, or no-commit rules.

### Unattended-run preflight

Before leaving a VM unattended:

- Run `node scripts/playbook-validate.mjs` and `node scripts/test-guardrails.mjs`.
- Confirm `PLAYBOOK_YOLO=1` reaches the OpenCode process.
- Run the supervisor once with `--dry-run` and inspect the rendered command.
- Confirm the target checklist exists and its Status Table reflects completed work.
- Keep credentials scoped to development resources and ensure git is the rollback boundary.
- Start with a small one-phase run before using an end-to-end goal.
- Keep `verification/yolo/` available so restart state and cycle logs survive shell exits.

---

## 7. Safety notes

- Run YOLO on a VM or container that holds **only** the working copy, credentials scoped to
  dev resources, and nothing you would mind an agent deleting. "May delete anything in the
  repo" is literal.
- Git history is the rollback line: because the agent can never commit, `git checkout --`
  / `git clean` by **you** restores any state. Commit your own work before starting a run.
- Secrets rules are unchanged — see [`Security.md`](Security.md).
- The telemetry plugin (`PLAYBOOK_TELEMETRY=1`) still works under YOLO; the supervisor
  passes the variable through, so you can cost an unattended run per phase afterwards.

---

## 8. Verification status — do a first-run smoke test

What has been verified, and what has not, as of 2026-08-21:

| Piece | Verified how |
|---|---|
| Policy (`yolo-policy.mjs`): git-write denial, allow-list, reset-time parsing, sentinels | `node scripts/test-guardrails.mjs` — 20+ deny/allow cases, 7 reset-time shapes |
| OpenCode carrier (`yolo.ts`) | `node scripts/test-guardrails.mjs` covers allow/deny policy behavior; live TUI behavior remains listed separately below |
| Supervisor command lines | `--dry-run` for OpenCode |
| Plugin registration order and policy drift | `node scripts/playbook-validate.mjs` |
| **A real headless session hitting a real usage limit and resuming** | **Not yet** — no live run has gone through a 5-hour reset |
| **OpenCode `permission.ask` / `session.error` in a live TUI** | **Not yet** — written against the `@opencode-ai/plugin` 1.18.18 types, not exercised end to end |

So treat the first `--goal` run on your VM as the smoke test. Before starting it, commit
your own work (the agent cannot, so git is your rollback line). Then:

1. Start with one phase, not a goal: `--prompt "/implement …"` on a small checklist.
2. Watch `verification/yolo/supervisor.log` and `cycles/001.log` for the first few
   minutes: you should see no permission prompts, and any `git commit` attempt should
   appear as a `BLOCKED by yolo-policy` line.
3. Confirm the run ends with `PLAYBOOK_RUN_COMPLETE:` and the supervisor exits 0.
4. If a limit hits during the run, check `state.json` → `retryAt` against the time the
   harness printed. A mismatch of whole hours means a time-zone problem — set
   `PLAYBOOK_TZ` (see §4) and `resume`.

If something in this table turns out wrong in practice, the fix belongs in
`yolo-policy.mjs` (parsing / allow-list) or the OpenCode carrier — then update this
table and `docs/Decisions.md`.

## 9. Troubleshooting

| Symptom | Action |
|---|---|
| Still being prompted in the TUI | `PLAYBOOK_YOLO` is not reaching the process. From WSL launching a Windows binary: `export WSLENV=$WSLENV:PLAYBOOK_YOLO`. Confirm `opencode.json` registers `yolo.ts` after `spec-guardrails.ts`. |
| The agent still asked "Proceed?" | It did not see the trigger. Put the token `YOLO` directly after the command name (`/implement YOLO …`) or use the supervisor, which injects the rules into the prompt. |
| The agent committed — or tried to | It cannot: the carrier denies git writes. If you see the block message in the log that is the policy working. |
| Supervisor slept far longer than the window | Time-zone mismatch on a bare wall-clock time. Set `PLAYBOOK_TZ` to the zone the harness prints in, or check `verification/yolo/state.json` → `retryAt`. |
| Supervisor gave up with exit 4 | Eight consecutive runs ended without a sentinel — read the last `cycles/<n>.log`; usually a missing required input or a crash loop. Fix, then `resume`. |
| Test the policy | Run `node scripts/test-guardrails.mjs`; the YOLO cases must deny git writes and allow ordinary repository commands. |
