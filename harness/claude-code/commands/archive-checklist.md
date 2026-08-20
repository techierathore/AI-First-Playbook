---
description: Compact already-passing checklist items into a richer Verified History section to keep the active checklist manageable, or restore archived items when their context is needed again
model: haiku
---
You are a documentation utility. Your job is to **rotate** the implementation
checklist between two regions: the active body (full multi-field detail for
items still in play) and `## Verified History` (rich one-paragraph records
of items that have passed verification). **No BMAD persona** — careful
mechanical edit task.

## User's full input
$ARGUMENTS

## Two modes

### Mode A: Archive — move PASS items into Verified History
Triggered when the user runs `/archive-checklist @<path>` with no extra
direction, or with explicit "archive" instruction.

### Mode B: Restore — pull an archived item back into the active body
Triggered when the user says "restore item #N" or "restore items related to
<topic>" or similar. Used when a new bug touches archived territory and the
LLM needs the full context back.

If the user's intent is ambiguous, ASK which mode they want.

---

## When to archive (the new, more conservative threshold)

The previous guideline of "800 lines" was too low. The real concerns are:

1. **Edit-tool reliability**: large files become slow but rarely fail until
   they exceed ~3000 lines AND have many similar-looking sections.
2. **Human readability**: humans struggle to scan checklists past ~2000 lines.
3. **LLM context loss**: when items are archived, future LLM runs lose the
   full Behavior / Location / Verify detail. If a NEW item references an
   archived one ("must follow the pattern of item #5"), the LLM will miss
   the connection.

**Revised guidance**:
- Below **2000 lines** OR **fewer than 30 PASS items**: do NOT archive yet.
  The file is fine. Tell the user "the checklist is still manageable —
  archiving would lose context without enough space gain."
- **2000-3000 lines** AND **at least 30 PASS items**: archiving is helpful;
  proceed with the cautious rules below.
- **Over 3000 lines**: archiving is recommended; proceed.

These are guidelines, not hard limits — if the user insists on archiving a
smaller file (e.g., before a milestone), proceed but warn them about the
context-loss tradeoff.

---

## Items that are NEVER eligible for archive

Even if marked PASS, do NOT archive an item that:

1. **Has any FAIL/BLOCKED sibling that depends on it.** Scan the active
   checklist for "depends on", "see item #X", "same pattern as item #X",
   "uses the service from item #X" — if a non-PASS item references this
   one, keep the PASS one active.
2. **Is referenced from `## Infrastructure Requirements` or
   `## Deployment Steps`** via the `Required for: <item numbers>` field.
   If any deployment step still depends on this item, the item must stay
   visible to future verifies that re-run the deployment step.
3. **Was added in the most recent verify cycle.** If the latest Verifier
   Run Log entry says "Run on <date>" and the item's `**Verifier Result**`
   has the same date, it's too fresh — defer archiving to the next round.
4. **Defines a pattern reused elsewhere.** Items that are clearly templates
   (e.g., "Set up base error-handling middleware" — likely referenced by
   every other item) should stay active even if PASS.
5. **Has a "see also #X" annotation** to a still-active item.

If you cannot tell whether an item is safe to archive, **leave it active**
and flag it to the user in your summary as "ambiguous — kept active by
default".

---

## What the Verified History entry looks like (richer than before)

Previous design used one-line compact entries. That loses too much. The new
format preserves **just enough** context for an LLM in a later run to
understand what the item did, without bringing back the full multi-field
block:

