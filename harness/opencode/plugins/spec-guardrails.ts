/**
 * spec-guardrails.ts
 *
 * Mechanical enforcement of process rules that the Verifier / Orchestrator
 * agents have repeatedly violated despite explicit prompt instructions.
 *
 * Hooks into OpenCode's tool.execute.before event and BLOCKS any write/edit
 * to forbidden filenames before the tool actually runs. The agent sees the
 * thrown error in its tool result, which forces it to redirect.
 *
 * Why this exists: prompt rules alone don't constrain LLM behaviour reliably
 * for high-stakes spec violations. After three rounds of adding more prompt
 * rules and seeing the Verifier still create Gap-Report.md files, we switched
 * to a mechanical guardrail. The agent literally cannot write the file now.
 *
 * Activated automatically by OpenCode at startup. No agent configuration
 * needed.
 */

import type { Plugin } from "@opencode-ai/plugin";

// ────────────────────────────────────────────────────────────────────────────
// FORBIDDEN FILE PATTERNS
// ────────────────────────────────────────────────────────────────────────────

/**
 * Any path matching these patterns will be blocked from write/edit/patch.
 * The Verifier writes findings INLINE in the implementation checklist;
 * separate "gap report" or "verification report" files are forbidden.
 */
const FORBIDDEN_PATH_PATTERNS: { pattern: RegExp; reason: string }[] = [
  {
    pattern: /Gap[-_ ]?Report.*\.md$/i,
    reason:
      "Gap-Report files are forbidden by the spec. The Verifier writes findings INLINE as `**Verifier Result**` annotations on each item in the implementation checklist itself, plus a new entry in the `## Verifier Run Log` section. There is no separate gap report. " +
      "If you (the agent) think you need to produce a report, you have misread the spec — re-read Rule 6 in your prompt.",
  },
  {
    pattern: /Verification[-_ ]?Report.*\.md$/i,
    reason:
      "Verification-Report files are forbidden. Annotate findings inline in the implementation checklist; append the run summary to `## Verifier Run Log`.",
  },
  {
    pattern: /Verify[-_ ]?Report.*\.md$/i,
    reason:
      "Verify-Report files are forbidden. Annotate findings inline in the implementation checklist.",
  },
  {
    pattern: /(?:Verification|Verify)[-_ ]?Results?.*\.md$/i,
    reason:
      "Verification results files are forbidden. Annotate findings inline in the implementation checklist.",
  },
  {
    pattern: /(?:Verify|Verification)[-_ ]?Findings.*\.md$/i,
    reason:
      "Verification findings files are forbidden. Annotate inline in the implementation checklist.",
  },
  {
    pattern: /Audit[-_ ]?Report.*\.md$/i,
    reason:
      "Audit-Report files are forbidden for /verify output. Annotate inline in the implementation checklist.",
  },
];

/**
 * Tool names whose file-write behaviour we want to police.
 * write, edit, patch all eventually land on disk.
 */
const FILE_WRITING_TOOLS = new Set(["write", "edit", "apply_patch"]);

/**
 * Extract the file path from a tool input, if any. Handles the differing
 * parameter names used by write/edit/patch.
 */
function extractPath(tool: string, args: Record<string, unknown>): string | null {
  if (!args) return null;
  // write tool uses `filePath`
  if (typeof args.filePath === "string") return args.filePath;
  // edit / apply_patch also use `filePath` in current SDK versions
  if (typeof args.path === "string") return args.path;
  if (typeof args.file === "string") return args.file;
  return null;
}

/**
 * Return the matching forbidden-pattern reason, or null if path is allowed.
 */
function checkForbidden(path: string): string | null {
  const basename = path.split("/").pop() || path;
  for (const { pattern, reason } of FORBIDDEN_PATH_PATTERNS) {
    if (pattern.test(basename)) return reason;
  }
  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// PLUGIN
// ────────────────────────────────────────────────────────────────────────────

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
      if (!FILE_WRITING_TOOLS.has(input.tool)) return;

      const path = extractPath(input.tool, output.args as Record<string, unknown>);
      if (!path) return;

      const reason = checkForbidden(path);
      if (reason) {
        await log("warn", `BLOCKED ${input.tool} of forbidden path`, {
          tool: input.tool,
          path,
          callId: input.callID,
        });
        // Throwing aborts the tool. The thrown message is what the agent
        // sees as the tool result.
        throw new Error(
          `BLOCKED by spec-guardrails: cannot ${input.tool} ${path}.\n\n` +
            `Reason: ${reason}\n\n` +
            `What to do instead:\n` +
            `  1. Locate the implementation checklist for this feature ` +
            `(usually a sibling file ending in ` +
            `'-FullStack-Implementation-Checklist.md').\n` +
            `  2. Append your findings as ` +
            `'**Verifier Result** (<date>): <PASS|FAIL|BLOCKED|...> — Evidence: <one line>' ` +
            `lines directly on the affected checklist items via the 'edit' tool.\n` +
            `  3. Append a new '### Run on <date>' entry to the ` +
            `'## Verifier Run Log' section at the bottom of the checklist.\n` +
            `  4. Update the '## Status Table' rows at the top.\n` +
            `Do not produce a separate report file. This rule is enforced ` +
            `mechanically; no exception, no override.`,
        );
      }
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
