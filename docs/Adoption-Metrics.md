# Adoption Metrics

Review weekly: verified features, misses and escapes, gate compliance, verification lead time,
rework, completed handoffs, adoption by role, blocked/data-gap duration, redaction failures and
runtime cost. Certify one champion and one backup per team.

## Miss and rework definitions

Publish the numerator and denominator beside every rate; never turn null classifications or
missing event windows into zeroes.

| Metric | Definition | Denominator / cohort |
|---|---|---|
| **Miss rate** | Distinct schema-1 `miss` records opened for eligible checklist items | Checklist item executions receiving a terminal Verify result in the same period. Misses with no `item_id` are reported separately, not forced into this rate. |
| **Escape rate** | Misses whose `found_by` is `human` or `production` | All misses opened in the same origin cohort. Also show human and production separately. This answers “what share escaped the independent loop?”, not “how many bugs per person?”. |
| **Rework incidence** | Eligible checklist item executions associated with at least one `miss-fix` attempt | The same eligible checklist item-execution denominator as miss rate; count an item once even if it needed several attempts. |
| **Rework intensity** | Count of `miss-fix` records through the observation date | Distinct misses with at least one `miss-fix`; report as attempts per repaired miss. `deferred`, `abandoned` and still-open records remain visible rather than being treated as zero effort. |
| **Time to close** | UTC duration from a `miss.ts` to the first later `miss-fix.ts` with `verdict_after: pass` | Misses that reached `pass` in the cohort. Report median and p90 plus `closed n / eligible N`; open, deferred and abandoned misses are censored and reported separately, not assigned zero duration. |

Use the miss's open timestamp for intake trends and its origin cohort for escape comparisons;
label which cohort a chart uses. Deduplicate by `miss_id`, fold valid `miss-amend` records before
classification, and use the backlog predicate (latest verdict is neither `pass` nor `abandoned`)
for outstanding work.

Optional fields such as `why_missed` always display **`n of N assessed`** after applying that
field's `FIELD_SINCE` cutoff. For routing metrics, attribute only `origin_confidence: linked`
records with an observed model. For cost metrics, use `sole` fixes for the measured headline,
show `shared:<n>` apportionments separately, and exclude `none` from cost denominators.

`actor` is aggregate-only. Adoption may be reviewed by role at team level, but no miss, escape,
rework, amendment, time-to-close or cost report may be broken down by actor or used to rank
people.