```markdown
### Archived on <YYYY-MM-DD>

#### #5 — CostDataSyncSvc with SyncOrgCostData method
- **Status**: PASS (verified 2025-04-14)
- **What it did**: New service in InventoryCore that pulls per-org
  cost data from Azure Cost Management and AWS Cost Explorer.
- **Location**: `src/backend/InventoryCore/Services/CostDataSyncSvc.cs`
- **Pattern others may follow**: standard sync-service pattern — DI-registered,
  logs start/finish/count at INFO, errors at ERROR, idempotent re-run safe.
- **Cross-references**: items #7 (calls this service), #11 (consumes the data
  this writes).

#### #11 — Export to Excel button
- **Status**: PASS (verified 2025-04-18)
- **What it did**: Toolbar button on the cost dashboard that exports the
  visible grid (respecting filters) as .xlsx.
- **Location**: `src/frontend/src/Components/Reports/Cost/ExportButton.tsx`
- **Pattern others may follow**: uses existing `.btn-toolbar` style and the
  `useExportToExcel` hook.
- **Cross-references**: none in current active checklist.
```

Each archived item has:
- Original item number (preserved, never renumbered)
- Title
- Status + date verified
- One-sentence "what it did" (key for future LLM context)
- File location (so cross-references can still resolve)
- "Pattern others may follow" (only if the item established a pattern)
- "Cross-references" (links to still-active items that depend on it)

---

## Progress reporting — keep the user informed

Archive/restore on a 2000-line checklist can take 5+ minutes. Emit
short progress messages.

**Announce in chat at these moments:**

1. **At the start** (mode = archive):
   ```
   ▶ /archive-checklist starting (mode: archive)
     - Checklist: <path>  (<X> lines)
     - PASS items: <N> total; <K> eligible after Rule filter; <Y> kept
       active because referenced
   ```

2. **At the candidate-list-and-confirm step**: print the candidate
   list, ask for approval (existing behavior — but call it out as a
   progress checkpoint).

3. **After approval, during application**:
   ```
   ⏳ Archiving <K> items…
   ✓ Built rich Verified History entries with cross-refs
   ✓ Removed items from active body  (<K> edits)
   ✓ Removed rows from Status Table  (<K> edits)
   ✓ Appended archive run entry to Verifier Run Log
   ```

4. **At the end**:
   ```
   ✓ Archive complete:
     - Items archived: <K>  (#<n1>, #<n2>, …)
     - Active items remaining: <N>
     - File size: <before> → <after> lines
   ```

For Mode B (restore), same skeleton: announce candidates, ask
approval, announce edits, summary at end.

---

## Mode A: Archive — full procedure

### Step 1: Read and analyze
1. Read the entire checklist.
2. Count: total items, PASS, FAIL/BLOCKED, items in Verified History.
3. Identify file size in lines.
4. Apply the "items NEVER eligible" filter to the PASS set.
5. Produce a candidate list of items to archive.

### Step 2: Present candidates and confirm

```
File: <path>
Size: <X> lines (threshold: archive recommended above 2000)

Current state:
  - Total active items: <N>
  - PASS / PASS (code-audit): <count>
  - FAIL / BLOCKED / Pending: <count>
  - In Verified History already: <count>

PASS items, but NOT eligible for archive (will stay active):
  - #5 — CostDataSyncSvc (referenced by failing item #14)
  - #18 — Base error middleware (pattern reused by every other item)

PASS items eligible for archive:
  - #3 — Add dashboard route
  - #11 — Export to Excel button
  - #12 — Date range filter
  ...
  (Total: <X> items)

Proceed? (yes / no / refine — name items to keep active)
```

Wait for explicit user approval before any edit.

### Step 3: Build the rich Verified History entries

For each item being archived, BEFORE deleting it from the active body:
1. Capture the full item block.
2. Extract the title, latest Verifier Result, Location field.
3. Synthesise the "what it did" one-sentence summary from the item's
   Behavior field.
4. Decide whether it qualifies as a pattern source (re-read the active
   body — does anything say "same as item #X"?).
5. Find cross-references to still-active items (grep for `#<N>` in the
   active body).

### Step 4: Edit-in-place

1. Create `## Verified History` if it doesn't exist, with the boilerplate
   intro.
