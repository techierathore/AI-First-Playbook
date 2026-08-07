# /add-doc

**Persona:** Analyst · **Cost:** 🟡–🔴 · **Introduced:** v2.4, extended v2.5

Produce the human companion docs for an existing feature — the **Developer-Flow-Guide**
and/or the **Business-Verification-Reference** — derived from the real code and
**confirmed by running it** (hitting endpoints, driving the UI, querying the DB).
*"A doc written only from other docs repeats their mistakes."*

## Usage

```
/add-doc developer flow guide @docs/CostDocs/ @src/frontend/ @src/backend/ @deploy/cost/
/add-doc developer flow guide for the CostDataSyncSvc service @src/ServiceProject/ @src/CloudManagerCore/
/add-doc business verification reference @docs/CostDocs/  Plain English only, per-cloud portal paths, cross-cloud mapping tables
```

## The two documents

- **Developer-Flow-Guide** — a debugging MAP, not a code dump. Two flow classes (v2.5):
  UI/full-stack flows (`UI element → frontend file:method → API endpoint → service
  method → data-access method → stored proc/view → table`) and service/package/job
  flows (`trigger + registration site → entrypoint → orchestration → core library
  class.method → external call → standardisation → DB write → outcome`, as an ordered
  step table with config, batching/retry/idempotency, partial-failure behaviour, and
  log lines). Simple Mermaid flowcharts; real identifiers; at most 1–3 quoted lines of
  code; plus a "symptom → where to look" index. Scopeable to one screen, tab, function,
  service, or package.
- **Business-Verification-Reference** — one plain-English doc for business + QA (report
  features): data sources with exact portal navigation per cloud, calculation logic,
  cross-cloud mapping tables, verification steps, worked scenarios, glossary. Hard
  rule: no SQL, no code, no internal names — "the application database", "an
  application Key Vault setting". A layman must be able to verify any number with
  simple arithmetic.

If executing a flow exposes a real bug, it is folded into the checklist as a FAIL item.
