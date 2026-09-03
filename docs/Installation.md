# Installation

npm package: [`@techierathore/ai-first-playbook`](https://www.npmjs.com/package/@techierathore/ai-first-playbook)

Requires Node.js 22.14.0 or later and npm 11.5.1 or later.

## Install into an OpenCode project

Use the same one-shot package-runner model as
[BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD):

```bash
cd /absolute/path/to/project
npx @techierathore/ai-first-playbook@latest install
```

Preview without writing:

```bash
npx @techierathore/ai-first-playbook@latest install --dry-run
```

The default install creates only:

```text
.opencode/
.playbook/
.gitignore  (managed entries are appended to an existing file)
```

It does not create visible framework folders. It also does not add the framework as an
application dependency, so a fresh target receives no `node_modules`, `package.json`, or
`package-lock.json`.

Do not use `npm install @techierathore/ai-first-playbook`. That dependency-style installation is
rejected with the supported command because the framework is distributed through npm but is not
an application dependency. Use the `npx ... install` command above.

After installation, replace every placeholder in `.playbook/environment-profile.yml`, then
restart OpenCode. The installer does not create secrets, start application services, or guess
project commands.

The exact installed layout and runtime connection are documented in
[`Repository-Structure.md`](Repository-Structure.md).

## Optional offline guides

Reference material is intentionally excluded from the default target payload. To place an offline
copy inside the hidden framework directory:

```bash
npx @techierathore/ai-first-playbook@latest install --with-guides
```

This writes only under `.playbook/guides/`; it does not create visible `docs/`, `onboarding/`,
`phases/`, or `templates/` folders.

## Upgrade

Preview package-managed replacements:

```bash
npx @techierathore/ai-first-playbook@latest install --dry-run --force
```

Then apply them:

```bash
npx @techierathore/ai-first-playbook@latest install --force
```

`--force` replaces or removes only paths recorded as package-created in
`.playbook/installation.json`; it preserves pre-existing unowned files. Review the dry run first:
package-owned files may include local edits, and force intentionally replaces them. A forced
upgrade also removes package-owned files from the previous visible installation layout.

## Uninstall

Preview first, then remove files owned by the installation marker:

```bash
npx @techierathore/ai-first-playbook@latest uninstall --dry-run
npx @techierathore/ai-first-playbook@latest uninstall --force
```

The ownership marker is `.playbook/installation.json`. Without `--force`, uninstall is a
nondestructive preview and removes nothing. With `--force`, it removes marker-owned files and the
managed `.gitignore` block while preserving unowned project files.

## Install from a source clone

```bash
git clone <repository-url> ai-first-playbook
node ai-first-playbook/scripts/install.mjs --target="/absolute/path/to/project"
```

The clone retains source-only maintainer folders. The target still receives only the two hidden
runtime directories.

## Telemetry retention

The installer ignores only transient `verification/telemetry/events.ndjson`. It does not ignore
the whole `verification/` directory because verification evidence and durable
`verification/telemetry/misses.ndjson` belong to the application project.
