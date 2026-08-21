#!/usr/bin/env node
/**
 * yolo-hook.mjs — Claude Code carrier for the YOLO (unattended-run) policy.
 *
 * Registered (see the pack's settings.json) for two hook events:
 *
 *   PreToolUse        — when PLAYBOOK_YOLO=1: returns
 *                       hookSpecificOutput.permissionDecision = "allow" for every
 *                       tool call so Claude Code does not prompt, EXCEPT git
 *                       history/index/ref writes and gh publishes, which are
 *                       blocked with exit code 2 (a blocking hook wins over
 *                       allow rules and over bypassPermissions mode, and the
 *                       stderr text is fed back to the model).
 *   PermissionRequest — belt and braces for the cases where a prompt is still
 *                       raised (auto mode's classifier, `ask` rules): answers
 *                       decision = "allow" / "deny" with the same policy.
 *
 * Without PLAYBOOK_YOLO=1 the hook is a no-op (exit 0, no output), so a normal
 * interactive session behaves exactly as before.
 *
 * The policy lives in ./yolo-policy.mjs — the same file the OpenCode plugin and
 * the supervisor use. Keep policy changes there; this file only adapts
 * stdin/stdout/exit codes.
 *
 * Note: Claude Code evaluates `permissions.deny` / `permissions.ask` rules
 * regardless of hook allows. A YOLO install must therefore not carry `ask`
 * rules for the tools it wants unattended — see docs/YOLO-Mode-Guide.md.
 */
import { isYoloEnv, yoloDecision } from "./yolo-policy.mjs";

const chunks = [];
process.stdin.on("data", (c) => chunks.push(c));
process.stdin.on("end", () => {
  if (!isYoloEnv()) process.exit(0);

  let input;
  try {
    input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    process.exit(0); // unparsable input: never interfere on our own failure
  }

  const event = input.hook_event_name ?? "PreToolUse";
  let verdict;
  try {
    verdict = yoloDecision({ tool: input.tool_name, args: input.tool_input ?? {} });
  } catch {
    process.exit(0);
  }

  if (event === "PermissionRequest") {
    // exit code 2 is not honoured for PermissionRequest — decide via JSON only
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PermissionRequest",
        decision: verdict.decision,
        ...(verdict.decision === "deny" ? { reason: verdict.reason } : {}),
      },
    }));
    process.exit(0);
  }

  if (verdict.decision === "deny") {
    process.stderr.write(verdict.reason);
    process.exit(2); // blocks the call in every permission mode
  }
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      permissionDecisionReason: verdict.reason,
    },
  }));
  process.exit(0);
});
