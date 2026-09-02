/**
 * yolo.ts — OpenCode plugin for the YOLO (unattended-run) policy.
 *
 * Inert unless PLAYBOOK_YOLO=1 is set when OpenCode starts (a human may export
 * it before the TUI; the optional source-checkout supervisor also sets it).
 * When active it does three things, all driven by ./yolo-policy.mjs:
 *
 *   1. `permission.ask`     — auto-approves every permission request the
 *                             OpenCode would otherwise stop on (edit, bash,
 *                             external_directory, doom_loop, webfetch, …),
 *                             EXCEPT git history/index/ref writes and gh
 *                             publishes, which are denied with the reason.
 *   2. `tool.execute.before` — mechanically blocks git writes even when the
 *                             agent's config already says `bash: allow` (no
 *                             permission prompt ever fires for those). The
 *                             thrown message is what the agent sees.
 *   3. `event` session.error — recognises provider usage/rate-limit errors,
 *                             parses the reset time, adds the buffer and
 *                             writes verification/yolo/rate-limit.json so the
 *                             supervisor can sleep until exactly then and
 *                             resume the session.
 *
 * Everything is wrapped so the plugin can never break a run. Policy changes
 * belong in yolo-policy.mjs, which the supervisor also imports.
 */

import type { Plugin } from "@opencode-ai/plugin";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isYoloEnv, yoloDecision, gitWriteReason, rateLimitPlan, SHELL_TOOLS_YOLO } from "./yolo-policy.mjs";

export const PlaybookYolo: Plugin = async ({ directory, client }) => {
  if (!isYoloEnv()) return {};

  const log = async (level: "info" | "warn" | "error", message: string, extra?: Record<string, unknown>) => {
    try {
      await client.app.log({ body: { service: "playbook-yolo", level, message, extra } });
    } catch {
      // logging is best-effort
    }
  };

  const stateDir = join(directory, "verification", "yolo");
  const limitFile = join(stateDir, "rate-limit.json");

  await log("info", "YOLO mode active: permissions auto-approved, git writes denied, rate-limit resets recorded", { limitFile });

  return {
    "permission.ask": async (input, output) => {
      try {
        const meta = ((input as any).metadata ?? {}) as Record<string, unknown>;
        const command = (meta.command as string | undefined) ?? (input.type === "bash" ? input.title : undefined);
        const verdict = yoloDecision({ tool: input.type, args: { command, pattern: input.pattern } });
        output.status = verdict.decision;
        await log(verdict.decision === "allow" ? "info" : "warn", `permission ${verdict.decision}: ${input.type}`, {
          title: input.title, pattern: input.pattern, reason: verdict.reason, sessionID: input.sessionID,
        });
      } catch (err) {
        await log("error", "permission.ask handler failed; leaving decision to OpenCode", { err: String(err) });
      }
    },

    "tool.execute.before": async (input, output) => {
      if (!SHELL_TOOLS_YOLO.has(input.tool)) return;
      const args = (output.args ?? {}) as Record<string, unknown>;
      const command = (args.command ?? args.cmd) as string | undefined;
      const reason = gitWriteReason(command);
      if (!reason) return;
      await log("warn", "BLOCKED git write in YOLO mode", { command, reason, callId: input.callID });
      throw new Error(
        `BLOCKED by yolo-policy: ${reason}. YOLO unlocks everything except git history: ` +
        `leave the working tree for the human to commit, report \`git status\` and what changed, and carry on with the run.`,
      );
    },

    event: async ({ event }) => {
      try {
        if (event.type !== "session.error") return;
        const props = (event.properties ?? {}) as { sessionID?: string; error?: { name?: string; data?: Record<string, unknown> } };
        const data = props.error?.data ?? {};
        const headers = (data.responseHeaders ?? {}) as Record<string, string>;
        const text = [
          props.error?.name, data.message, data.statusCode, data.responseBody,
          ...Object.entries(headers).filter(([k]) => /retry-after|ratelimit/i.test(k)).map(([k, v]) => `${k}: ${v}`),
        ].filter(Boolean).join("\n");
        const plan = rateLimitPlan(text);
        if (!plan) return;
        const record = {
          detectedAt: new Date().toISOString(),
          sessionID: props.sessionID ?? null,
          resetAt: plan.resetAt ? plan.resetAt.toISOString() : null,
          retryAt: plan.retryAt.toISOString(),
          bufferMinutes: plan.bufferMinutes,
          parsed: plan.parsed,
          message: String(data.message ?? props.error?.name ?? "rate limit"),
        };
        await mkdir(stateDir, { recursive: true });
        await writeFile(limitFile, JSON.stringify(record, null, 2) + "\n");
        await log("warn", `usage limit hit — retry at ${record.retryAt}`, record);
        try {
          await (client as any)?.tui?.showToast?.({ body: { message: `Usage limit hit. YOLO supervisor will retry at ${record.retryAt}`, variant: "warning" } });
        } catch {
          // TUI may not be attached (headless run)
        }
      } catch (err) {
        await log("error", "session.error handler failed", { err: String(err) });
      }
    },
  };
};

export default PlaybookYolo;
