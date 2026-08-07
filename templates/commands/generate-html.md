# /generate-html

**Persona:** none — pure mechanical utility · **Cost:** 🟢 (cheapest model tier)

Convert markdown documents to standalone HTML using the doc-shell template: read the
template, substitute `{{TITLE}}` and `{{MARKDOWN}}`, write the `.html` beside the `.md`.
No reasoning, no persona — don't "upgrade" it.

## Usage

```
/generate-html @docs/CostDocs/App-CostDashboard-DB-Changes.md     # one file
/generate-html @docs/CostDocs/                                    # whole folder
```

## Key behaviors

- Folder mode lists the human-readable `.md` files and asks for confirmation;
  **auto-skips Implementation Checklists and Issues files** (AI-agent docs — HTML would
  go stale on every run and waste tokens; HTML is for human docs only). Skips
  `node_modules`, `.git`, `dist`, `build`. Asks before overwriting existing HTML.
- Output is **standalone**: inline CSS; Mermaid + a markdown renderer load in the
  browser — no build step, no CLI tooling. Paste-able into Confluence's HTML macro.
- Every rendered Mermaid diagram gets per-diagram controls: zoom, fit, 1:1, full-screen,
  and open-in-new-tab with print/PNG/SVG export — so a single diagram can be shared
  with a stakeholder.

Regenerate after any `.md` change by simply re-running the command.
