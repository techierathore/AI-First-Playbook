# npm Package Usage

Package page: [`@techierathore/ai-first-playbook`](https://www.npmjs.com/package/@techierathore/ai-first-playbook)

## Requirements

- Node.js 22.14.0 or later
- npm 11.5.1 or later
- An existing or new project directory to receive the playbook

## Preview And Install

Preview the files without writing them:

```powershell
npx @techierathore/ai-first-playbook@latest --target="C:\work\my-project" --dry-run
```

Install into the project:

```powershell
npx @techierathore/ai-first-playbook@latest --target="C:\work\my-project"
```

On macOS, Linux, or WSL, use an absolute POSIX path such as `/home/me/work/my-project`.
Existing files are preserved by default.

## After Installation

1. Open the target project.
2. Replace every placeholder in `playbook/environment-profile.yml` with the project's real
   topology and commands. Do not put secrets in that file.
3. Open or restart OpenCode so it loads `opencode.json`, `AGENTS.md`, and the installed plugins.
4. Start with `/feature-plan`, then follow `/implement` → `/verify` → `/fix` as needed.
5. Keep telemetry retention selective: ignore only
   `/verification/telemetry/events.ndjson`; commit `verification/telemetry/misses.ndjson`.

The installation includes `scripts/playbook-miss.mjs`, `scripts/miss-lib.mjs`,
`scripts/playbook-telemetry.mjs`, `playbook/model-tiers.yml` and the environment profile, so
miss capture and read-time cost joining run from the target repository. See
[`Telemetry-Guide.md`](Telemetry-Guide.md) §7 for the CLI and schemas.

## Upgrade

Preview the upgrade first:

```powershell
npx @techierathore/ai-first-playbook@latest --target="C:\work\my-project" --dry-run --force
```

Then replace package-managed files:

```powershell
npx @techierathore/ai-first-playbook@latest --target="C:\work\my-project" --force
```

Review the resulting working-tree diff before keeping the upgrade. The installer only overwrites
files managed by this package.

## Uninstall

Preview removal:

```powershell
npx @techierathore/ai-first-playbook@latest --uninstall --target="C:\work\my-project" --dry-run
```

After reviewing the list, remove package-managed files:

```powershell
npx @techierathore/ai-first-playbook@latest --uninstall --target="C:\work\my-project" --force
```

The installation marker is stored at `.playbook/installation.json` in the target project.

## Help

```powershell
npx @techierathore/ai-first-playbook@latest --help
```

For clone-based OpenCode installation, see [`Installation.md`](Installation.md).
