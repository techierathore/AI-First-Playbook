# Verifier adapter — desktop application items

Loaded only when the plan has a `desktop` bucket.

- Default path: the behaviour lives in libraries the environment can execute. Write a console
  runner under `verification/<feature>/` that calls the exact method the item names with the real
  configuration, and record its output plus the resulting data.
- Optional GUI bridge, when the probe or the `WINAPP_BRIDGE` variable names one and `GET /health`
  answers 200: `POST /launch {"exe"}`, `POST /click {"selector"}`, `POST /type {"selector","text"}`,
  `GET /text?selector=`, `GET /screenshot`, `POST /stop`. Save screenshots as evidence.
- A purely visual item with no logic and no bridge is `PASS (code-audit)` citing the handler; a
  missing bridge is never a `BLOCKED` reason.
