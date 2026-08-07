# /update-context

**Persona:** none — mechanical · **Cost:** 🟢 · **Owner:** process admin

Keep the repo-root `Context-Prompt.md` — the **cold-start primer** — current after
meaningful process changes.

## The cold-start primer pattern

`Context-Prompt.md` is a single document that transfers the *entire* process context to
a fresh AI session: the setup, the agent roster, the command library, the workflows, the
non-negotiable principles, critical file locations, and (crucially) the accumulated
**numbered gotchas** — every war story the process has learned, so no future session
relearns them the hard way. In production this file reached 42 numbered gotchas and
~1,200 lines.

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
