# Installation

## From npm

```bash
npx @ai-first/playbook@latest --target="/absolute/path/to/project"
```

Preview first with `--dry-run`. Existing files are kept. To upgrade package-managed files:

```bash
npx @ai-first/playbook@latest --target="/absolute/path/to/project" --force
```

The installer adds `.opencode/`, `opencode.json`, `AGENTS.md`, `Context-Prompt.md`,
`playbook/environment-profile.yml`, docs and onboarding. Replace the profile placeholders, then
restart OpenCode. It does not create secrets, start application services or guess commands.

## From A Clone

```bash
git clone <repository-url> ai-first-playbook
node ai-first-playbook/scripts/install.mjs --target="/absolute/path/to/project"
```

PowerShell:

```powershell
git clone <repository-url> ai-first-playbook
node .\ai-first-playbook\scripts\install.mjs --target="C:\work\my-project"
```

Terminal/macOS/Linux uses the same `node` command with a POSIX path. The installer creates a
missing target folder. Use `--uninstall --force` only after reviewing the dry run.

Package maintainers should use the separate GUI-friendly [`Npm-Publishing-Guide.md`](Npm-Publishing-Guide.md).
