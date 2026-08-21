/**
 * yolo-policy.mjs — the harness-independent YOLO (unattended-run) policy.
 *
 * Pure functions only: no OpenCode imports, no Claude Code imports. This is
 * the single source of truth for what YOLO mode may and may not do; the
 * harness carriers are thin adapters around it:
 *   - OpenCode:    ./yolo.ts                               (permission.ask + event plugin)
 *   - Claude Code: harness/claude-code/hooks/yolo-hook.mjs (PreToolUse + PermissionRequest hook)
 *   - Supervisor:  scripts/playbook-yolo.mjs               (rate-limit wait + restart loop)
 *
 * YOLO mode is ON when PLAYBOOK_YOLO=1 is in the environment (the supervisor
 * sets it; a human can export it before starting the TUI). The prompt-level
 * trigger — the word YOLO in a command's arguments, or a Claude Code /goal —
 * is honoured by the command bodies (AGENTS.md "YOLO mode"); the mechanical
 * carriers key off the environment variable only, because a hook cannot see
 * the conversation.
 *
 * What YOLO changes, mechanically:
 *   - every permission prompt is auto-approved (file writes, deletes, shell,
 *     external directories, doom-loop warnings, MCP/web tools) ...
 *   - ... EXCEPT git history / index / ref writes: commit, push, tag, add,
 *     rebase, reset, merge, amend, filter-branch, stash drop, branch -D and
 *     friends stay DENIED. Read-only git (status, log, diff, show, blame,
 *     branch listing, fetch) is allowed. AGENTS.md "agents do not commit" is
 *     unchanged — YOLO makes it mechanical instead of prose.
 *
 * Uses the .mjs extension deliberately (same reason as write-policy.mjs):
 * OpenCode auto-discovers plugin/*.{ts,js}; .mjs is importable, not loaded.
 */

// ────────────────────────────────────────────────────────────────────────────
// MODE DETECTION
// ────────────────────────────────────────────────────────────────────────────

/** Tool names that reach the shell, in either harness. */
export const SHELL_TOOLS_YOLO = new Set(["bash", "shell", "run", "Bash"]);

