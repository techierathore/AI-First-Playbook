# Verifier adapter — UI items

Loaded only when the plan has a `ui` bucket.

- When the probe reports `browser.endpoint` ok and the web application answers, drive each item
  with Playwright: open the route from the verification guide, take an accessibility snapshot,
  confirm every element named in the item's UI ref, perform the Acceptance action and assert its
  observable result. Save screenshots and traces under `verification/<feature>/<run-id>/`.
  Outcome is `PASS` or `FAIL`, never code-audit, while Playwright is reachable.
- Only when the browser endpoint is down or the application cannot start: read the component,
  confirm the UI ref elements, routing and props in code, record why runtime was impossible, and
  use `PASS (code-audit)` or `FAIL (code-audit)`.
- With a Developer Flow Guide, confirm the same value on the screen, through the named API call
  and in the named table; disagreement is `FAIL` at the layer that differs.
