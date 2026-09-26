# npm Package Usage

Package page: [`@techierathore/ai-first-playbook`](https://www.npmjs.com/package/@techierathore/ai-first-playbook)

## Requirements

- Node.js 22.14.0 or later
- npm 11.5.1 or later
- An existing or new project directory to receive the playbook

## Preview And Install

Enter the target project and preview the files without writing them:

```powershell
cd C:\work\my-project
npx @techierathore/ai-first-playbook@latest install --dry-run
```

Install into the project:

```powershell
npx @techierathore/ai-first-playbook@latest install
```

On macOS, Linux, or WSL, `cd` to a POSIX path such as `/home/me/work/my-project`. Alternatively,
run elsewhere with `--target="/absolute/path/to/project"`. Existing files are preserved by
default.

This uses the same package-executable model as `npx bmad-method install`: npm downloads AIFP into
its cache and runs the CLI without adding a project dependency. Do not use `npm install`, which is
the command that creates project-level `node_modules`, `package.json`, and `package-lock.json`.
See [`Repository-Structure.md`](Repository-Structure.md) for the package-versus-target layout.

## After Installation

1. Open the target project.
2. Replace every placeholder in `playbook/environment-profile.yml` with the project's real
   topology and commands. Do not put secrets in that file.
3. Open or restart OpenCode so it loads `opencode.json`, `AGENTS.md`, and the installed plugins.
4. Start with `/feature-plan`, then follow `/implement` → `/verify` → `/fix` as needed.
5. Commit project documents and durable verification evidence according to team policy. Ignore
   only `/verification/telemetry/events.ndjson`; retain the durable miss stream.

The installer-managed `.gitignore` block ignores the reinstallable AIFP runtime while deliberately
leaving `docs/` and `verification/` visible. If framework files were already tracked before this
rule was installed, Git keeps tracking them until a human removes them from the index once; adding
an ignore rule never untracks an existing file.

The installation includes `scripts/playbook-miss.mjs`, `scripts/miss-lib.mjs`,
`scripts/playbook-telemetry.mjs`, `playbook/model-tiers.yml`, and the environment profile. See
[Telemetry-Guide.md](Telemetry-Guide.md) for capture, export, and retention.

For unattended OpenCode operation, put `YOLO` in the command or start OpenCode with
`PLAYBOOK_YOLO=1`. The source-checkout supervisor adds usage-limit waiting and same-session resume;
see [YOLO-Mode-Guide.md](YOLO-Mode-Guide.md).

## Upgrade

Preview the upgrade first:

```powershell
npx @techierathore/ai-first-playbook@latest install --target="C:\work\my-project" --dry-run --force
```

Then replace package-managed files:

```powershell
npx @techierathore/ai-first-playbook@latest install --target="C:\work\my-project" --force
```

Review the resulting working-tree diff before keeping the upgrade. The installer only overwrites
files managed by this package.

## Uninstall

Preview removal:

```powershell
npx @techierathore/ai-first-playbook@latest uninstall --target="C:\work\my-project" --dry-run
```

After reviewing the list, remove package-managed files:

```powershell
npx @techierathore/ai-first-playbook@latest uninstall --target="C:\work\my-project" --force
```

The installation marker is stored at `.playbook/installation.json` in the target project.

## Help

```powershell
npx @techierathore/ai-first-playbook@latest --help
```

For clone-based installation, see [`Installation.md`](Installation.md).