/** True when the environment says we are in an unattended YOLO run. */
export function isYoloEnv(env = process.env) {
  const v = String(env.PLAYBOOK_YOLO ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/**
 * True when a command's argument string carries the YOLO trigger word as a
 * standalone token (`/implement YOLO @checklist`, `/fix docs/x.md *YOLO*`).
 * Used by tests and the supervisor; command bodies apply the same reading.
 */
export function hasYoloToken(text) {
  return typeof text === "string" && /(^|[\s,;:(\[])\*{0,2}yolo\*{0,2}(?=$|[\s,;:)\]!.])/i.test(text);
}

// ────────────────────────────────────────────────────────────────────────────
// GIT WRITE DETECTION — the one thing YOLO never unlocks
// ────────────────────────────────────────────────────────────────────────────

/** git subcommands that rewrite history, move refs, touch the index, or publish. */
export const GIT_WRITE_SUBCOMMANDS = new Set([
  "commit", "push", "tag", "add", "stage", "rm", "mv", "rebase", "reset", "merge",
  "cherry-pick", "revert", "filter-branch", "filter-repo", "am", "apply", "reflog",
  "gc", "prune", "update-ref", "symbolic-ref", "replace", "notes", "remote", "submodule",
  "worktree", "switch", "checkout", "restore", "clean", "bisect", "pull", "init", "clone",
]);

/**
 * git subcommands that are read-only. Anything in NEITHER set is denied in
 * YOLO — fail closed.
 */
export const GIT_READ_SUBCOMMANDS = new Set([
  "status", "log", "diff", "show", "blame", "branch", "describe", "rev-parse", "rev-list",
  "ls-files", "ls-tree", "ls-remote", "cat-file", "shortlog", "grep", "config", "fetch",
  "var", "version", "help", "count-objects", "name-rev", "whatchanged", "stash", "for-each-ref",
  "check-ignore", "merge-base", "cherry", "range-diff", "diff-tree", "diff-index", "show-ref",
]);

/** Flags/args that turn an otherwise read-only subcommand into a write. */
const WRITE_FLAGS = {
  branch: /(^|\s)(-d|-D|--delete|-m|-M|--move|-c|-C|--copy|-f|--force|--set-upstream-to=?\S*|-u|--unset-upstream|--edit-description)(\s|$)/,
  stash: /(^|\s)(push|pop|drop|clear|apply|save|branch|store|create)(\s|$)|^\s*$/, // bare `git stash` = push
  config: /(^|\s)(--unset|--unset-all|--add|--replace-all|--edit|-e|--remove-section|--rename-section)(\s|$)/,
  fetch: /(^|\s)(--prune-tags|-P|--update-head-ok)(\s|$)/,
};

/**
 * Split a shell command line into its segments (on ; && || | newline $( `)
 * so `cd x && git commit -m y` is still caught. Not a full shell parser —
 * deliberately conservative.
 */
export function shellSegments(command) {
  if (typeof command !== "string") return [];
  return command
    .split(/(?:\|\||&&|;|\||\n|\$\(|`)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Return a human-readable reason when `command` contains a git history /
 * ref / index write (or a gh publish), otherwise null.
 */
export function gitWriteReason(command) {
  for (const seg of shellSegments(command)) {
    // strip leading env assignments and wrappers: FOO=1 sudo nice timeout 5 env git …
    const words = seg.replace(/^(?:\w+=\S*\s+)*(?:sudo\s+|nice\s+|env\s+|timeout\s+\S+\s+)*/, "").split(/\s+/);
    const gi = words.findIndex((w) => /^(?:\S*[\\/])?git(?:\.exe)?$/i.test(w));
    if (gi === -1) {
      if (/^gh\s+(pr|release|repo|issue)\s+(create|merge|delete|edit|close|fork|sync|upload|comment|review)/i.test(seg)) {
        return `\`${seg}\` publishes via gh — YOLO never publishes`;
      }
      continue;
    }
    // skip global options: git -C path -c k=v --no-pager <sub>
    let i = gi + 1;
    while (i < words.length && words[i].startsWith("-")) {
      i += ["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--exec-path"].includes(words[i]) ? 2 : 1;
    }
    const sub = (words[i] ?? "").toLowerCase();
    const rest = words.slice(i + 1).join(" ");
    if (!sub) continue; // bare `git` prints help
    if (GIT_WRITE_SUBCOMMANDS.has(sub)) {
      return `\`git ${sub}\` writes to the repository history/index/refs — agents never commit, stage, push or rewrite (AGENTS.md)`;
    }
    if (GIT_READ_SUBCOMMANDS.has(sub)) {
      const flag = WRITE_FLAGS[sub];
      if (flag && flag.test(rest)) return `\`git ${sub} ${rest}\` mutates refs/config/stash — not allowed in YOLO`;
      continue;
    }
    return `\`git ${sub}\` is not on the YOLO read-only allowlist — fail closed`;
  }
  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// PERMISSION DECISION
// ────────────────────────────────────────────────────────────────────────────

/**
 * Decide a permission request in YOLO mode → { decision: "allow"|"deny", reason }.
 * `tool` is the harness tool name (bash/Bash/edit/Write/…); `args` its input.
 * Everything that is not a git/gh write is allowed — that is the point.
 */
export function yoloDecision({ tool, args }) {
  const command = args?.command ?? args?.cmd;
  if (typeof command === "string") {
    const reason = gitWriteReason(command);
    if (reason) {
      return {
        decision: "deny",
        reason: `BLOCKED by yolo-policy: ${reason}. Leave the working tree for the human to commit; report \`git status\` and what changed instead.`,
      };
    }
  }
  return { decision: "allow", reason: `YOLO mode (PLAYBOOK_YOLO=1): ${tool ?? "tool"} auto-approved` };
}

// ────────────────────────────────────────────────────────────────────────────
// RATE / USAGE LIMIT DETECTION
// ────────────────────────────────────────────────────────────────────────────

/** Buffer added to a parsed reset time before the supervisor restarts the agent. */
export const DEFAULT_BUFFER_MINUTES = 15;
/** Wait used when a limit is detected but no reset time can be parsed. */
export const DEFAULT_UNPARSED_WAIT_MINUTES = 60;
/** Cap per wait cycle; a weekly limit still resumes, one check per day. */
export const MAX_WAIT_MINUTES = 24 * 60;

const LIMIT_PATTERNS = [
  /rate[ _-]?limit/i,
  /usage[ _-]?limit/i,
  /hit your (?:\w+ )?limit/i,
  /limit (?:has been )?reached/i,
  /reached your (?:\w+ )?limit/i,
  /out of (?:extra )?usage/i,
  /weekly limit/i,
  /5[- ]hour (?:limit|window)/i,
  /too many requests/i,
  /\b429\b/,
  /rate_limit_error/i,
  /overloaded_error/i,
  /quota (?:exceeded|exhausted)/i,
  /enforced_spend_limit_reached/i,
  /regain access on/i,
  /resets?\s+(?:at\s+|in\s+|on\s+)?(?:\(?(?:sun|mon|tue|wed|thu|fri|sat)[a-z]*\)?\s*)?\d/i,
];

/** True when `text` looks like a provider/harness usage-limit error. */
export function isRateLimitText(text) {
  return typeof text === "string" && text.length > 0 && LIMIT_PATTERNS.some((p) => p.test(text));
}

/** Offset (ms) of IANA `tz` from UTC at instant `at`; null for unknown zones. */
export function tzOffsetMs(tz, at) {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    const p = Object.fromEntries(fmt.formatToParts(at).map((x) => [x.type, x.value]));
    const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
    return asUtc - Math.floor(at.getTime() / 1000) * 1000;
  } catch {
    return null;
  }
}

const TZ_ABBREV = {
  utc: "UTC", gmt: "UTC", z: "UTC", ist: "Asia/Kolkata",
  pst: "America/Los_Angeles", pdt: "America/Los_Angeles", est: "America/New_York", edt: "America/New_York",
  cst: "America/Chicago", cdt: "America/Chicago", mst: "America/Denver", mdt: "America/Denver",
  bst: "Europe/London", cet: "Europe/Berlin", cest: "Europe/Berlin", aest: "Australia/Sydney", jst: "Asia/Tokyo",
};

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/**
 * Next occurrence (strictly after `now`) of wall-clock hh:mm in timezone `tz`
 * (IANA name, abbreviation, or null → PLAYBOOK_TZ or the supervisor's local
 * zone). `weekday` (0–6) pins it to that weekday when given.
 */
export function nextWallClock(hour, minute, tz, now, env = process.env, weekday = null) {
  const zone = tz ? (TZ_ABBREV[tz.toLowerCase()] ?? tz) : (env.PLAYBOOK_TZ || null);
  if (!zone) {
    const d = new Date(now);
    d.setHours(hour, minute, 0, 0);
    if (d <= now) d.setDate(d.getDate() + 1);
    if (weekday !== null) while (d.getDay() !== weekday) d.setDate(d.getDate() + 1);
    return d;
  }
  const off = tzOffsetMs(zone, now);
  if (off === null) return null;
  const local = new Date(now.getTime() + off); // `now` expressed as if the zone were UTC
  let cand = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), hour, minute, 0) - off;
  if (cand <= now.getTime()) cand += 86400000;
  if (weekday !== null) while (new Date(cand + off).getUTCDay() !== weekday) cand += 86400000;
  return new Date(cand);
}

