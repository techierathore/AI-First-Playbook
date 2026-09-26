# Deployment Steps Template
<!-- template-schema: {"produces":"## Deployment Steps section of a checklist","required":["Purpose","execution point","shape","Automated","Manual","tools/secrets"],"optional":["Rollback","environment branch"],"budget":{"small":[100,180],"medium":[200,320],"large":[320,500]},"rows":"One action per row; automated row has one command or script; no secret values."} -->

Lives inside the implementation checklist as `## Deployment Steps`. `/implement` and `/fix` add
rows as their work creates deployment needs; the Verifier runs the Automated rows before any
item check (each after approval; a failed row makes the run `BLOCKED`, not a cascade of FAILs).

## Format

One action per row. An **Automated** row carries one runnable command or script in inline code;
without one it belongs in **Manual**, which is one plain line.

```markdown
## Deployment Steps

### Automated
- [ ] Apply the <feature> schema migration
  - `<profile database.migration_command> deploy/<feature>/01-schema.sql`
- [ ] Install the dependencies added in this run
  - `<profile install command>`

### Manual
- [ ] Add the `<Feature>:ApiKey` secret to the approved secret manager
- [ ] Restart the API service on the host
```

Write `_None required._` when the feature has no deployment side effect.

## Tools and secrets

- Commands come from `.playbook/environment-profile.yml` (`commands`, `database.migration_command`);
  a project name or start variant is taken from the checklist or the profile, never guessed.
- Credentials reach a command only through an approved secret manager, an environment reference,
  protected stdin or a protected temporary file — never an argument, Markdown, a log or a URL.
- Add an install step only when dependencies were actually added; do not list the build itself.
- Scripts written for deployment live under `deploy/<feature>/` and are named in the row.
