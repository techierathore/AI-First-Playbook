# /amend-checklist

**Persona:** none — mechanical edit · **Cost:** 🟢

Add or correct specific items, deployment steps, infrastructure requirements, item
fields, or sections in an existing checklist — the lightweight option for **"I know
exactly what to add."**

## Usage

```
/amend-checklist @docs/CostDocs/App-CostDashboard-FullStack-Implementation-Checklist.md
Add a deployment step: restart the sync service after the schema migration.
```

## When to use which

| Situation | Command |
|---|---|
| You know exactly what to add | **`/amend-checklist`** (mechanical, cheap) |
| "Something feels incomplete around X — figure it out" | `/analyze-fix` (Analyst reads BRD + code) |
| A shared reference doc drifted | `/refresh-doc` Mode A |
| A whole feature's docs drifted | `/refresh-doc` Mode B |
| The code is wrong, not the docs | `/fix` |

Also the tool for retro-fitting older checklists for parallelism: adding `Type` fields
and breaking up monolithic items so `/implement` and `/verify` can group waves properly.
Always updates the existing checklist in place — never a new file.
