/**
 * spec-guardrails.ts — OpenCode plugin for the spec-guardrails policy.
 *
 * Mechanical enforcement of process rules that the Verifier / Orchestrator
 * agents have repeatedly violated despite explicit prompt instructions.
 *
 * Uses OpenCode's tool.execute.before event and BLOCKS any write/edit
 * to forbidden filenames before the tool actually runs. The agent sees the
 * thrown error in its tool result, which forces it to redirect.
 *
 * The policy itself (forbidden patterns, path normalization, verifier
 * write-scope, block message) lives in ./write-policy.mjs. Keep policy changes
 * there; this file only adapts it to the OpenCode plugin API.
 *
 * Activated automatically by OpenCode at startup. No agent configuration
 * needed.
 */

import type { Plugin } from "@opencode-ai/plugin";
import { evaluateToolCall, extractPath, FILE_WRITING_TOOLS } from "./write-policy.mjs";
import { gitWriteReason } from "./yolo-policy.mjs";

function agentName(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && typeof (value as { name?: unknown }).name === "string") return (value as { name: string }).name;
  return null;
}

export const SpecGuardrails: Plugin = async ({ client }) => {
  // OpenCode's tool.execute.before input carries only the sessionID, never the
  // agent. chat.params and chat.message do carry it, and they fire before any
  // tool call of that turn, so the plugin keeps its own session -> agent map.
  // A subagent (e.g. the verifier dispatched by /verify) runs in its own
  // session, so its tool calls resolve to its own name, not the parent's.
  const sessionAgent = new Map<string, string>();
  const remember = (sessionID: unknown, agent: unknown) => {
    const name = agentName(agent);
    if (typeof sessionID === "string" && name) sessionAgent.set(sessionID, name);
  };
  const isVerifier = (input: { sessionID?: string; agent?: unknown }) =>
    agentName(input.agent) === "verifier" || (typeof input.sessionID === "string" && sessionAgent.get(input.sessionID) === "verifier");

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
      // logging is best-effort; never crash the plugin
    }
  };

  await log("info", "spec-guardrails plugin loaded");

  return {
    "chat.params": async (input) => remember(input.sessionID, input.agent),
    "chat.message": async (input) => remember(input.sessionID, input.agent),
    event: async ({ event }) => {
      const info = (event as { type?: string; properties?: { info?: { sessionID?: string; agent?: unknown; mode?: unknown } } });
      if (info.type === "message.updated") remember(info.properties?.info?.sessionID, info.properties?.info?.agent ?? info.properties?.info?.mode);
    },

    /**
     * Block write/edit/patch attempts to forbidden paths BEFORE the tool
     * actually runs. Throwing here aborts the tool call; the agent sees
     * the error message and (per OpenCode docs) treats it as the tool
     * result, which forces it to redirect.
     */
    "tool.execute.before": async (input, output) => {
      // Git history writes are denied in every mode unless the human who
      // started OpenCode set PLAYBOOK_GIT_APPROVED=1. yolo.ts denies them
      // again in YOLO mode regardless of that approval.
      if (input.tool === "bash" && process.env.PLAYBOOK_GIT_APPROVED !== "1") {
        const args = (output.args ?? {}) as Record<string, unknown>;
        const reason = gitWriteReason((args.command ?? args.cmd) as string | undefined);
        if (reason) {
          await log("warn", "BLOCKED git history write", { reason, callId: input.callID });
          throw new Error(`BLOCKED by spec-guardrails: ${reason}. Leave changes in the working tree, report \`git status\` and what changed, and stop.`);
        }
      }
      const verdict = evaluateToolCall({
        tool: input.tool,
        args: output.args as Record<string, unknown>,
        isVerifier: isVerifier(input as { sessionID?: string; agent?: unknown }),
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
     * After-event observability: log every successful file write so we
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
