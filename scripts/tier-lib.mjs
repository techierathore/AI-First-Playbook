/**
 * tier-lib.mjs — shared helpers for playbook/model-tiers.yml consumers
 * (apply-model-tiers.mjs and harness-install.mjs).
 */

/**
 * Minimal parser for this repo's model-tiers.yml only (two-level maps of
 * scalar values, `#` comments). Not a general YAML parser — kept dependency
 * free on purpose. If the file grows beyond this shape, switch to a real
 * YAML library.
 */
export function parseTiersYaml(text) {
  const out = {};
  let section = null;
  let sub = null;
  for (const raw of text.split("\n")) {
    const line = raw.replace(/#.*$/, "").trimEnd();
    if (!line.trim()) continue;
    const indent = raw.match(/^ */)[0].length;
    const m = line.trim().match(/^([\w-]+):\s*(.*)$/);
    if (!m) continue;
    const [, key, valueRaw] = m;
    const value = valueRaw.replace(/^["']|["']$/g, "");
    if (indent === 0) { section = key; sub = null; out[section] = value ? value : {}; }
    else if (indent === 2 && typeof out[section] === "object") { sub = key; out[section][sub] = value ? value : {}; }
    else if (indent === 4 && sub && typeof out[section][sub] === "object") { out[section][sub][key] = value; }
  }
  return out;
}

export function resolveModel(tiers, tier, forHarness) {
  const entry = tiers[tier];
  if (!entry) throw new Error(`unknown tier '${tier}'`);
  const model = entry[forHarness];
  if (!model) throw new Error(`tier '${tier}' has no model for harness '${forHarness}'`);
  return model;
}

/** Set (or replace) a frontmatter field, preserving everything else. */
export function stampFrontmatter(text, field, value) {
  if (!text.startsWith("---")) {
    return `---\n${field}: ${value}\n---\n\n${text}`;
  }
  const end = text.indexOf("\n---", 3);
  if (end === -1) throw new Error("unterminated frontmatter");
  let head = text.slice(0, end);
  const body = text.slice(end);
  const lineRe = new RegExp(`^${field}:.*$`, "m");
  if (lineRe.test(head)) head = head.replace(lineRe, `${field}: ${value}`);
  else head = `${head}\n${field}: ${value}`;
  return head + body;
}

export function readFrontmatterField(text, field) {
  if (!text.startsWith("---")) return null;
  const end = text.indexOf("\n---", 3);
  if (end === -1) return null;
  const m = text.slice(0, end).match(new RegExp(`^${field}:\\s*(.*)$`, "m"));
  return m ? m[1].trim() : null;
}

/** Split a markdown file into { frontmatter fields, body }. Simple scalar fields only. */
export function splitMarkdown(text) {
  if (!text.startsWith("---")) return { fields: {}, body: text };
  const end = text.indexOf("\n---", 3);
  if (end === -1) return { fields: {}, body: text };
  const head = text.slice(4, end);
  const body = text.slice(end + 4).replace(/^\n+/, "");
  const fields = {};
  let currentKey = null;
  for (const line of head.split("\n")) {
    const m = line.match(/^([\w-]+):\s*(.*)$/);
    if (m) {
      currentKey = m[1];
      fields[currentKey] = m[2].replace(/^>\s*$/, "").trim();
    } else if (currentKey && /^\s+\S/.test(line)) {
      fields[currentKey] = (fields[currentKey] ? fields[currentKey] + " " : "") + line.trim();
    }
  }
  return { fields, body };
}
