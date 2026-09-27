# Verifier adapter — logging and infrastructure items

Loaded only when the plan has a `logging` or `infrastructure` bucket.

- Logging: search the profile's `logs.paths` and the run's `app.log` for the start, completion,
  count and error lines the item names. No matching line is `FAIL`; logging is never assumed
  from code.
- Infrastructure: probe only resources an in-scope item names. Confirm the configuration key
  exists, then perform one small read or write through the application's own client. A missing
  key or resource is `FAIL` flagged `[INFRA GAP]`.
