#!/usr/bin/env node
/**
 * spec-guardrails-hook.mjs — Claude Code carrier for the spec-guardrails policy.
 *
 * Registered as a PreToolUse hook (see the pack's settings.json). Reads the
 * hook JSON from stdin; when the shared policy blocks the call, exits with
 * code 2 and the block message on stderr — Claude Code aborts the tool call
 * and feeds stderr back to the model, mirroring OpenCode's thrown-error
 * behaviour so the agent gets identical remediation text in both harnesses.
 *
 * The policy lives in ./write-policy.mjs — the same file the OpenCode plugin
 * uses. Keep policy changes there; this file only adapts stdin/stdout/exit
 * codes.
 *
 * Verifier detection: Claude Code hooks receive `agent_type` for subagent
 * contexts. If it equals "verifier", the stricter verifier write-scope
 * applies. If the field is absent (main session, or a Claude Code version
 * that does not send it), only the forbidden-filename rules are enforced —
 * fail-open on scope, fail-closed on the one-file rule.
 */
import { evaluateToolCall } from "./write-policy.mjs";

const chunks = [];
process.stdin.on("data", (c) => chunks.push(c));
process.stdin.on("end", () => {
  let input;
  try {
    input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    process.exit(0); // unparsable input: never block on our own failure
  }

  const tool = input.tool_name;
  const args = input.tool_input ?? {};
  const isVerifier = input.agent_type === "verifier";

  let verdict = null;
  try {
    verdict = evaluateToolCall({ tool, args, isVerifier });
  } catch {
    process.exit(0); // policy error: never block on our own failure
  }
  if (!verdict) process.exit(0);

  process.stderr.write(verdict.message);
  process.exit(2);
});
