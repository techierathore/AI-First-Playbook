/**
 * checklist-lib.mjs — parse an implementation checklist into items and
 * sections. Markdown stays the source of truth; this only reads it.
 *
 * An item is an optional `<!-- metadata: {...} -->` line followed by
 * `- [ ] <title>` (or `- [x]`) and indented `- Field: value` lines, where a
 * value may continue on further indented lines.
 */
export const ITEM_TYPES = ["ui", "backend-api", "backend-service", "db", "logging", "infrastructure", "cross-cutting", "desktop"];
export const FIELD_ORDER = ["Type", "Behavior", "Location", "UI ref", "Logging", "Acceptance", "Verify", "Coding Standards", "Depends on"];

export function parseChecklist(text) {
  const lines = text.split("\n");
  const items = [];
  const sections = [];
  let pendingMeta = null;
  let current = null;
  let field = null;
  let fence = false;
  lines.forEach((line, index) => {
    if (/^\s*```/.test(line)) { fence = !fence; current = null; return; }
    if (fence) return;
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) { sections.push({ level: heading[1].length, title: heading[2].trim(), line: index + 1 }); current = null; pendingMeta = null; return; }
    const meta = line.match(/^\s*<!--\s*metadata:\s*(\{.*\})\s*-->\s*$/);
    if (meta) {
      try { pendingMeta = { value: JSON.parse(meta[1]), line: index + 1 }; }
      catch (error) { pendingMeta = { error: error.message, line: index + 1 }; }
      return;
    }
    const item = line.match(/^- \[( |x|X)\]\s+(.*)$/);
    if (item) {
      current = { line: index + 1, checked: item[1] !== " ", title: item[2].trim(), metadata: pendingMeta, fields: {}, order: [], extra: [] };
      items.push(current);
      pendingMeta = null;
      field = null;
      return;
    }
    if (!current) { if (line.trim()) pendingMeta = null; return; }
    const f = line.match(/^ {2}- ([A-Za-z][A-Za-z ]*?):\s*(.*)$/);
    if (f) {
      field = f[1];
      current.fields[field] = f[2].trim();
      current.order.push(field);
      return;
    }
    const more = line.match(/^ {4,}(\S.*)$/);
    if (more && field) { current.fields[field] = `${current.fields[field]} ${more[1].trim()}`.trim(); return; }
    const verifier = line.match(/^ {2}- \*\*Verifier Result\*\*/);
    if (verifier) { current.extra.push(line.trim()); field = null; return; }
    if (!line.trim()) { field = null; return; }
    if (/^\S/.test(line)) current = null;
    else current.extra.push(line.trim());
  });
  return { items, sections };
}

export function itemType(item) {
  return (item.fields.Type ?? "").toLowerCase().split(/[\s|,]+/)[0] || null;
}

export const wordCount = (text) => (String(text ?? "").match(/\S+/g) ?? []).length;
