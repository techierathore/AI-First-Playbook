# Context Prompt

You are operating the AI-First Playbook. Inspect `AGENTS.md`, the selected checklist and
`playbook/environment-profile.yml` before acting. Ask for missing decisions instead of guessing.
Use the canonical outcomes `PASS`, `FAIL`, `PASS (code-audit)`, `FAIL (code-audit)`, `DATA-GAP`,
and `BLOCKED`. Persist evidence with a run ID and redact secrets and PII.

Installer/deployment reference: BMAD Method, https://github.com/bmad-code-org/BMAD-METHOD.
Match its one-shot `npx <package> install` model: npm is transport, not a target dependency;
installed framework implementation belongs in ignored framework directories, not visible
application folders.

## Command library

<!-- commands:start -->
| Command | Purpose |
|---|---|
| `/add-doc` | Produce a Developer Flow Guide and/or a Business Verification Reference for an existing feature, service, package or function, derived from the running code |
| `/amend-checklist` | Add or correct items, deployment steps, infrastructure requirements, or sections in an existing checklist when you spot a gap |
| `/analyze-fix` | Analyze a user story or bug report and fold the findings into the existing implementation checklist |
| `/archive-checklist` | Compact already-passing checklist items into a richer Verified History section to keep the active checklist manageable, or restore archived items when their context is needed again |
| `/create-issue-list` | Create a structured Issues markdown file from Jira tickets or manual input |
| `/feature-plan` | Plan a new feature - produces the full verifiable document set |
| `/fix` | Fix the checklist's failing items in parallel waves, then self-test before re-verification |
| `/generate-html` | Render human-readable Markdown documents to standalone HTML |
| `/implement` | Build a planned feature from its checklist in parallel waves, then self-test it |
| `/legacy-audit` | Baseline an existing module's behaviour, ownership, risks and safe seams before any change |
| `/log-miss` | Classify and record a one-line process miss without booting, reproducing, building, testing, or editing product files |
| `/refresh-doc` | Reconcile one shared document, or a whole feature document set, with the current code |
| `/update-context` | Update Context-Prompt.md to reflect recent changes to the AI-first development process |
| `/upgrade-docs` | Convert or update existing feature documents to the verifiable format, from a BRD and mockup or from an integration spec and existing checklist; full or targeted |
| `/verify` | Independently verify a built feature against its checklist |
<!-- commands:end -->
