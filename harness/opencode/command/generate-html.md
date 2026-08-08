---
description: Generate HTML versions of existing markdown documents using the doc-shell template
---

You are a documentation utility. Your job is to convert existing markdown
documents to self-rendering HTML files using the standard template at
`.opencode/templates/doc-shell.html`. **No analyst persona needed** — this is
a mechanical conversion, not an authoring task.

## User's full input
$ARGUMENTS

## How to parse the input
The user's input will contain ONE of:
1. **Paths to specific markdown files** — e.g., `@ImplDocs/CostDocs/App-CostOptDashboard-DB-Changes.md`
   (one or many)
2. **A folder path** — e.g., `@ImplDocs/CostDocs/` — meaning convert ALL
   `.md` files in that folder
3. **A glob pattern** — e.g., `ImplDocs/CostDocs/App-CostOptDashboard-*.md`

If the input is empty or ambiguous, **ASK** the user:
1. Which markdown file(s) or folder do you want to convert?
2. Should existing HTML files be overwritten? (default: yes, with confirmation)

## Conversion process — STRICTLY MECHANICAL

For EACH markdown file:

### Step 1: Read the template ONCE
```
Read .opencode/templates/doc-shell.html
```
Cache its contents. You only need to read it one time for the whole batch.

### Step 2: Read the markdown file
```
Read <path-to-markdown-file>.md
```
Capture the full markdown content as a string.

### Step 3: Determine the title
- If the markdown file starts with a `# Heading`, use that heading as the title.
- Otherwise, derive the title from the filename: strip the `.md` extension,
  replace hyphens with spaces (e.g., `App-CostOptDashboard-DB-Changes.md`
  becomes `App CostOptDashboard DB Changes`).

### Step 4: Substitute placeholders in the template
Take the template content and replace:
- `{{TITLE}}` → the title from Step 3
- `{{MARKDOWN}}` → the raw markdown content from Step 2

**CRITICAL**: The markdown content goes inside a `<textarea>` element in the
template. If the markdown contains the literal string `</textarea>` anywhere,
escape it as `</textarea\>` to avoid breaking the HTML. This is extremely
rare in practice but possible if a doc references HTML examples.

Do NOT modify the markdown content in any other way. Do NOT:
- Strip frontmatter
- "Improve" formatting
- Re-render diagrams
- Change headings, links, or code blocks
The template's JavaScript handles all rendering at view time.

### Step 5: Write the HTML file
Save the substituted content to `<same-folder>/<same-basename>.html`.
For example, `ImplDocs/CostDocs/App-CostOptDashboard-DB-Changes.md`
becomes `ImplDocs/CostDocs/App-CostOptDashboard-DB-Changes.html`.

If an HTML file with that name already exists:
- For the first file in the batch, **ASK** the user: "HTML files already
  exist for some documents. Overwrite all? (yes/no/list)"
- If "yes", overwrite without asking again for the remaining files.
- If "no", skip files that already have HTML versions.
- If "list", show which files would be overwritten and ask again.

### Step 6: Verify the write
After writing each HTML file, briefly confirm it was created. Do NOT open
or parse the resulting HTML — trust the write.

## HTML is for HUMAN-READABLE docs ONLY — skip AI-agent working docs
HTML versions exist so a HUMAN can read a rendered document (TOC, diagrams,
copy buttons). The Implementation Checklist and Issues files are AI-agent
WORKING documents — they are edited constantly by `/implement`, `/fix`,
`/verify`, `/analyze-fix`, so any HTML version goes stale immediately and just
wastes tokens to produce. **By default, SKIP these AI-agent documents:**
- `*-FullStack-Implementation-Checklist.md` (and any `*-Implementation-Checklist.md`)
- `*-Issues.md`, `*Issue*.md`
- Any file whose top heading or metadata says "Audience: AI agent" or similar.

Human-readable docs that SHOULD get HTML: `*-DB-Changes.md`,
`*-Architecture.md` / `*-DataSync-Architecture.md`, `*-Developer-Flow-Guide.md`,
`*-Business-Verification-Reference.md`, `*-Verification-Guide.md`,
`*-Dev-Testing-N-Deployment-Guide.md`, `*-PowerBI-Mapping.md`,
`*-Feature-Tracker.md`, `*-Operations-Guide.md`, `*-Setup-Guide.md`.

If the user EXPLICITLY names a checklist/issues file (single-file mode), do
generate it but first confirm: "That's an AI-agent working document whose HTML
will go stale on the next /implement or /verify run. Generate it anyway? (y/n)".

## Batch handling
If the user provided a folder or glob:
1. List all matching `.md` files first using `glob` tool.
2. **Filter out AI-agent docs** (checklists, issues — see the rule above)
   unless the user explicitly asked to include them.
3. Show the user the list (and the skipped AI-agent docs separately) and ASK
   for confirmation: "Found N human-readable markdown files (skipping M
   AI-agent docs). Generate HTML for all human-readable ones?"
4. Skip files named `README.md`, `CHANGELOG.md`, `LICENSE.md`, or any file
   inside `node_modules/`, `.git/`, `dist/`, `build/` folders.
5. Skip manually-authored HTML files that have no matching `.md` source
   (e.g. a hand-written playbook or team-guide page).

## When done
Report a summary:
```
Converted N markdown files to HTML:
  ✓ path/to/file1.md → path/to/file1.html
  ✓ path/to/file2.md → path/to/file2.html
  - path/to/file3.md (skipped — HTML already exists)

To view: open any .html file in a browser. Mermaid diagrams render via
CDN-loaded JavaScript. No build step needed.

The HTML output includes:
  - Auto-generated id="..." on every heading (TOC links work)
  - Anchor link (¶) shown on hover over each heading — for sharing URLs
  - Back-to-top button when scrolled
  - Broken-link rescue: TOC links with slight slug mismatches are
    auto-corrected when possible; truly broken ones are highlighted in red
    so you can fix them in the source markdown
  - Copy buttons on every code block
  - Per-diagram zoom toolbar on every Mermaid diagram:
      − / +     zoom out / in (or Ctrl+wheel)
      Fit       scale to container width
      1:1       reset to 100%
      ⛶         toggle full-screen view of the diagram
      ↗         open the diagram in a new tab with PNG export, SVG export,
                Print button, full pan-and-zoom, and keyboard shortcuts
                (Ctrl++, Ctrl+−, Ctrl+0)
    Click-and-drag pans the diagram when zoomed in.
    Diagrams wider than the container auto-fit-to-width on first render.

To publish to Confluence: copy the rendered HTML content (or use Confluence's
HTML macro / import feature) — the template uses inline styles and CDN scripts
so it works as standalone HTML.
```

## Important rules
- **This command does NOT activate any BMAD persona.** It is a pure utility.
- **This command does NOT modify the source markdown files.** It only writes
  new .html files beside them.
- **No content transformation** — the template renders markdown in-browser via
  the marked.js + mermaid.js scripts. Your only job is placeholder substitution.
- **Skip large directories** — do not recurse into `node_modules`, `.git`,
  `bin`, `obj`, `dist`, `build`, `.next`, `.opencode/node_modules`.
- **One file at a time** — write each HTML file individually. Don't try to
  batch many writes in parallel (sequential is safer for large batches).
