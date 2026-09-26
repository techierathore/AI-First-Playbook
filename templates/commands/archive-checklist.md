# /archive-checklist
<!-- template-schema: {"produces":"/archive-checklist history","required":["Contract","usage","checklist","eligibility","dependencies","archive/restore"],"optional":["Restore branch"],"budget":{"small":[150,220],"medium":[180,260],"large":[220,320]},"rows":"One history row; stable ID, title, outcome, run, evidence."} -->

**Persona:** none · **Cost:** 🟢 — this command IS a token-saving lever

Rotate already-passing checklist items into a compact `## Verified History` section (or
restore them back). The highest-leverage token habit in the whole framework: a
4,000-line checklist is re-read by every `/implement`, `/fix`, and `/verify`.

## Usage

```
/archive-checklist @docs/CostDocs/App-CostDashboard-FullStack-Implementation-Checklist.md
/archive-checklist @<same path> restore item #12
```

## Safety rules (enforced by `checklist-archive.mjs`)

- Archives only from **2,000 lines AND 30 eligible items**, unless forced.
- Keeps an item that an active item depends on, that a deployment step names, that is
  marked `[PATTERN]`, or that passed within the last 14 days.
- Moves each full item block verbatim to `<checklist>-Verified-History.md` and leaves one
  row per ID under `## Verified History`; restore brings the block back as `planned`.

Run it after each feature reaches ALL PASS, and quarterly over the largest checklists.
