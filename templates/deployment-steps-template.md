# Deployment Steps Template

Lives inside the implementation checklist as `## Deployment Steps`. Populated by
`/implement` and `/fix` as work creates deployment needs; executed by the Verifier as
**Step 0** of every `/verify` run (each Automated step asks for approval; a failure means
verdict `BLOCKED`, not a cascade of misleading FAILs).

## Format

Each **Automated** bullet carries a runnable shell command inline. Each **Manual** bullet
is one line. No per-step field labels.

```markdown
## Deployment Steps

### Automated (Verifier runs these with your approval)
- [ ] Run <feature> schema migration
  - `sqlcmd -S <server> -d <db> -U <user> -P <pwd> -i deploy/<feature>/01-schema.sql`
- [ ] (only if you ADDED new npm packages this run)
      Install new dependencies
  - `npm install` in src/frontend/

### Manual (you do these)
- [ ] Restart the API service on the host
- [ ] Add the new `<Feature>:ApiKey` secret to the dev Key Vault
- [ ] Start the frontend pointing at the right environment:
      `npm run start:local` (dev DB / dev APIs) OR
      `npm run start:local:uat` (UAT DB / UAT APIs)
```

## Standing tool rules (baked into `/implement`, `/fix`, and the Verifier)

- DB migrations are **raw SQL scripts** under `deploy/<feature>/`, run via `sqlcmd`
  (placeholders resolved from `appsettings.Development.json` at run time).
  **Never Entity Framework** — no `dotnet ef database update`, ever.
- `npm install` only when packages were actually added to `package.json`.
- Frontend start scripts are environment-specific: the Verifier reads `package.json`,
  enumerates the real `start:*` variants, **asks which environment to test against**,
  and records the choice in the Run Log so verdicts have DB context.
- Backend start: `dotnet run --project <ApiProject>` — project name from the checklist,
  never guessed.
