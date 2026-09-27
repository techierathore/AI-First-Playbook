# /update-context
<!-- template-schema: {"produces":"/update-context primer","required":["Contract","usage","context file","qualifying changes","reconcile","output"],"optional":["Gotcha and command index"],"budget":{"small":[150,220],"medium":[180,260],"large":[220,320]},"rows":"One durable fact; no transient feature state."} -->

**Persona:** none — mechanical · **Cost:** 🟢 · **Owner:** process admin

Keep the repo-root `Context-Prompt.md` — the **cold-start primer** — current after
meaningful process changes.

## The cold-start primer pattern

`Context-Prompt.md` is a single document that transfers the *entire* process context to
a fresh AI session: the setup, the agent roster, the command library, the workflows, the
non-negotiable principles, critical file locations, and (crucially) the accumulated
**numbered gotchas** — every failure mode the process has already hit, so no future
session relearns it the hard way. This file grows with use; expect it to reach several
dozen numbered gotchas and a thousand-plus lines on an actively-used codebase.

Typical use: paste `@Context-Prompt.md` as the first message of a fresh chat, followed
by your request. It solves the "I have to go back to the original chat session every
time" problem — the process becomes self-describing and self-maintaining.

## Usage

```
/update-context
We changed the deployment-steps format and added the DATA-GAP handling rule — record both.
```

Run it after every meaningful change to commands, agents, rules, or workflows. Cheap,
mechanical, no persona.
