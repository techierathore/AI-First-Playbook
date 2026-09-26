#!/usr/bin/env node
/**
 * jira-issues.mjs — fetch Jira tickets into the Issues-file JSON shape.
 *
 *   node .playbook/scripts/jira-issues.mjs fetch <KEY|URL> ... --out=<issues.json>
 *   node .playbook/scripts/jira-issues.mjs convert <jira-response.json> --out=<issues.json>
 *
 * Credentials come only from an allowed channel: environment references
 * JIRA_BASE_URL, JIRA_EMAIL and JIRA_API_TOKEN, or a protected file named by
 * JIRA_CONFIG (mode 0600, not tracked by git) holding {baseUrl, email,
 * apiToken}. Nothing about them is printed; a key or URL on the command line
 * is the only input. Browse URLs are reduced to keys. The description (Atlassian
 * Document Format) is converted to Markdown and split into Expected, Actual and
 * Steps where headed so; anything absent stays [MISSING] for a person to fill.
 * Priority maps to High | Medium | Low. Pipe the output to issues-file.mjs render.
 */
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

export const keyOf = (s) => s.match(/([A-Z][A-Z0-9]+-\d+)/)?.[1] ?? null;

export function adfToMarkdown(node, depth = 0) {
  if (!node) return "";
  if (typeof node === "string") return node;
  const kids = (n) => (n.content ?? []).map((c) => adfToMarkdown(c, depth)).join("");
  switch (node.type) {
    case "doc": return (node.content ?? []).map((c) => adfToMarkdown(c, depth)).join("\n").trim();
    case "paragraph": return `${kids(node)}\n`;
    case "heading": return `${"#".repeat(Math.min(6, (node.attrs?.level ?? 1) + 2))} ${kids(node)}\n`;
    case "text": {
      let t = node.text ?? "";
      for (const m of node.marks ?? []) {
        if (m.type === "strong") t = `**${t}**`;
        else if (m.type === "em") t = `*${t}*`;
        else if (m.type === "code") t = `\`${t}\``;
        else if (m.type === "link") t = `[${t}](${m.attrs?.href ?? ""})`;
      }
      return t;
    }
    case "hardBreak": return "\n";
    case "bulletList": return (node.content ?? []).map((li) => `${"  ".repeat(depth)}- ${adfToMarkdown(li, depth + 1).trim()}\n`).join("");
    case "orderedList": return (node.content ?? []).map((li, i) => `${"  ".repeat(depth)}${i + 1}. ${adfToMarkdown(li, depth + 1).trim()}\n`).join("");
    case "listItem": return (node.content ?? []).map((c) => adfToMarkdown(c, depth)).join("").trim();
    case "codeBlock": return `\n\`\`\`${node.attrs?.language ?? ""}\n${kids(node)}\n\`\`\`\n`;
    case "mention": return `@${node.attrs?.text ?? "user"}`;
    default: return kids(node);
  }
}

function section(md, names) {
  const re = new RegExp(`(?:^|\\n)(?:#+\\s*|\\*\\*)?(?:${names.join("|")})(?:\\*\\*)?\\s*:?\\s*\\n?([\\s\\S]*?)(?=\\n(?:#+\\s*|\\*\\*)?(?:Expected|Actual|Steps|Steps to reproduce)(?:\\*\\*)?\\s*:?|$)`, "i");
  return md.match(re)?.[1]?.trim() || null;
}

export function toIssue(ticket) {
  const f = ticket.fields ?? {};
  const md = adfToMarkdown(f.description);
  const stepsText = section(md, ["Steps to reproduce", "Steps"]);
  const steps = stepsText ? stepsText.split("\n").map((l) => l.replace(/^\s*(\d+\.|-)\s*/, "").trim()).filter(Boolean) : [];
  const priority = String(f.priority?.name ?? "");
  return {
    key: ticket.key,
    title: f.summary ?? null,
    expected: section(md, ["Expected", "Expected result"]),
    actual: section(md, ["Actual", "Actual result"]),
    steps,
    severity: /highest|high|critical|blocker/i.test(priority) ? "High" : /low/i.test(priority) ? "Low" : priority ? "Medium" : null,
  };
}

export function credentials(env = process.env) {
  if (env.JIRA_CONFIG) {
    const p = env.JIRA_CONFIG;
    if (!existsSync(p)) return { error: "JIRA_CONFIG names a file that does not exist" };
    if ((statSync(p).mode & 0o077) !== 0) return { error: "JIRA_CONFIG file must be mode 0600 (readable only by you)" };
    if (spawnSync("git", ["ls-files", "--error-unmatch", p], { stdio: "ignore" }).status === 0) return { error: "JIRA_CONFIG file is tracked by git; untrack it and rotate the token" };
    const c = JSON.parse(readFileSync(p, "utf8"));
    return { baseUrl: c.baseUrl, email: c.email, token: c.apiToken };
  }
  if (env.JIRA_BASE_URL && env.JIRA_EMAIL && env.JIRA_API_TOKEN) return { baseUrl: env.JIRA_BASE_URL, email: env.JIRA_EMAIL, token: env.JIRA_API_TOKEN };
  return { error: "no Jira credentials: set JIRA_BASE_URL, JIRA_EMAIL and JIRA_API_TOKEN, or JIRA_CONFIG to a protected file" };
}

export async function fetchIssues(inputs, cred) {
  const issues = [];
  const failures = [];
  for (const input of inputs) {
    const key = keyOf(input);
    if (!key) { failures.push(`${input}: not a Jira key or browse URL`); continue; }
    const res = await fetch(`${cred.baseUrl.replace(/\/$/, "")}/rest/api/3/issue/${key}?fields=summary,description,priority`, {
      headers: { Authorization: `Basic ${Buffer.from(`${cred.email}:${cred.token}`).toString("base64")}`, Accept: "application/json" },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) { failures.push(`${key}: Jira answered ${res.status}`); continue; }
    issues.push(toIssue(await res.json()));
  }
  return { issues, failures };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [verb, ...rest] = process.argv.slice(2);
  const out = rest.find((a) => a.startsWith("--out="))?.slice(6);
  const inputs = rest.filter((a) => !a.startsWith("--"));
  if (verb === "convert" && inputs[0] && out) {
    const data = JSON.parse(readFileSync(inputs[0], "utf8"));
    const issues = (Array.isArray(data) ? data : data.issues ?? [data]).map(toIssue);
    writeFileSync(out, `${JSON.stringify(issues, null, 2)}\n`);
    console.log(`jira-issues: converted ${issues.length} ticket(s) to ${out}`);
    process.exit(0);
  }
  if (verb === "fetch" && inputs.length && out) {
    const cred = credentials();
    if (cred.error) { console.log(`BLOCKED — ${cred.error}`); process.exit(2); }
    const { issues, failures } = await fetchIssues(inputs, cred);
    writeFileSync(out, `${JSON.stringify(issues, null, 2)}\n`);
    for (const f of failures) console.log(`failed ${f}`);
    console.log(`jira-issues: ${issues.length} of ${inputs.length} ticket(s) written to ${out}`);
    process.exit(failures.length ? 1 : 0);
  }
  console.log("usage: fetch <KEY|URL> ... --out=<json> | convert <response.json> --out=<json>");
  process.exit(2);
}
