# Installation

npm package: [`@techierathore/ai-first-playbook`](https://www.npmjs.com/package/@techierathore/ai-first-playbook)

Requires Node.js 22.14.0 or later and npm 11.5.1 or later.

## From npm (OpenCode)

```bash
npx @techierathore/ai-first-playbook@latest --target="/absolute/path/to/project"
```

Preview first with `--dry-run`. Existing files are kept. To upgrade package-managed files:

```bash
npx @techierathore/ai-first-playbook@latest --target="/absolute/path/to/project" --force
```

The installer adds `.opencode/`, `opencode.json`, `AGENTS.md`, `Context-Prompt.md`, docs,
onboarding and the telemetry runtime: `scripts/{playbook-miss,miss-lib,playbook-telemetry}.mjs`
plus `playbook/{environment-profile,model-tiers}.yml`. Replace the profile placeholders, then
restart OpenCode. It does not create secrets, start application services or guess commands.
Existing files are preserved unless `--force` is explicit; the installation marker retains the
created-file ownership list across upgrades.

For command options, upgrading, uninstalling, and first-run usage, see [`Usage.md`](Usage.md).

## From A Clone (OpenCode)

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

## Telemetry retention rule

If the target uses Git, add this exact repository-root ignore rule:

```gitignore
/verification/telemetry/events.ndjson
```

Do not ignore `verification/telemetry/` or `*.ndjson`:
`verification/telemetry/misses.ndjson` is the committed, append-only miss history. OpenCode
captures provider cost when telemetry events are available; missing windows honestly degrade
model/cost attribution to inferred/unknown and null.
See [`Telemetry-Guide.md`](Telemetry-Guide.md) §7.

## YOLO mode

Nothing extra to install: the OpenCode plugin (`.opencode/plugin/yolo.ts`) ships with the
framework and stays inert until `PLAYBOOK_YOLO=1` is set. For unattended runs use the supervisor
from the clone:

```bash
node ai-first-playbook/scripts/playbook-yolo.mjs --harness=opencode --cwd="/absolute/path/to/project" \
     --prompt "/implement docs/<Feature>-Implementation-Checklist.md"
```

Details: [`YOLO-Mode-Guide.md`](YOLO-Mode-Guide.md).

## Model tiers

Routing ships **OFF** — phases run on your session model until you turn it on. The tier map
(`playbook/model-tiers.yml`: planning on frontier, build/verify on standard, mechanical
commands on economy) is operated through one script:

```bash
node scripts/playbook-routing.mjs status                          # what routing is / would be doing
node scripts/playbook-routing.mjs on                              # stamp model: into the OpenCode frontmatter
node scripts/playbook-routing.mjs set-model standard opencode myprovider/my-model
node scripts/playbook-routing.mjs set-tier verify economy
node scripts/playbook-routing.mjs off                             # remove every stamp again
node scripts/apply-model-tiers.mjs --check                        # CI-friendly consistency check
```

Details and every case: [`Model-Routing-Guide.md`](Model-Routing-Guide.md) §5.

## Windows

Run the harness inside WSL, not on Windows directly — step-by-step setup (laptops and Windows Server 2022 VMs): [OpenCode-WSL-Setup-Guide.md](OpenCode-WSL-Setup-Guide.md); see
[OpenCode-Guide.md](OpenCode-Guide.md) for the full corporate deployment guide (SSL
certificates, proxy, topology) and `scripts/provision-wsl.sh` for the scripted setup.

Package maintainers should use [`Npm-Release-Guide.md`](Npm-Release-Guide.md) for recurring version
and package updates. [`Npm-Publishing-Guide.md`](Npm-Publishing-Guide.md) covers one-time setup only.
