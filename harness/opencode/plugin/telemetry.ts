/**
 * telemetry.ts — per-phase usage, time and subagent capture for the AI-First Playbook.
 *
 * Opt-in: set PLAYBOOK_TELEMETRY=1 before starting OpenCode; without it this
 * plugin registers nothing. When enabled it appends NDJSON events to
 * verification/telemetry/events.ndjson in the project directory:
 *
 *   {"schema":2,"kind":"phase-start","phaseExecutionID":"...","command":"verify","sessionID":"...","ts":"..."}
 *   {"kind":"turn","sessionID":"...","parentID":null,"model":"anthropic/claude-sonnet-5",
 *    "tokens":{"input":..,"output":..,"reasoning":..,"cache":{...}},"cost":..,
 *    "activeStartedAt":"...","activeEndedAt":"...","activeMs":..,"ts":"..."}
 *   {"kind":"subagent-start","sessionID":"...","parentID":"...","ts":"..."}
 *   {"kind":"tool-start","sessionID":"...","callID":"...","tool":"bash","ts":"..."}
 *   {"kind":"phase-end","sessionID":"...","ts":"..."}
 *
 * scripts/playbook-telemetry.mjs joins these rows with the checklist's own
 * Run Log (attempt number) and Verifier Result lines (gate verdict) into the
 * final per-phase records. Capture points and rationale:
 * docs/Telemetry-Guide.md.
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
import { randomUUID } from "node:crypto";
import { join } from "node:path";

export const PlaybookTelemetry: Plugin = async ({ directory, client }) => {
  if (process.env.PLAYBOOK_TELEMETRY !== "1") return {};

  // sessionID -> parentID (null for top-level sessions). Populated from
  // session.created/session.updated; lazily backfilled via the SDK when a turn
  // arrives for a session we have not seen (e.g. plugin loaded mid-session).
  const parents = new Map<string, string | null>();
  const captureID = randomUUID();
  let sequence = 0;
  const agents = new Map<string, string>();
  const startedChildren = new Set<string>();
  const endedChildren = new Set<string>();
  const rememberSession = (info: Record<string, unknown> | undefined, assumeRoot = true) => {
    const id = info?.["id"];
    if (typeof id !== "string") return;
    if (typeof info?.["parentID"] === "string") parents.set(id, info["parentID"]);
    else if (assumeRoot) parents.set(id, null);
    if (typeof info?.["agent"] === "string") agents.set(id, info["agent"]);
  };
  const parentOf = async (sessionID: unknown): Promise<string | null | undefined> => {
    if (typeof sessionID !== "string") return undefined;
    if (parents.has(sessionID)) return parents.get(sessionID) ?? null;
    try {
      const res = await (client as any)?.session?.get?.({ path: { id: sessionID } });
      const info = (res?.data ?? res) as Record<string, unknown> | undefined;
      rememberSession(info);
    } catch {
      // Leave unknown rather than inventing a root/child relationship.
    }
    return parents.has(sessionID) ? (parents.get(sessionID) ?? null) : undefined;
  };

  const activeInterval = (info: Record<string, unknown>): Record<string, unknown> => {
    const time = info["time"] as Record<string, unknown> | undefined;
    const created = time?.["created"];
    const completed = time?.["completed"];
    if (typeof created !== "number" || !Number.isFinite(created)) return {};
    if (typeof completed !== "number" || !Number.isFinite(completed) || completed < created) return {};
    return {
      activeStartedAt: new Date(created).toISOString(),
      activeEndedAt: new Date(completed).toISOString(),
      activeMs: completed - created,
    };
  };

  const dir = join(directory, "verification", "telemetry");
  const file = join(dir, "events.ndjson");
  let ready: Promise<unknown> | null = null;
  let writeQueue: Promise<void> = Promise.resolve();

  const emit = async (record: Record<string, unknown>, seq: number, ts: string) => {
    writeQueue = writeQueue.then(async () => {
      ready ??= mkdir(dir, { recursive: true });
      await ready;
      await appendFile(file, JSON.stringify({ schema: 2, captureID, seq, ...record, ts }) + "\n");
    }).catch(() => {
      // telemetry is best-effort; never interfere with the run
    });
    await writeQueue;
  };

  const marker = () => ({ seq: sequence++, ts: new Date().toISOString() });

  return {
    "command.execute.before": async (input) => {
      const mark = marker();
      try {
        await emit({
          kind: "phase-start",
          phaseExecutionID: randomUUID(),
          command: input.command,
          sessionID: input.sessionID,
        }, mark.seq, mark.ts);
      } catch {
        // telemetry must never block command execution
      }
    },

    "tool.execute.before": async (input) => {
      const mark = marker();
      try {
        const parentID = await parentOf(input.sessionID);
        await emit({
          kind: "tool-start",
          sessionID: input.sessionID,
          ...(parentID === undefined ? {} : { parentID }),
          callID: input.callID,
          tool: input.tool,
        }, mark.seq, mark.ts);
      } catch {
        // telemetry must never block tool execution
      }
    },

    "tool.execute.after": async (input) => {
      const mark = marker();
      try {
        const parentID = await parentOf(input.sessionID);
        await emit({
          kind: "tool-end",
          sessionID: input.sessionID,
          ...(parentID === undefined ? {} : { parentID }),
          callID: input.callID,
          tool: input.tool,
        }, mark.seq, mark.ts);
      } catch {
        // telemetry must never block tool execution
      }
    },

    event: async ({ event }) => {
      const mark = marker();
      try {
        if (event.type === "session.created") {
          const info = (event.properties as { info?: Record<string, unknown> })?.info;
          rememberSession(info);
          const sessionID = info?.["id"];
          const parentID = info?.["parentID"];
          if (typeof sessionID === "string" && typeof parentID === "string" && !startedChildren.has(sessionID)) {
            startedChildren.add(sessionID);
            await emit({
              kind: "subagent-start",
              sessionID,
              parentID,
              ...(agents.has(sessionID) ? { agent: agents.get(sessionID) } : {}),
            }, mark.seq, mark.ts);
          }
        } else if (event.type === "session.updated") {
          rememberSession((event.properties as { info?: Record<string, unknown> })?.info, false);
        } else if (event.type === "message.updated") {
          const info = (event.properties as { info?: Record<string, unknown> })?.info;
          if (!info || info["role"] !== "assistant") return;
          const tokens = info["tokens"] as Record<string, unknown> | undefined;
          if (!tokens) return;
          const providerID = info["providerID"];
          const modelID = info["modelID"];
          const parentID = await parentOf(info["sessionID"]);
          await emit({
            kind: "turn",
            sessionID: info["sessionID"],
            ...(parentID === undefined ? {} : { parentID }),
            messageID: info["id"],
            ...(typeof providerID === "string" && typeof modelID === "string" ? { model: `${providerID}/${modelID}` } : {}),
            tokens,
            cost: info["cost"],
            ...activeInterval(info),
          }, mark.seq, mark.ts);
        } else if (event.type === "session.idle") {
          const sessionID = (event.properties as { sessionID?: string })?.sessionID;
          const parentID = await parentOf(sessionID);
          if (typeof sessionID !== "string") return;
          if (typeof parentID === "string") {
            if (endedChildren.has(sessionID)) return;
            endedChildren.add(sessionID);
            await emit({
              kind: "subagent-end",
              sessionID,
              parentID,
              ...(agents.has(sessionID) ? { agent: agents.get(sessionID) } : {}),
            }, mark.seq, mark.ts);
          } else if (parentID === null) {
            await emit({ kind: "phase-end", sessionID }, mark.seq, mark.ts);
          }
        }
      } catch {
        // never throw from the event hook
      }
    },
  };
};

export default PlaybookTelemetry;
