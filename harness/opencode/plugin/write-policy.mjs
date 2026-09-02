/**
 * write-policy.mjs — the OpenCode spec-guardrails policy.
 *
 * Pure functions only: no OpenCode imports. This is the single source of
 * truth for the write rules used by ./spec-guardrails.ts.
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
 * OpenCode tool names whose file-write behaviour we police.
 */
export const FILE_WRITING_TOOLS = new Set([
  "write", "edit", "apply_patch", "patch", "create_file", "delete_file", "move_file",
]);

/** Tool names that reach the shell. */
export const SHELL_TOOLS = new Set(["bash"]);

const MISS_EMITTER = ".playbook/scripts/playbook-miss.mjs";
const MISS_STREAM = "verification/telemetry/misses.ndjson";
const MISS_VALUE_FLAGS = {
  open: new Set([
    "miss-class", "artifact", "severity", "why-missed", "item-id", "feature",
    "origin-phase", "origin-agent", "origin-run-id", "found-by", "found-phase",
    "found-phase-gate", "actor", "verdict-after", "fix-run-id", "fix-phase", "harness",
  ]),
  close: new Set(["miss-id", "item-id", "verdict-after", "fix-run-id", "fix-phase", "actor"]),
  list: new Set(["item-id"]),
};
const MISS_BOOLEAN_FLAGS = {
  open: new Set(["if-new", "fixed"]),
  list: new Set(["open"]),
};
const MISS_PHASE_GATE_TOKENS = new Map([
  ["PASS", "PASS"],
  ["FAIL", "FAIL"],
  ["PASS (code-audit)", "PASS_CODE_AUDIT"],
  ["FAIL (code-audit)", "FAIL_CODE_AUDIT"],
  ["DATA-GAP", "DATA_GAP"],
  ["BLOCKED", "BLOCKED"],
]);

/**
 * The sole verifier shell exception. It intentionally recognises a narrow
 * token grammar rather than trying to parse arbitrary shell: one optional
 * telemetry opt-in assignment, `node`, the exact repository-relative emitter
 * path, and one supported CLI shape. Path overrides and shell syntax are not
 * part of the grammar, so the emitter can only append its default stream.
 */
export function isApprovedMissEmitterCommand(command) {
  if (typeof command !== "string") return false;
  const trimmed = command.trim();
  // Shell line continuations are the only raw line breaks accepted. Collapse
  // exactly backslash + newline + indentation; an unescaped newline remains
  // visible to the deny-list below. Then remove quoting only for exact values
  // from the closed phase-gate vocabulary. All other quoting stays denied.
  const continued = trimmed.replace(/\\(?:\r\n|\n)[ \t]*/g, " ");
  const normalized = continued.replace(
    /--found-phase-gate=(["'])(PASS \(code-audit\)|FAIL \(code-audit\)|DATA-GAP|BLOCKED|PASS|FAIL)\1(?=\s|$)/g,
    (_match, _quote, value) => `--found-phase-gate=${MISS_PHASE_GATE_TOKENS.get(value)}`,
  );
  if (!normalized || /[;&|<>`$()'"\\\r\n]/.test(normalized)) return false;
  const tokens = normalized.split(/\s+/);
  if (tokens[0] === "PLAYBOOK_TELEMETRY=1") tokens.shift();
  if (tokens.shift() !== "node" || tokens.shift() !== MISS_EMITTER) return false;

  const verb = tokens.shift();
  if (verb === "next-id" || verb === "help") return tokens.length === 0;
  if (verb === "amend") {
    return tokens.length === 3 && tokens.every((token) => !token.startsWith("--"));
  }
  if (!Object.hasOwn(MISS_VALUE_FLAGS, verb)) return false;

  const valueFlags = MISS_VALUE_FLAGS[verb];
  const booleanFlags = MISS_BOOLEAN_FLAGS[verb] ?? new Set();
  for (const token of tokens) {
    const match = token.match(/^--([a-z][a-z0-9-]*)(?:=(.+))?$/);
    if (!match) return false;
    const [, name, value] = match;
    if (valueFlags.has(name)) {
      if (value == null) return false;
    } else if (booleanFlags.has(name)) {
      if (value != null) return false;
    } else {
      return false;
    }
  }
  return true;
}

/**
 * Extract the file path from an OpenCode tool input, if any.
 */
export function extractPath(tool, args) {
  if (!args) return null;
  if (typeof args.filePath === "string") return args.filePath;
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
  if (verifier && normalized === MISS_STREAM) {
    return `The durable miss stream is append-only; invoke the approved ${MISS_EMITTER} CLI without a --misses override`;
  }
  if (verifier && !(isSelectedChecklist(normalized) || /^verification\//.test(normalized) || /^deploy\/[^/]+\//.test(normalized))) {
    return "Verifier writes are limited to the selected implementation checklist, verification/**, or explicitly referenced deploy/<feature>/** helpers";
  }
  return null;
}

/**
 * Full evaluation for one tool call. Returns null when allowed, or
 * { reason, paths, message } when the call must be blocked. `isVerifier`
 * tells the policy whether the stricter verifier write-scope applies; the
 * plugin determines that from the OpenCode hook input.
 */
export function evaluateToolCall({ tool, args, isVerifier }) {
  const shell = SHELL_TOOLS.has(tool);
  if (!FILE_WRITING_TOOLS.has(tool) && !shell) return null;

  const command = args?.command ?? args?.cmd;
  if (shell && isVerifier && isApprovedMissEmitterCommand(command)) return null;
  if (shell && isVerifier && typeof command === "string" && command.includes(MISS_EMITTER)) {
    return {
      reason: "miss emitter invocation is not the approved standalone command shape",
      paths: [],
      message: `BLOCKED by spec-guardrails: invoke node ${MISS_EMITTER} as a standalone command without path overrides or shell operators`,
    };
  }

  const paths = shell
    ? shellWriteTargets(command)
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
 * Build the remediation text returned to the OpenCode agent.
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
