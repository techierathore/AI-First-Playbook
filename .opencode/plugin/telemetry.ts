/**
 * telemetry.ts — per-phase model/token/cost capture for the AI-First Playbook.
 *
 * Opt-in: set PLAYBOOK_TELEMETRY=1 before starting OpenCode; without it this
 * plugin registers nothing. When enabled it appends NDJSON events to
 * verification/telemetry/events.ndjson in the project directory:
 *
 *   {"kind":"phase-start","command":"verify","sessionID":"...","ts":"..."}
 *   {"kind":"turn","sessionID":"...","model":"anthropic/claude-sonnet-5",
 *    "tokens":{"input":..,"output":..,"reasoning":..,"cache":{...}},"cost":..,"ts":"..."}
 *   {"kind":"phase-end","sessionID":"...","ts":"..."}
 *
 * scripts/playbook-telemetry.mjs joins these rows with the checklist's own
 * Run Log (attempt number) and Verifier Result lines (gate verdict) into the
 * final per-phase records. Capture points and rationale:
 * docs/Telemetry-Hooks.md.
 *
 * The `event` hook is fire-and-forget and error-isolated in OpenCode, so
 * telemetry can never break a run; the command hook wraps everything in
 * try/catch for the same guarantee.
 */

import type { Plugin } from "@opencode-ai/plugin";
import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export const PlaybookTelemetry: Plugin = async ({ directory }) => {
  if (process.env.PLAYBOOK_TELEMETRY !== "1") return {};

  const dir = join(directory, "verification", "telemetry");
  const file = join(dir, "events.ndjson");
  let ready: Promise<unknown> | null = null;

  const emit = async (record: Record<string, unknown>) => {
    try {
      ready ??= mkdir(dir, { recursive: true });
      await ready;
      await appendFile(file, JSON.stringify({ ...record, ts: new Date().toISOString() }) + "\n");
    } catch {
      // telemetry is best-effort; never interfere with the run
    }
  };

  return {
    "command.execute.before": async (input) => {
      await emit({ kind: "phase-start", command: input.command, sessionID: input.sessionID, arguments: input.arguments });
    },

    event: async ({ event }) => {
      try {
        if (event.type === "message.updated") {
          const info = (event.properties as { info?: Record<string, unknown> })?.info;
          if (!info || info["role"] !== "assistant") return;
          const tokens = info["tokens"] as Record<string, unknown> | undefined;
          if (!tokens) return;
          await emit({
            kind: "turn",
            sessionID: info["sessionID"],
            messageID: info["id"],
            model: `${info["providerID"]}/${info["modelID"]}`,
            tokens,
            cost: info["cost"],
          });
        } else if (event.type === "session.idle") {
          await emit({ kind: "phase-end", sessionID: (event.properties as { sessionID?: string })?.sessionID });
        }
      } catch {
        // never throw from the event hook
      }
    },
  };
};

export default PlaybookTelemetry;
