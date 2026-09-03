# npm Package Usage

Package: [`@techierathore/ai-first-playbook`](https://www.npmjs.com/package/@techierathore/ai-first-playbook)

## Install

```bash
cd /path/to/project
npx @techierathore/ai-first-playbook@latest install
```

Do not use `npm install @techierathore/ai-first-playbook`; the package rejects dependency-style
installation and prints the supported command. `npx` runs the one-shot installer and leaves only
`.opencode/`, `.playbook/`, and the managed `.gitignore` entries in the project.

Preview first when needed:

```bash
npx @techierathore/ai-first-playbook@latest install --dry-run
```

## Configure and start

1. Replace every placeholder in `.playbook/environment-profile.yml` with real project values.
2. Keep secrets out of that file.
3. Restart OpenCode in the project root.
4. Start with `/feature-plan`, then use `/implement`, `/verify`, and `/fix`.

See [`Repository-Structure.md`](Repository-Structure.md) for how hidden runtime files connect to
OpenCode.

## Optional guides

```bash
npx @techierathore/ai-first-playbook@latest install --with-guides
```

Offline reference files are placed under `.playbook/guides/`, never visible root folders.

## Upgrade

```bash
npx @techierathore/ai-first-playbook@latest install --dry-run --force
npx @techierathore/ai-first-playbook@latest install --force
```

Existing unowned files are always preserved. `--force` replaces package-created files recorded in
`.playbook/installation.json`, including locally edited copies, and removes recorded files from a
previous visible-layout installation. Review the dry run first.

## Uninstall

```bash
npx @techierathore/ai-first-playbook@latest uninstall --dry-run
npx @techierathore/ai-first-playbook@latest uninstall --force
```

Without `--force`, uninstall removes nothing. The forced form removes only marker-owned files and
the managed `.gitignore` block.

## Help

```bash
npx @techierathore/ai-first-playbook@latest --help
```
