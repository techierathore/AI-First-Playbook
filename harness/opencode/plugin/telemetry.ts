/**
 * telemetry.ts — per-phase model/token/cost capture for the AI-First Playbook.
 *
 * Opt-in: set PLAYBOOK_TELEMETRY=1 before starting OpenCode; without it this
 * plugin registers nothing. When enabled it appends NDJSON events to
 * verification/telemetry/events.ndjson in the project directory:
 *
 *   {"kind":"phase-start","command":"verify","sessionID":"...","ts":"..."}
 *   {"kind":"turn","sessionID":"...","parentID":null,"model":"anthropic/claude-sonnet-5",
 *    "tokens":{"input":..,"output":..,"reasoning":..,"cache":{...}},"cost":..,"ts":"..."}
 *   {"kind":"phase-end","sessionID":"...","ts":"..."}
 *
 * scripts/playbook-telemetry.mjs joins these rows with the checklist's own
 * Run Log (attempt number) and Verifier Result lines (gate verdict) into the
 * final per-phase records. Capture points and rationale:
 * docs/Telemetry-Hooks.md.
 *
 * `parentID` on turn rows is null for the main session and the parent's
 * sessionID for subagent (child) sessions — the joiner uses it to split the
 * phase total into main vs. subagent tokens (`tokens_scope`, `subagents`). It
 * is learned from `session.created` / `session.updated` events and, for
 * sessions that predate the plugin, from GET /session/{id} via the SDK client.
 *
 * The `event` hook is fire-and-forget and error-isolated in OpenCode, so
 * telemetry can never break a run; the command hook wraps everything in
 * try/catch for the same guarantee.
 */

import type { Plugin } from "@opencode-ai/plugin";
import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export const PlaybookTelemetry: Plugin = async ({ directory, client }) => {
  if (process.env.PLAYBOOK_TELEMETRY !== "1") return {};

  // sessionID -> parentID (null for top-level sessions). Populated from
  // session.created/session.updated; lazily backfilled via the SDK when a turn
  // arrives for a session we have not seen (e.g. plugin loaded mid-session).
  const parents = new Map<string, string | null>();
  const rememberSession = (info: Record<string, unknown> | undefined) => {
    const id = info?.["id"];
    if (typeof id === "string") parents.set(id, (info?.["parentID"] as string | undefined) ?? null);
  };
  const parentOf = async (sessionID: unknown): Promise<string | null> => {
    if (typeof sessionID !== "string") return null;
    if (parents.has(sessionID)) return parents.get(sessionID) ?? null;
    try {
      const res = await (client as any)?.session?.get?.({ path: { id: sessionID } });
      const info = (res?.data ?? res) as Record<string, unknown> | undefined;
      rememberSession(info);
    } catch {
      // leave unknown — the joiner treats a missing parentID as "main"
    }
    return parents.get(sessionID) ?? null;
  };

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
        if (event.type === "session.created" || event.type === "session.updated") {
          rememberSession((event.properties as { info?: Record<string, unknown> })?.info);
        } else if (event.type === "message.updated") {
          const info = (event.properties as { info?: Record<string, unknown> })?.info;
          if (!info || info["role"] !== "assistant") return;
          const tokens = info["tokens"] as Record<string, unknown> | undefined;
          if (!tokens) return;
          await emit({
            kind: "turn",
            sessionID: info["sessionID"],
            parentID: await parentOf(info["sessionID"]),
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