/**
 * Parse a reset instant out of a limit message. Handles the shapes the two
 * harnesses and the API actually emit:
 *   "You've hit your session limit · resets 3:45pm"        (Claude Code)
 *   "You've hit your weekly limit · resets Mon 12:00am"    (Claude Code)
 *   "resets 3pm (UTC)", "resets at 2:30pm (America/Los_Angeles)", "reset at 15:00 IST"
 *   "resets in 2 hours 13 minutes", "retry after 3600 seconds", "retry-after: 120"
 *   "You will regain access on 2026-09-01 at 00:00 UTC"    (API spend cap)
 *   "anthropic-ratelimit-input-tokens-reset: 2026-08-21T15:30:00Z", any ISO-8601
 *   "resets_at": 1724256000                                 (epoch s / ms)
 * Returns a Date, or null when nothing usable is present.
 */
export function parseResetTime(text, now = new Date(), env = process.env) {
  if (typeof text !== "string" || !text) return null;
  let m;

  // "on 2026-09-01 at 00:00 UTC"
  if ((m = text.match(/(\d{4}-\d{2}-\d{2})\s+at\s+(\d{1,2}):(\d{2})\s*([A-Za-z_\/]+)?/))) {
    const tz = m[4] ? (TZ_ABBREV[m[4].toLowerCase()] ?? m[4]) : "UTC";
    const base = new Date(`${m[1]}T${m[2].padStart(2, "0")}:${m[3]}:00Z`);
    const off = tzOffsetMs(tz, base);
    const d = new Date(base.getTime() - (off ?? 0));
    if (!Number.isNaN(d.getTime()) && d > now) return d;
  }

  // ISO-8601 anywhere
  for (const cand of [...text.matchAll(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?/g)].map((x) => x[0])) {
    const d = new Date(cand.replace(" ", "T"));
    if (!Number.isNaN(d.getTime()) && d > now) return d;
  }

  // epoch seconds / ms next to reset/retry keywords
  if ((m = text.match(/(?:reset|retry|until)\D{0,40}?(\d{10}|\d{13})\b/i))) {
    const d = new Date(m[1].length === 13 ? Number(m[1]) : Number(m[1]) * 1000);
    if (d > now) return d;
  }

  // relative: "in 2 hours 13 minutes", "in 45m", "retry after 3600 seconds"
  if ((m = text.match(/(?:resets?|try again|retry|available|wait)\s*(?:-?\s*after|in)\s*:?\s*((?:\d+\s*(?:h(?:ours?|rs?)?|m(?:in(?:ute)?s?)?|s(?:ec(?:ond)?s?)?|d(?:ays?)?)\b\s*(?:and\s*)?)+)/i))) {
    let ms = 0;
    for (const part of m[1].matchAll(/(\d+)\s*(h|m|s|d)/gi)) {
      const u = part[2].toLowerCase();
      ms += Number(part[1]) * (u === "d" ? 86400000 : u === "h" ? 3600000 : u === "m" ? 60000 : 1000);
    }
    if (ms > 0) return new Date(now.getTime() + ms);
  }
  if ((m = text.match(/retry-after\s*[:=]\s*(\d+)/i))) return new Date(now.getTime() + Number(m[1]) * 1000);

  // wall clock, optional weekday, optional zone:
  // "resets 3:45pm", "resets Mon 12:00am", "resets at 2:30 pm (America/Los_Angeles)", "reset at 15:00 IST"
  if ((m = text.match(/(?:resets?|reset(?:ting)?|try again|available|until|back)\s*(?:at|@|on)?\s*(?:(sun|mon|tue|wed|thu|fri|sat)[a-z]*,?\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:\(([A-Za-z_\/+\-0-9]+)\)|\b([A-Z]{2,5})\b)?/i))) {
    let hour = Number(m[2]); const minute = Number(m[3] ?? 0); const ap = (m[4] ?? "").toLowerCase();
    if (ap === "pm" && hour < 12) hour += 12;
    if (ap === "am" && hour === 12) hour = 0;
    if (hour <= 23 && minute <= 59 && (ap || m[3])) {
      const weekday = m[1] ? WEEKDAYS.indexOf(m[1].toLowerCase()) : null;
      const d = nextWallClock(hour, minute, m[5] ?? m[6] ?? null, now, env, weekday);
      if (d) return d;
    }
  }

  // "Aug 21, 2026 14:00 UTC" / "21 Aug 2026 2:00 PM"
  if ((m = text.match(/\b(\d{1,2}\s+[A-Z][a-z]{2,8}\s+\d{4}|[A-Z][a-z]{2,8}\s+\d{1,2},?\s+\d{4})\s+(\d{1,2}:\d{2}(?:\s*[ap]m)?)\s*([A-Z]{2,5})?/))) {
    const d = new Date(`${m[1]} ${m[2]} ${m[3] ?? ""}`.trim());
    if (!Number.isNaN(d.getTime()) && d > now) return d;
  }
  return null;
}

