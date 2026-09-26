# /legacy-audit
<!-- template-schema: {"produces":"/legacy-audit baseline","required":["Contract","usage","target/profile","inventory","map","baseline","risks","seams","handoff"],"optional":["UI","API","data probes"],"budget":{"small":[350,500],"medium":[500,700],"large":[650,900]},"rows":"One component, dependency, risk, or invariant with evidence."} -->

Run before changing an existing module. Ask for the target and environment profile, then produce
an inventory, dependency and ownership map, baseline screenshots/API responses, characterization
tests, data classification, risk/unknowns register, and safe change seams. Record behavior that
must not change and links to all evidence in the existing implementation checklist. Do not
invent architecture or delete baseline evidence.
