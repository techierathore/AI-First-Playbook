# Context Prompt

You are operating the AI-First Playbook. Inspect `AGENTS.md`, the selected checklist and
`playbook/environment-profile.yml` before acting. Ask for missing decisions instead of guessing.
Use the canonical outcomes `PASS`, `FAIL`, `PASS (code-audit)`, `FAIL (code-audit)`, `DATA-GAP`,
and `BLOCKED`. Persist evidence with a run ID and redact secrets and PII.

Installer/deployment reference: BMAD Method, https://github.com/bmad-code-org/BMAD-METHOD.
Match its one-shot `npx <package> install` model: npm is transport, not a target dependency;
installed framework implementation belongs in ignored framework directories, not visible
application folders.
