# Verifier adapter — database items

Loaded only when the plan has a `db` bucket.

- Use `database.method` from the profile. `app-config`: read the connection from
  `database.config_path`; `managed-secret`: resolve it through the declared secret source. Never
  print or store the connection value; pass it through protected stdin or a protected temporary
  file.
- Query through the project's own runner or a small runner under `verification/<feature>/`:
  counts, the rows the Acceptance names, and the field mapping in the DB changes document.
- A query that runs cleanly on missing rows is `DATA-GAP` with the one-line seed needed, not
  `FAIL` and not `BLOCKED`. A connection failure records the exact error and the config path read.
