/**
 * server.ts — spec-guardrails for OpenCode 2.x.
 *
 * OpenCode 2 loads a configured plugin directory through its `server` entry
 * (OpenCode 1 loads `index.ts` from the same directory), and a plugin is a
 * default `{ id, setup }` whose setup registers hooks. The policy is the same
 * ./write-policy.mjs and ./yolo-policy.mjs the 1.x plugin uses; only the
 * adapter differs:
 *
 *   - `tool` `execute.before` carries the calling agent, so the Verifier is
 *     known without a session map; the tool input is `event.input`.
 *   - A thrown hook error is a defect in OpenCode 2 that ends the whole turn,
 *     and a plugin cannot construct its Tool.Error. OpenCode 2 answers a call
 *     to an unknown tool name with a Tool.Error that names it, so a refused
 *     call is renamed to its block message: the tool never runs and the agent
 *     reads the reason as the tool result (refuse() below).
 *   - The project root is the plugin's location, not process.cwd(): the
 *     background service serves several projects from one process.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { evaluateToolCall, SHELL_TOOLS } from "../write-policy.mjs";
import { gitWriteReason } from "../yolo-policy.mjs";
import { GUARD_ENV, guardLine, withGuard } from "../guard-signal.mjs";

type Event = { tool: string; agent?: string; sessionID?: string; id?: string; input: unknown };

export function refuse(event: Event, message: string) {
  event.tool = message;
}

const audit = (message: string, extra: Record<string, unknown>) => {
  try {
    console.error(`[spec-guardrails] ${message} ${JSON.stringify(extra)}`);
  } catch {
    // auditing is best-effort; never break a tool call
  }
};

export default {
  id: "ai-first-playbook.spec-guardrails",
  setup: async (ctx: any) => {
    const root: string = ctx.location?.directory ?? process.cwd();
    // OpenCode 2.0.18 reads only AGENTS.md files found above the project, not
    // the config's `instructions`, so the installed standing rules and profile
    // are added here unless OpenCode already supplied them.
    const standing = [".playbook/AGENTS.md", ".playbook/environment-profile.yml"].flatMap((file) => {
      try {
        return [{ file, text: readFileSync(join(root, file), "utf8") }];
      } catch {
        return [];
      }
    });
    await ctx.session.hook("context", (event: any) => {
      const present = event.system.map((part: any) => part?.text ?? "").join("\n");
      for (const { file, text } of standing) {
        if (!present.includes(text.trim().split("\n")[0])) event.system.push({ type: "text", text: `Instructions from: ${join(root, file)}\n${text}` });
      }
      event.system.push({ type: "text", text: guardLine("spec-guardrails") });
    });
    await ctx.shell.hook("create.before", (event: any) => {
      event.env[GUARD_ENV] = withGuard(event.env[GUARD_ENV], "spec-guardrails");
    });
    await ctx.tool.hook("execute.before", (event: Event) => {
      const args = (event.input ?? {}) as Record<string, unknown>;
      // Git history writes are denied in every mode unless the human who
      // started OpenCode set PLAYBOOK_GIT_APPROVED=1; the YOLO plugin denies
      // them again in YOLO mode regardless.
      if (SHELL_TOOLS.has(event.tool) && process.env.PLAYBOOK_GIT_APPROVED !== "1") {
        const reason = gitWriteReason((args.command ?? args.cmd) as string | undefined);
        if (reason) {
          audit("BLOCKED git history write", { reason, callId: event.id });
          refuse(event, `BLOCKED by spec-guardrails: ${reason}. Leave changes in the working tree, report \`git status\` and what changed, and stop.`);
          return;
        }
      }
      const verdict = evaluateToolCall({ tool: event.tool, args, isVerifier: event.agent === "verifier", root });
      if (!verdict) return;
      audit(`BLOCKED ${event.tool} of forbidden path`, { tool: event.tool, path: verdict.paths.join(", "), callId: event.id });
      refuse(event, verdict.message);
    });
  },
};
