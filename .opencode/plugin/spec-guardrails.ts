/**
 * spec-guardrails.ts — OpenCode carrier for the spec-guardrails policy.
 *
 * Mechanical enforcement of process rules that the Verifier / Orchestrator
 * agents have repeatedly violated despite explicit prompt instructions.
 *
 * Hooks into OpenCode's tool.execute.before event and BLOCKS any write/edit
 * to forbidden filenames before the tool actually runs. The agent sees the
 * thrown error in its tool result, which forces it to redirect.
 *
 * The policy itself (forbidden patterns, path normalization, verifier
 * write-scope, block message) lives in ./write-policy.mjs — a pure module
 * shared verbatim with the Claude Code PreToolUse hook carrier. Keep policy
 * changes there; this file only adapts it to the OpenCode plugin API.
 *
 * Activated automatically by OpenCode at startup. No agent configuration
 * needed.
 */

import type { Plugin } from "@opencode-ai/plugin";
import { evaluateToolCall, extractPath, FILE_WRITING_TOOLS } from "./write-policy.mjs";

function isVerifier(input: unknown): boolean {
  const value = input as { agent?: unknown };
  return value.agent === "verifier" || (typeof value.agent === "object" && value.agent !== null && ((value.agent as {name?: string}).name === "verifier"));
}

export const SpecGuardrails: Plugin = async ({ client }) => {
  // Helper to log structured events to OpenCode's log stream so blocked
  // attempts are auditable.
  const log = async (
    level: "info" | "warn" | "error",
    message: string,
    extra?: Record<string, unknown>,
  ) => {
    try {
      await client.app.log({
        body: {
          service: "spec-guardrails",
          level,
          message,
          extra,
        },
      });
    } catch {
      // logging is best-effort; never crash a hook
    }
  };

  await log("info", "spec-guardrails plugin loaded");

  return {
    /**
     * Block write/edit/patch attempts to forbidden paths BEFORE the tool
     * actually runs. Throwing here aborts the tool call; the agent sees
     * the error message and (per OpenCode docs) treats it as the tool
     * result, which forces it to redirect.
     */
    "tool.execute.before": async (input, output) => {
      const verdict = evaluateToolCall({
        tool: input.tool,
        args: output.args as Record<string, unknown>,
        isVerifier: isVerifier(input),
      });
      if (!verdict) return;
      await log("warn", `BLOCKED ${input.tool} of forbidden path`, {
        tool: input.tool,
        path: verdict.paths.join(", "),
        callId: input.callID,
      });
      // Throwing aborts the tool. The thrown message is what the agent
      // sees as the tool result.
      throw new Error(verdict.message);
    },

    /**
     * After-hook for observability: log every successful file write so we
     * can see in the OpenCode log what files the agents are touching.
     * Cheap and non-blocking.
     */
    "tool.execute.after": async (input, _output) => {
      if (!FILE_WRITING_TOOLS.has(input.tool)) return;
      const path = extractPath(input.tool, input.args as Record<string, unknown>);
      if (!path) return;
      await log("info", `${input.tool} ok`, { path, callId: input.callID });
    },
  };
};

export default SpecGuardrails;