/**
 * Given harness/provider output, return a restart plan, or null when the text
 * is not a limit error:
 *   { resetAt: Date|null, retryAt: Date, waitMs, parsed: boolean, bufferMinutes }
 * retryAt = resetAt + buffer, or now + defaultWait when no reset time parsed;
 * capped at MAX_WAIT_MINUTES and never in the past.
 */
export function rateLimitPlan(text, { now = new Date(), bufferMinutes = DEFAULT_BUFFER_MINUTES, defaultWaitMinutes = DEFAULT_UNPARSED_WAIT_MINUTES, env = process.env } = {}) {
  if (!isRateLimitText(text)) return null;
  const resetAt = parseResetTime(text, now, env);
  let retryAt = resetAt
    ? new Date(resetAt.getTime() + bufferMinutes * 60000)
    : new Date(now.getTime() + defaultWaitMinutes * 60000);
  const cap = now.getTime() + MAX_WAIT_MINUTES * 60000;
  if (retryAt.getTime() > cap) retryAt = new Date(cap);
  if (retryAt <= now) retryAt = new Date(now.getTime() + bufferMinutes * 60000);
  return { resetAt, retryAt, waitMs: retryAt.getTime() - now.getTime(), parsed: Boolean(resetAt), bufferMinutes };
}

// ────────────────────────────────────────────────────────────────────────────
// RUN SENTINELS — how an unattended run tells the supervisor it is done
// ────────────────────────────────────────────────────────────────────────────

/** Printed by the agent as the LAST line when the goal / phase is fully complete. */
export const SENTINEL_COMPLETE = "PLAYBOOK_RUN_COMPLETE";
/** Printed when everything possible is done and a genuine external blocker remains. */
export const SENTINEL_BLOCKED = "PLAYBOOK_RUN_BLOCKED";

/** "complete" | "blocked" | "unknown" from a run's final output. */
export function runOutcome(text) {
  if (typeof text !== "string") return "unknown";
  if (new RegExp(`^\\s*${SENTINEL_COMPLETE}\\b`, "m").test(text)) return "complete";
  if (new RegExp(`^\\s*${SENTINEL_BLOCKED}\\b`, "m").test(text)) return "blocked";
  return "unknown";
}
