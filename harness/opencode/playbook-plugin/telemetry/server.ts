/**
 * server.ts — Playbook telemetry for OpenCode 2.x.
 *
 * Opt-in with PLAYBOOK_TELEMETRY=1, like ./index.ts (OpenCode 1.x). OpenCode 2
 * exposes tool hooks that carry the calling agent, so this entry records
 * `tool-start` and `tool-end` rows in the same schema-2 stream
 * (verification/telemetry/events.ndjson). OpenCode 2 has no command-start hook
 * and a different session event stream, so phase, turn and subagent rows are
 * not captured on 2.x yet; the joiner treats their absence as unmeasured.
 *
 * The guard signal is registered whether or not telemetry is on.
 */

import { appendFile, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { GUARD_ENV, guardLine, withGuard } from "../guard-signal.mjs";

export default {
  id: "ai-first-playbook.telemetry",
  setup: async (ctx: any) => {
    await ctx.session.hook("context", (event: any) => {
      event.system.push({ type: "text", text: guardLine("telemetry") });
    });
    await ctx.shell.hook("create.before", (event: any) => {
      event.env[GUARD_ENV] = withGuard(event.env[GUARD_ENV], "telemetry");
    });
    if (process.env.PLAYBOOK_TELEMETRY !== "1") return;

    const directory: string = ctx.location?.directory ?? process.cwd();
    const dir = join(directory, "verification", "telemetry");
    const file = join(dir, "events.ndjson");
    const captureID = randomUUID();
    let sequence = 0;
    let ready: Promise<unknown> | null = null;
    let writeQueue: Promise<void> = Promise.resolve();
    const emit = (record: Record<string, unknown>) => {
      const seq = sequence++;
      const ts = new Date().toISOString();
      writeQueue = writeQueue.then(async () => {
        ready ??= mkdir(dir, { recursive: true });
        await ready;
        await appendFile(file, JSON.stringify({ schema: 2, captureID, seq, ...record, ts }) + "\n");
      }).catch(() => {
        // telemetry is best-effort; never interfere with the run
      });
      return writeQueue;
    };

    await ctx.tool.hook("execute.before", async (event: any) => {
      await emit({ kind: "tool-start", sessionID: event.sessionID, agent: event.agent, callID: event.id, tool: event.tool });
    });
    await ctx.tool.hook("execute.after", async (event: any) => {
      await emit({ kind: "tool-end", sessionID: event.sessionID, agent: event.agent, callID: event.id, tool: event.tool, status: event.status });
    });
  },
};
