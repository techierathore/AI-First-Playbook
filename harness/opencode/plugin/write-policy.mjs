/**
 * write-policy.mjs — the harness-independent spec-guardrails policy.
 *
 * Pure functions only: no OpenCode imports, no Claude Code imports. This is
 * the single source of truth for the write rules; the harness carriers are
 * thin adapters around it:
 *   - OpenCode:    ./spec-guardrails.ts        (tool.execute.before plugin)
 *   - Claude Code: harness/claude-code/hooks/spec-guardrails-hook.mjs
 *                                              (PreToolUse hook)
 *
 * Uses the .mjs extension deliberately: OpenCode auto-discovers
 * {plugin,plugins}/*.{ts,js} as plugins, so a .js policy file here would be
 * loaded as a plugin in its own right. .mjs is importable but not discovered.
 */

import { existsSync, lstatSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

// ────────────────────────────────────────────────────────────────────────────
// FORBIDDEN FILE PATTERNS
// ────────────────────────────────────────────────────────────────────────────

/**
 * Any path matching these patterns is blocked from write/edit/patch.
 * The Verifier writes findings INLINE in the implementation checklist;
 * separate "gap report" or "verification report" files are forbidden.
 */
export const FORBIDDEN_PATH_PATTERNS = [
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
 * Tool names whose file-write behaviour we police.
 * write, edit, patch all eventually land on disk. Claude Code's capitalized
 * tool names are included so the same set serves both carriers.
 */
export const FILE_WRITING_TOOLS = new Set([
  "write", "edit", "apply_patch", "patch", "create_file", "delete_file", "move_file",
  "Write", "Edit", "NotebookEdit",
]);

/** Tool names that reach the shell. */
export const SHELL_TOOLS = new Set(["bash", "shell", "run", "Bash"]);

/**
 * Extract the file path from a tool input, if any. Handles the differing
 * parameter names used by write/edit/patch across harnesses.
 */
export function extractPath(tool, args) {
  if (!args) return null;
  // OpenCode write/edit use `filePath`; Claude Code Write/Edit use `file_path`
  if (typeof args.filePath === "string") return args.filePath;
  if (typeof args.file_path === "string") return args.file_path;
  if (typeof args.notebook_path === "string") return args.notebook_path;
  if (typeof args.path === "string") return args.path;
  if (typeof args.file === "string") return args.file;
  if (typeof args.target === "string") return args.target;
  return null;
}

export function pathsInPatch(value) {
  if (typeof value !== "string") return [];
  return [...value.matchAll(/(?:\+\+\+|---|\*\*\* (?:Add|Update|Delete) File:)\s*[^\s]+\s*$/gm)]
    .map((m) => m[0].replace(/^(?:\+\+\+|---|\*\*\* (?:Add|Update|Delete) File:)\s*/, "").trim());
}

export function normalizePath(path, root = process.cwd()) {
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

export function isChecklist(path) {
  return /(^|\/)[^/]*Implementation[-_ ]Checklist\.md$/i.test(path) || /(^|\/)checklists?\/[^/]+\.md$/i.test(path);
}

export function isSelectedChecklist(path) {
  const selected = process.env.PLAYBOOK_CHECKLIST;
  if (!selected) return isChecklist(path);
  const normalized = normalizePath(selected);
  return normalized === path;
}

export function shellWriteTargets(command) {
  if (typeof command !== "string") return [];
  const targets = [];
  // `>>?\s*` — redirects are commonly written with a space (`> file`); the
  // original regex missed those entirely.
  for (const m of command.matchAll(/(?:>>?\s*|tee\s+(?:-a\s+)?|\b(?:cp|mv|rm|install|touch|mkdir)\s+)([^\s;&|]+)/g)) targets.push(m[1]);
  return targets;
}

/**
 * Return the matching forbidden-pattern reason, or null if path is allowed.
 */
export function checkForbidden(path) {
  const basename = path.split("/").pop() || path;
  for (const { pattern, reason } of FORBIDDEN_PATH_PATTERNS) {
    if (pattern.test(basename)) return reason;
  }
  return null;
}

export function checkWritePolicy(path, verifier = true) {
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
 * Full evaluation for one tool call. Returns null when allowed, or
 * { reason, paths, message } when the call must be blocked. `isVerifier`
 * tells the policy whether the stricter verifier write-scope applies; the
 * carrier determines that from its own hook input.
 */
export function evaluateToolCall({ tool, args, isVerifier }) {
  const shell = SHELL_TOOLS.has(tool);
  if (!FILE_WRITING_TOOLS.has(tool) && !shell) return null;

  const paths = shell
    ? shellWriteTargets(args?.command ?? args?.cmd)
    : [extractPath(tool, args), ...pathsInPatch(args?.patch), ...pathsInPatch(args?.patchText)].filter(Boolean);

  if (shell && !paths.length && isVerifier) {
    return {
      reason: "verifier shell write target could not be determined",
      paths: [],
      message: "BLOCKED by spec-guardrails: verifier shell write target could not be determined; use a permitted file tool",
    };
  }
  if (!paths.length) return null;

  const reason = paths.map((path) => checkWritePolicy(path, isVerifier)).find(Boolean);
  if (!reason) return null;
  return { reason, paths, message: blockMessage(tool, paths, reason) };
}

/**
 * The block text is shared verbatim by both carriers so the agent gets
 * identical remediation instructions in either harness.
 */
export function blockMessage(tool, paths, reason) {
  return (
    `BLOCKED by spec-guardrails: cannot ${tool} ${paths.join(", ")}.\n\n` +
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
    `mechanically; no exception, no override.`
  );
}
