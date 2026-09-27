# Verifier adapter — backend API and service items

Loaded only when the plan has a `backend-api` or `backend-service` bucket.

- Call the running endpoint at the probe's `application.api_url` with the credentials the profile's
  secret source provides; assert the status and the fields the Acceptance names. Evidence is the
  request line, status and asserted fields, never a token or secret.
- When an HTTP call cannot show the effect (a side effect in the data store, a background job),
  write a small integration runner under `verification/<feature>/` that calls the real service
  entry point with the real configuration, and record its output.
- Read service configuration from the path the profile names; pass values to the runner, never
  echo or write them. A missing required key fails the item and is flagged `[INFRA GAP]`.
