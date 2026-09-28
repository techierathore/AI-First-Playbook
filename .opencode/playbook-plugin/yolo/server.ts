/**
 * server.ts — the YOLO (unattended-run) policy for OpenCode 2.x.
 *
 * Same policy as ./index.ts (OpenCode 1.x), from ../yolo-policy.mjs, adapted
 * to the OpenCode 2 hooks:
 *
 *   1. `permission` `evaluate` — allows every permission OpenCode would ask
 *      for, EXCEPT git history/index/ref writes and gh publishes, which are
 *      denied with the reason.
 *   2. `tool` `execute.before` — refuses git writes even when the agent may
 *      run the shell without asking (see ../spec-guardrails/server.ts for why
 *      a refusal renames the call instead of throwing).
 *   3. `session` `retry` — recognises provider usage/rate-limit errors and
 *      writes verification/yolo/rate-limit.json for the supervisor.
 *
 * Inert (apart from the guard signal) unless PLAYBOOK_YOLO=1 is in the
 * environment of the OpenCode server: with `opencode run --standalone` that is
 * the shell that started it; the background service keeps its own
 * environment.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isYoloEnv, yoloDecision, gitWriteReason, rateLimitPlan, SHELL_TOOLS_YOLO } from "../yolo-policy.mjs";
import { GUARD_ENV, guardLine, withGuard } from "../guard-signal.mjs";

// A refused call is renamed to its reason; see ../spec-guardrails/server.ts.
function refuse(event: { tool: string }, message: string) {
  event.tool = message;
}

const audit = (message: string, extra: Record<string, unknown>) => {
  try {
    console.error(`[playbook-yolo] ${message} ${JSON.stringify(extra)}`);
  } catch {
    // auditing is best-effort
  }
};

export default {
  id: "ai-first-playbook.yolo",
  setup: async (ctx: any) => {
    await ctx.session.hook("context", (event: any) => {
      event.system.push({ type: "text", text: guardLine("yolo") });
    });
    await ctx.shell.hook("create.before", (event: any) => {
      event.env[GUARD_ENV] = withGuard(event.env[GUARD_ENV], "yolo");
    });
    if (!isYoloEnv()) return;

    const directory: string = ctx.location?.directory ?? process.cwd();
    const stateDir = join(directory, "verification", "yolo");
    const limitFile = join(stateDir, "rate-limit.json");
    audit("YOLO mode active: permissions auto-approved, git writes denied, rate-limit resets recorded", { limitFile });

    await ctx.permission.hook("evaluate", (event: any) => {
      try {
        const command = (event.metadata?.command as string | undefined) ?? (SHELL_TOOLS_YOLO.has(event.action) ? event.resources?.[0] : undefined);
        const verdict = yoloDecision({ tool: event.action, args: { command } });
        if (event.effect === "deny" && verdict.decision === "allow") return; // never widen an explicit deny
        event.effect = verdict.decision;
        if (verdict.decision === "deny") event.message = verdict.reason;
        audit(`permission ${verdict.decision}: ${event.action}`, { reason: verdict.reason, sessionID: event.sessionID });
      } catch (err) {
        audit("permission hook failed; leaving decision to OpenCode", { err: String(err) });
      }
    });

    await ctx.tool.hook("execute.before", (event: any) => {
      if (!SHELL_TOOLS_YOLO.has(event.tool)) return;
      const args = (event.input ?? {}) as Record<string, unknown>;
      const reason = gitWriteReason((args.command ?? args.cmd) as string | undefined);
      if (!reason) return;
      audit("BLOCKED git write in YOLO mode", { reason, callId: event.id });
      refuse(event, `BLOCKED by yolo-policy: ${reason}. YOLO unlocks everything except git history: ` +
        "leave the working tree for the human to commit, report `git status` and what changed, and carry on with the run.");
    });

    await ctx.session.hook("retry", async (event: any) => {
      try {
        const plan = rateLimitPlan(JSON.stringify(event.error ?? {}));
        if (!plan) return;
        const record = {
          detectedAt: new Date().toISOString(),
          sessionID: event.sessionID ?? null,
          resetAt: plan.resetAt ? plan.resetAt.toISOString() : null,
          retryAt: plan.retryAt.toISOString(),
          bufferMinutes: plan.bufferMinutes,
          parsed: plan.parsed,
          message: String(event.error?.message ?? event.error?.name ?? "rate limit"),
        };
        await mkdir(stateDir, { recursive: true });
        await writeFile(limitFile, JSON.stringify(record, null, 2) + "\n");
        audit(`usage limit hit — retry at ${record.retryAt}`, record);
      } catch (err) {
        audit("retry hook failed", { err: String(err) });
      }
    });
  },
};