2. Append a new `### Archived on <YYYY-MM-DD>` subsection.
3. For each item:
   - Add its rich entry to the new subsection.
   - Edit the Status Table to remove the item's row.
   - Edit the item block in the active body to delete it.
4. Append to `## Verifier Run Log`:
   ```
   ### Archive on <YYYY-MM-DD HH:MM>
   - Archived <N> items into Verified History
   - Kept active (not archived): <list of PASS items that were ineligible>
   - Active items remaining: <N>
   - File size before/after: <X> lines / <Y> lines
   ```

### Step 5: Summary to user

```
Archive complete:
  - <N> items moved to Verified History (#3, #11, #12, ...)
  - <K> PASS items kept active because they're still referenced
  - File size: <X> → <Y> lines
  - Verified History now has <Z> entries across <R> archive runs

Suggestion: commit this archive run to git so the historical diff
preserves full item detail if needed later.
```

---

## Mode B: Restore — pull archived items back

When the user says "restore item #N" or "restore items related to <topic>":

### Step 1: Locate
1. Search `## Verified History` for matching items.
2. If by number: find `#N` exactly.
3. If by topic: search titles and "what it did" summaries; show candidates
   to the user; ask which to restore.

### Step 2: Reconstruct
The archived entry has compact info but not the full multi-field block.
**Tell the user** that restoration produces a "lite" version with the
fields we still have, and they'll need to fill in or re-derive any missing
fields (Verify method, Logging, etc.) from sibling docs or git history.

Restored item structure:
```
- [x] <title>   ← stays checked, since it was PASS
  - **Behavior**: <reconstructed from "what it did">
  - **Location**: <from archive entry>
  - **Verify**: [RESTORED FROM ARCHIVE — re-derive from prior verify run if needed]
  - **Verifier Result** (<original verify date>): PASS (restored from archive on <today>)
  - **Restored** (<today>): restored from Verified History because <user's reason>
```

### Step 3: Edit-in-place

1. Find the appropriate section in the active body (use the original
   section by reading sibling items or the user's hint).
2. Insert the restored item there using its ORIGINAL number.
3. Add a row to the Status Table.
4. Mark the archive entry as `[RESTORED <today>]` but leave it in
   Verified History as historical record. Example:
   ```
   #### #5 — CostDataSyncSvc with SyncOrgCostData method  [RESTORED 2025-06-12]
   ```
5. Append to Verifier Run Log:
   ```
   ### Restore on <YYYY-MM-DD HH:MM>
   - Restored items: #5
   - Reason: <user's reason>
   ```

### Step 4: Summary

```
Restored to active body:
  - #5 — CostDataSyncSvc with SyncOrgCostData method

Note: the restored items are "lite" — Verify and other field details
were not fully captured at archive time. If you need the original
full text, run `git log -p <checklist-path>` and search for the
archive commit.

The archive entries remain in Verified History marked [RESTORED]
for audit trail.
```

---

## Safety rules (both modes)

1. **Never archive a FAIL/BLOCKED item.** Only PASS.
2. **Never archive an item referenced by a still-active failing item.**
3. **Never silently delete** — archive entries are preservation, not
   destruction.
4. **Never renumber items.** Gaps in active numbering are fine.
5. **Never modify items not being archived/restored.**
6. **Never touch `## Verifier Run Log`** except to append archive/restore
   entries.
7. **Edit in place, never rewrite the whole file.** Use `edit` operations
   on specific sections.
8. **If the file is below the 2000-line threshold** and the user hasn't
   forced the run, refuse and explain why.

---

## When NOT to archive

- File is below 2000 lines AND fewer than 30 PASS items eligible. Explain
  why and suggest "rerun after next major verify cycle when more items
  have passed".
- All PASS items are ineligible (all referenced or pattern-defining).
  Tell the user that the checklist's complexity comes from active cross-
  references, not from too many items; archiving won't help.
- The user is mid-fix-cycle and items keep flipping PASS/FAIL. Wait until
  the cycle stabilises.
