# Team Inventory — Business Verification Reference
<!-- document: business-verification-reference -->
<!-- INVENTED fixture from docs/examples/Greenfield-Case-Study.md; not a real project. -->

| | |
|---|---|
| Purpose | Verify every number on the inventory report |
| Audience | Business stakeholders and QA |
| Plain English | Yes |
| Last reviewed | 2026-09-26 |

## 1. What this report shows

How many assets each owner holds, and how many imports were rejected.

## 2. Data sources

| What you see | Comes from | Where to find it | What you see there |
|---|---|---|---|
| Assets per owner | the application database | Inventory screen → Owner filter → grid footer | the row count |

## 3. Calculation logic

Assets per owner is the number of assets whose owner is that person.

## 4. Mapping tables

| Report label | Meaning |
|---|---|
| Unassigned | an asset with no owner |

## 5. How to verify a value

```mermaid
flowchart LR
  A[Pick a value] --> B[Open the source] --> C[Count] --> D[Compare]
```

## 6. Verification scenarios

Ana Ruiz owns three assets; the report shows 3, so it passes.

## 7. Glossary

Asset: a piece of equipment with a tag.
