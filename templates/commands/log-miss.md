# /log-miss
<!-- template-schema: {"produces":"/log-miss record","required":["Contract","usage","one-line input","classification","writes","fixed branch","failure"],"optional":[],"budget":{"small":[150,220],"medium":[180,260],"large":[220,320]},"rows":"One miss; closed values; append-only ID."} -->

**Cost:** 🟡 · **Chat:** same or fresh

Classify a one-line miss report and append its durable telemetry record without reproducing
the defect. This is the low-friction front door for misses noticed between phases.

## Usage

```
/log-miss "export ignored the active date filter" @docs/Cost-Implementation-Checklist.md REQ-014
/log-miss --fixed "missing log line was already repaired" @docs/Cost-Implementation-Checklist.md REQ-022
```

## Hard scope

- Classify the supplied one-line report using only the miss stream's closed vocabularies.
- Do not boot or reproduce the app; do not build or test; do not inspect or edit `src/`,
  config, deployment steps, infrastructure, package files, or product code.
- The only writes are the append-only miss stream and the referenced checklist's item
  metadata `misses` array.
- `--fixed` opens and closes the already-addressed miss in one invocation.
- The command explicitly enables telemetry for its own write. Telemetry remains
  fire-and-forget: failure is reported but never changes any phase verdict.
