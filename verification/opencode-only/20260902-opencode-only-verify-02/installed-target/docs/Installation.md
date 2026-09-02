# Installation

npm package: [`@techierathore/ai-first-playbook`](https://www.npmjs.com/package/@techierathore/ai-first-playbook)

Requires Node.js 22.14.0 or later and npm 11.5.1 or later.

## From npm (OpenCode)

Run the executable from inside the project. This copies the payload directly to the current
directory without adding AIFP to the application's dependencies:

```bash
cd /absolute/path/to/project
npx @techierathore/ai-first-playbook@latest install --dry-run
npx @techierathore/ai-first-playbook@latest install
```

Use `--target="/absolute/path/to/project"` instead when running from another directory. Existing
files are kept. To upgrade package-managed files:

```bash
npx @techierathore/ai-first-playbook@latest install --target="/absolute/path/to/project" --force
```

The installer adds `.opencode/`, `opencode.json`, `AGENTS.md`, user/operator docs, onboarding,
lifecycle phases, operational checklist/deployment/issue/handoff templates, and
`scripts/{playbook-miss,miss-lib,playbook-telemetry}.mjs` plus
`playbook/{environment-profile,model-tiers}.yml`. Replace the profile placeholders, then
restart OpenCode. It does not create secrets, start application services or guess commands.
Existing files are preserved unless `--force` is explicit; the installation marker retains the
created-file ownership list across upgrades.

The installer adds or refreshes a clearly delimited block in the target's `.gitignore`. It ignores
the reinstallable framework copies (`.opencode/`, `.playbook/`, root framework configuration,
`playbook/`, `onboarding/`, `phases/`, and operational templates). It does not ignore `docs/`, feature
checklists, project-status documents, or `verification/` evidence. Use `--no-gitignore` only when
the target deliberately versions its own framework copies.

This follows the BMAD CLI pattern: `npx` downloads the package into npm's cache and executes the
package `bin`. It therefore does not create project-level `node_modules`, `package.json`, or
`package-lock.json`. Do not use `npm install @techierathore/ai-first-playbook`; that is npm's
dependency-install command and has different semantics.

For command options, upgrading, uninstalling, and first-run usage, see [`Usage.md`](Usage.md).
For the purpose of every source and target folder, see
[`Repository-Structure.md`](Repository-Structure.md).

## From A Clone (OpenCode)

```bash
git clone <repository-url> ai-first-playbook
node ai-first-playbook/scripts/install.mjs install --target="/absolute/path/to/project"
```

PowerShell:

```powershell
git clone <repository-url> ai-first-playbook
node .\ai-first-playbook\scripts\install.mjs install --target="C:\work\my-project"
```

Terminal/macOS/Linux uses the same `node` command with a POSIX path. The installer creates a
missing target folder. Use `--uninstall --force` only after reviewing the dry run.

## Telemetry retention

The managed `.gitignore` block ignores only the transient OpenCode event stream:

```gitignore
/verification/telemetry/events.ndjson
```

Preserve durable `verification/telemetry/misses.ndjson`; do not ignore the entire directory or all
NDJSON files. Start OpenCode with `PLAYBOOK_TELEMETRY=1` before launch when capture is required.
See [Telemetry-Guide.md](Telemetry-Guide.md).

## YOLO mode

The installed OpenCode plugin is inert until `PLAYBOOK_YOLO=1` is present at startup. For
rate-limit-aware headless execution and same-session resume, use the source-checkout supervisor:

```bash
node ai-first-playbook/scripts/playbook-yolo.mjs --cwd="/absolute/path/to/project" \
  --goal "Complete the approved Playbook goal"
```

See [YOLO-Mode-Guide.md](YOLO-Mode-Guide.md).

## Model tiers (source checkout only)

The npm target install keeps `playbook/model-tiers.yml` for routing configuration and telemetry
tier attribution. It does not install the routing utilities below. From a full
framework source checkout, routing ships **OFF** and is operated through one script:

```bash
node scripts/playbook-routing.mjs status                          # what routing is / would be doing
node scripts/playbook-routing.mjs on                              # stamp model: into the OpenCode frontmatter
node scripts/playbook-routing.mjs set-model standard opencode myprovider/my-model
node scripts/playbook-routing.mjs set-tier verify economy
node scripts/playbook-routing.mjs off                             # remove every stamp again
node scripts/apply-model-tiers.mjs --check                        # CI-friendly consistency check
```

The full routing guide is maintained with the optional source-checkout tooling.

## Windows

Run the harness inside WSL, not on Windows directly. The step-by-step setup for laptops and
Windows Server 2022 VMs, including certificates, proxy, and topology, is in
[OpenCode-WSL-Setup-Guide.md](OpenCode-WSL-Setup-Guide.md). A full framework source checkout also
contains the optional provisioning script.
