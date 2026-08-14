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
import { existsSync, lstatSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

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
const FILE_WRITING_TOOLS = new Set(["write", "edit", "apply_patch", "patch", "create_file", "delete_file", "move_file"]);

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
  if (typeof args.target === "string") return args.target;
  return null;
}

function pathsInPatch(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return [...value.matchAll(/(?:\+\+\+|---|\*\*\* (?:Add|Update|Delete) File:)\s*[^\s]+\s*$/gm)]
    .map((m) => m[0].replace(/^(?:\+\+\+|---|\*\*\* (?:Add|Update|Delete) File:)\s*/, "").trim());
}

function normalizePath(path: string, root = process.cwd()): string | null {
  if (!path || /[\0\r\n]/.test(path)) return null;
  const unix = path.replaceAll("\\", "/");
  const absolute = isAbsolute(unix) ? resolve(unix) : resolve(root, unix);
  const rel = relative(root, absolute);
  if (rel === ".." || rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(rel)) return null;
  if (existsSync(absolute)) {
    try {
      const real = realpathSync(absolute);
      const realRel = relative(root, real);
      if (realRel === ".." || realRel.startsWith("../") || isAbsolute(realRel)) return null;
    } catch { return null; }
    if (lstatSync(absolute).isSymbolicLink()) return null;
  }
  return rel.replaceAll("\\", "/");
}

function isChecklist(path: string): boolean {
  return /(^|\/)[^/]*Implementation[-_ ]Checklist\.md$/i.test(path) || /(^|\/)checklists?\/[^/]+\.md$/i.test(path);
}

function isSelectedChecklist(path: string): boolean {
  const selected = process.env.PLAYBOOK_CHECKLIST;
  if (!selected) return isChecklist(path);
  const normalized = normalizePath(selected);
  return normalized === path;
}

function isVerifier(input: unknown): boolean {
  const value = input as { agent?: unknown };
  return value.agent === "verifier" || (typeof value.agent === "object" && value.agent !== null && ((value.agent as {name?: string}).name === "verifier"));
}

function shellWriteTargets(command: unknown): string[] {
  if (typeof command !== "string") return [];
  const targets: string[] = [];
  for (const m of command.matchAll(/(?:>|>>|tee\s+(?:-a\s+)?|\b(?:cp|mv|rm|install|touch|mkdir)\s+)([^\s;&|]+)/g)) targets.push(m[1]);
  return targets;
}

export function checkWritePolicy(path: string, verifier = true): string | null {
  const normalized = normalizePath(path);
  if (!normalized) return "target path is absolute, traverses the repository, is a symlink, or cannot be determined";
  const forbidden = checkForbidden(normalized);
  if (forbidden) return forbidden;
  if (verifier && !(isSelectedChecklist(normalized) || /^verification\//.test(normalized) || /^deploy\/[^/]+\//.test(normalized))) {
    return "Verifier writes are limited to the selected implementation checklist, verification/**, or explicitly referenced deploy/<feature>/** helpers";
  }
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
      const args = output.args as Record<string, unknown>;
      const shell = input.tool === "bash" || input.tool === "shell" || input.tool === "run";
      if (!FILE_WRITING_TOOLS.has(input.tool) && !shell) return;

      const paths = shell ? shellWriteTargets(args?.command ?? args?.cmd) : [extractPath(input.tool, args), ...pathsInPatch(args?.patch), ...pathsInPatch(args?.patchText)].filter(Boolean) as string[];
      if (shell && !paths.length && isVerifier(input)) throw new Error("BLOCKED by spec-guardrails: verifier shell write target could not be determined; use a permitted file tool");
      if (!paths.length) return;

      const reason = paths.map((path) => checkWritePolicy(path!, isVerifier(input))).find(Boolean);
      if (reason) {
        await log("warn", `BLOCKED ${input.tool} of forbidden path`, {
          tool: input.tool,
          path: paths.join(", "),
          callId: input.callID,
        });
        // Throwing aborts the tool. The thrown message is what the agent
        // sees as the tool result.
        throw new Error(
          `BLOCKED by spec-guardrails: cannot ${input.tool} ${paths.join(", ")}.\n\n` +
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
