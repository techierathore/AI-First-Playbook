/**
 * profile-lib.mjs — read the environment profile without guessing.
 *
 * The profile (`.playbook/environment-profile.yml` when installed,
 * `playbook/environment-profile.yml` in the source checkout) is the only
 * authority for topology, commands, URLs, logs and cleanup. This reader
 * understands the profile's own shape: two levels of keys, scalars, quoted
 * strings, inline [a, b] lists and # comments. A value still carrying a
 * `<replace...>` or `<...>` marker is a placeholder and is reported, never used.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function profilePath(root = process.cwd()) {
  for (const candidate of [".playbook/environment-profile.yml", "playbook/environment-profile.yml"]) {
    if (existsSync(join(root, candidate))) return join(root, candidate);
  }
  return null;
}

function scalar(raw) {
  let value = raw.trim();
  if (!value) return null;
  if (value.startsWith("[")) {
    const inner = value.replace(/#.*$/, "").trim().replace(/^\[|\]$/g, "");
    return inner.split(",").map((item) => scalar(item)).filter((item) => item !== null);
  }
  if (value.startsWith('"')) {
    // YAML double-quoted scalar: honour \" and \\ escapes.
    let out = "";
    for (let i = 1; i < value.length; i += 1) {
      if (value[i] === "\\" && i + 1 < value.length) { out += value[i + 1]; i += 1; continue; }
      if (value[i] === '"') return out;
      out += value[i];
    }
    return out;
  }
  if (value.startsWith("'")) {
    const m = value.match(/^'((?:[^']|'')*)'/);
    return m ? m[1].replaceAll("''", "'") : value.slice(1);
  }
  value = value.replace(/\s+#.*$/, "").trim();
  if (/^-?\d+$/.test(value)) return Number(value);
  if (value === "true" || value === "false") return value === "true";
  return value;
}

export function parseProfile(text) {
  const profile = {};
  let section = null;
  for (const line of text.split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const m = line.match(/^(\s*)([A-Za-z0-9_]+):(.*)$/);
    if (!m) continue;
    const [, indent, key, rest] = m;
    const value = rest.replace(/^\s*#.*$/, "");
    if (!indent) {
      if (!value.trim()) { profile[key] = {}; section = key; }
      else { profile[key] = scalar(value); section = null; }
    } else if (section) {
      profile[section][key] = scalar(value);
    }
  }
  return profile;
}

export function readProfile(root = process.cwd()) {
  const path = profilePath(root);
  if (!path) return { path: null, profile: null };
  return { path, profile: parseProfile(readFileSync(path, "utf8")) };
}

export const isPlaceholder = (value) => typeof value === "string" && /<[^>]+>/.test(value);

/** Every profile field whose value (or list item) is still a placeholder. */
export function placeholders(profile, prefix = "") {
  const found = [];
  for (const [key, value] of Object.entries(profile ?? {})) {
    const name = prefix ? `${prefix}.${key}` : key;
    if (Array.isArray(value)) { if (value.some(isPlaceholder)) found.push(name); }
    else if (value && typeof value === "object") found.push(...placeholders(value, name));
    else if (isPlaceholder(value)) found.push(name);
  }
  return found;
}

/** A profile value by dotted name, or a BLOCKED reason when it cannot be used. */
export function field(profile, name) {
  const value = name.split(".").reduce((node, key) => (node == null ? undefined : node[key]), profile);
  if (value == null || value === "") return { blocked: `profile field ${name} is missing` };
  if (isPlaceholder(value) || (Array.isArray(value) && value.some(isPlaceholder))) return { blocked: `profile field ${name} is a placeholder` };
  return { value };
}

/** UTC run ID in the Playbook's shape, e.g. verify-20260926T101500Z. */
export function runId(prefix = "run", now = new Date()) {
  return `${prefix}-${now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")}`;
}

/** Raw evidence for one run lives under the git-ignored runs folder. */
export function runDirectory(root, id) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id ?? "")) throw new Error(`invalid run id: ${id}`);
  return join(root, "verification", "runs", id);
}
