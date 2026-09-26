# Adoption Metrics

Review weekly: verified features, misses and escapes, gate compliance, verification lead time,
rework, completed handoffs, adoption by role, blocked/data-gap duration, redaction failures and
runtime cost. Certify one champion and one backup per team.

## Miss and rework definitions

Publish the numerator and denominator beside every rate; never turn null classifications or
missing event windows into zeroes.

| Metric | Definition | Denominator / cohort |
|---|---|---|
| **Miss rate** | Distinct schema-1 `miss` records opened for eligible checklist items | Checklist item executions receiving a terminal Verify result in the same period. Misses with no `item_id` are reported separately. |
| **Escape rate** | Misses found by human acceptance or production | All misses opened in the same origin cohort. Show human and production separately. |
| **Rework incidence** | Eligible checklist item executions associated with at least one `miss-fix` attempt | The same eligible item-execution denominator; count an item once even after several attempts. |
| **Rework intensity** | Count of `miss-fix` records through the observation date | Distinct misses with at least one fix; report attempts per repaired miss and keep deferred/abandoned/open visible. |
| **Time to close** | UTC duration from `miss.ts` to the first later independently proven pass | Misses that reached pass. Report median/p90 plus closed/eligible counts; censor open work. |

Use the open timestamp for intake trends and origin cohort for escape comparisons. Deduplicate by
`miss_id`, fold valid amendments, and use the latest lifecycle outcome for backlog.

Optional fields display `n of N assessed` after field-introduction cutoffs. Model/tier comparisons
use only linked observed origins. Cost headlines use sole-attributed fixes; shared apportionments
remain separate and unavailable attribution is excluded.

`actor` is aggregate-only. No miss, escape, rework, amendment, time-to-close, token, or cost report
may rank or break down individuals.
