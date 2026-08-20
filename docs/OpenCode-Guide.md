# OpenCode Deployment Guide — WSL, Corporate Networks, and Why to Leave Docker (Task 6)

Source citations refer to the OpenCode repo at commit `da4730e4a4` (v1.18.18).

---

## 1. The verdict: yes, move from Docker to WSL

The question was whether the containerized deployment (OpenCode + dotnet + Playwright baked
into a Docker image, corporate SSL certificates copied in per image, breaking differently on
each machine) should be replaced by OpenCode installed directly in WSL. **Yes — and the source
gives four concrete reasons this is not just preference:**

1. **The shipped OpenCode binary trusts the OS certificate store natively.** Every release
   binary is compiled with Bun's `--use-system-ca` flag
   (`packages/opencode/script/build.ts:179`), so it merges the operating system trust store
   with its bundled roots. In WSL that means: install the corporate root CA into Ubuntu's
   store **once per machine** (§4) and OpenCode, plus everything else on the box, trusts it.
   The entire copy-certs-into-the-image, rebuild-on-cert-rotation cycle disappears.
2. **WSL is OpenCode's documented, recommended path on Windows; Docker is essentially
   undocumented.** There is a full doc page for Windows-via-WSL
   (`packages/web/src/content/docs/windows-wsl.mdx:8-12`), while Docker gets a single 4-line
   `docker run` snippet (`index.mdx:121-125`) and the official image is **Alpine with no
   `ca-certificates` provisioning** (`packages/opencode/Dockerfile`) — which is precisely why
   the container hurts on every corporate machine: each image must have the CA baked in by
   hand, and the pain repeats per machine, per proxy vendor, per rebuild.
3. **The bug that motivated the container appears to be gone — but verify before betting on
   it.** I searched the current source and history for the "bun … expected integer" failure on
   large codebases/documents: there is **no such error, and no `maxBuffer` handling, anywhere
   in the tree** (UNVERIFIED as to what the original crash was — it cannot be reproduced from
   source reading alone). What the current code *does* show is that large-input handling was
   systematically hardened: the read tool streams in 64 KB chunks with hard caps (2,000 lines
   / 50 KB output / 20 MB media — `packages/opencode/src/tool/read.ts:13-19`,
   `packages/core/src/tool/read-filesystem.ts:11-15`), bash output is capped at 1 MB in-memory
   (`packages/core/src/tool/bash.ts:20-21`), and context overflow has dedicated
   detection-and-compaction paths (`packages/llm/src/provider-error.ts:25-38`). The nearest
   surviving relative of an "expected integer" error: read `offset`/`limit` are now strict
   integers — a *caller* passing `"100"` as a string fails schema validation
   (`packages/opencode/src/tool/read.ts:23-35`). **Acceptance test for the migration:** run
   the exact large-checklist workload that used to crash, directly in WSL, before
   decommissioning the container.
4. **Topology gets simpler and matches what the framework expects to configure.** The
   `host.docker.internal` plumbing, the bridge-port probes, and the "agent in Linux container,
   apps on Windows host" rules in the Verifier all exist to serve the container. WSL either
   removes them (apps in WSL: `topology: same-host`, plain `localhost`) or reduces them to one
   mirrored-networking switch (§6).

**What you give up:** the image as a team-wide reproducible environment. Mitigation: §3 is
written as a scripted, idempotent provisioning block — commit it as
`scripts/provision-wsl.sh` and the "reproducible environment" property survives as a script
instead of an image. Keep the Dockerfile in a drawer for CI, nothing else.

---

## 2. Prerequisites (Windows side, once per machine)

```powershell
wsl --install -d Ubuntu-24.04     # admin PowerShell; reboot if prompted
wsl --update
wsl --set-default-version 2
```

If the machine is Windows 11 22H2+, enable mirrored networking now — it makes `localhost`
work in *both* directions between Windows and WSL, which §6 depends on. Create/edit
`%UserProfile%\.wslconfig`:

```ini
[wsl2]
networkingMode=mirrored
```

then `wsl --shutdown` and reopen. (On older Windows 10 builds mirrored mode is unavailable —
use the fallback in §6.)

## 3. Provision the WSL environment

All commands inside Ubuntu. Do the certificate step (§4) **first** if your proxy intercepts
TLS, or these downloads will themselves fail.

```bash
sudo apt-get update
sudo apt-get install -y curl git unzip ca-certificates

# .NET SDKs (adjust versions to your stack; Ubuntu 24.04 feed carries 8/9)
sudo apt-get install -y dotnet-sdk-8.0

# Node.js (needed by npm-installed tooling, Playwright MCP, frontend builds)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs

# sqlcmd (Microsoft repo) — the framework's mandated migration/verification tool
curl -sSL https://packages.microsoft.com/keys/microsoft.asc | sudo tee /etc/apt/trusted.gpg.d/microsoft.asc
curl -sSL https://packages.microsoft.com/config/ubuntu/24.04/prod.list | sudo tee /etc/apt/sources.list.d/mssql-release.list
sudo apt-get update && sudo ACCEPT_EULA=Y apt-get install -y mssql-tools18 unixodbc-dev
echo 'export PATH="$PATH:/opt/mssql-tools18/bin"' >> ~/.bashrc

# Playwright browser dependencies (for a WSL-local Playwright MCP)
sudo npx --yes playwright install-deps

# OpenCode itself — pick ONE:
curl -fsSL https://opencode.ai/install | bash      # → ~/.opencode/bin (add to PATH)
# or, behind a locked-down proxy where the script is blocked but npm is mirrored:
npm install -g opencode-ai                          # honors your .npmrc registry/cafile/proxy
```

The npm path matters in corporates: package installation and update checks go through
`@npmcli/config`, so a private registry mirror and `.npmrc` `cafile`/`proxy` settings are
honored (`packages/core/src/npm-config.ts:12-32`, `packages/core/src/npm.ts:87-101`;
update-check hits `${registry}/opencode-ai/...` —
`packages/opencode/src/installation/index.ts:230`). Note the install script performs **no
checksum or signature verification** (verified: none in `install`); if that fails your
security bar, download the release artifact through your artifact proxy and use
`install --binary /path/to/opencode` (`install:348-352`), or the npm mirror route.

**Performance note that will bite otherwise:** keep working repositories in the WSL ext4
filesystem (`~/work/...`), not under `/mnt/c/`. Cross-OS file I/O on `/mnt/c` is dramatically
slower and is the most common "WSL is slow" complaint; `/mnt/c` also carries a permissions
trap — files created there by root (e.g. by the old container) keep root-owned Linux metadata
that blocks your user until `wsl -u root chown` fixes it. Clone fresh into the Linux home.

## 4. Corporate SSL certificates — the part that kept breaking in Docker

Goal: the corporate root CA (and any TLS-inspection proxy CA — Zscaler, Netskope, Blue Coat…)
trusted by **the OS store**, because OpenCode reads the OS store (§1.1), and so do .NET
(OpenSSL store on Linux), git, curl, and apt.

**Step 1 — export the CA chain from Windows.** In PowerShell (adjust the Subject filter to
your CA's name; check both machine and user Root stores — TLS-inspection vendors often land
in either):

```powershell
$out = "C:\temp\corp-ca"; New-Item -ItemType Directory -Force $out | Out-Null
Get-ChildItem Cert:\LocalMachine\Root, Cert:\CurrentUser\Root |
  Where-Object { $_.Subject -match "YourCorp|Zscaler" } |
  ForEach-Object {
    $f = Join-Path $out ("{0}.cer" -f ($_.Thumbprint))
    Export-Certificate -Cert $_ -FilePath $f -Type CERT | Out-Null
  }
```

If you don't know the CA's name, discover what actually terminates your TLS:
`openssl s_client -connect api.anthropic.com:443 -showcerts` from WSL and look at the top of
the chain.

**Step 2 — install into WSL's trust store** (DER → PEM, `.crt` extension is required by
`update-ca-certificates`):

```bash
sudo apt-get install -y openssl
for f in /mnt/c/temp/corp-ca/*.cer; do
  sudo openssl x509 -inform der -in "$f" \
    -out "/usr/local/share/ca-certificates/$(basename "${f%.cer}").crt" 2>/dev/null \
  || sudo cp "$f" "/usr/local/share/ca-certificates/$(basename "${f%.cer}").crt"  # already PEM
done
sudo update-ca-certificates
```

**Step 3 — belt and braces for the runtimes that keep their own stores:**

```bash
# ~/.bashrc — covers OpenCode's documented override, Node tools, and npm
export NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt   # documented by OpenCode: network.mdx:49-57
npm config set cafile /etc/ssl/certs/ca-certificates.crt
```

.NET, git, curl, apt, and Playwright's downloads all follow the system store on Ubuntu — no
further action. There is deliberately **no** OpenCode config knob for CA bundles or for
disabling TLS verification (verified: zero TLS/CA fields in the config schema) — the OS store
*is* the mechanism, which is exactly why this setup is one-time.

**Step 4 — proxy, if applicable:**

```bash
export HTTPS_PROXY=http://proxy.corp.local:8080
export HTTP_PROXY=http://proxy.corp.local:8080
export NO_PROXY=localhost,127.0.0.1,::1        # REQUIRED — see below
```

The `NO_PROXY` loopback entries are not optional: the OpenCode TUI talks to a **local HTTP
server**, and routing that through the proxy hangs the UI — OpenCode's own docs flag this as
the primary enterprise footgun (`packages/web/src/content/docs/network.mdx:25-27`). Basic
proxy auth works via `http://user:pass@proxy:8080`; **NTLM/Kerberos proxies are explicitly
unsupported** (`network.mdx:33-45`) — if that's your shop, route model traffic through an
internal LLM gateway endpoint configured as a provider instead of fighting the proxy.

**Optional lockdown flags** for change-controlled environments (all verified in
`packages/opencode/src/effect/runtime-flags.ts` / `cli/upgrade.ts:10` /
`packages/core/src/models-dev.ts:222-258`): `OPENCODE_DISABLE_AUTOUPDATE=1` (no self-update),
`OPENCODE_DISABLE_MODELS_FETCH=1` (use the embedded model catalog, no models.dev call),
`OPENCODE_DISABLE_LSP_DOWNLOAD=1`, `OPENCODE_DISABLE_DEFAULT_PLUGINS=1`.

## 5. Install the framework into the WSL-hosted repo

Exactly as `harness/README.md` describes, from the repo now living in `~/work/<repo>`:

```bash
cp -r harness/opencode/. .opencode/ && cp opencode.json ./
cd .opencode && npm install @opencode-ai/plugin && cd ..
```

Then smoke-test the guardrail per `harness/README.md:58-60` (plant a bug, run `/verify`,
confirm the FAIL lands **inline** in the checklist).

## 6. Topology: rewiring what the container assumed

The framework's environment profile is the single override point — this is why it exists.
Two supported shapes:

**Shape A — everything in WSL (recommended, simplest).** Apps (`dotnet run`, `npm run
start:local`) run inside WSL next to the agent. Set `playbook/environment-profile.yml`:
`topology: same-host`, URLs `http://127.0.0.1:<port>`. Windows browsers can reach WSL
services on `localhost` automatically. Every `host.docker.internal` in the Verifier's world
becomes `localhost`, exactly as the table in `harness/README.md:94-99` prescribes. SQL Server
still on Windows? Enable TCP + firewall rule; with mirrored networking (§2) the connection
string host is simply `localhost`.

**Shape B — agent in WSL, apps stay on the Windows host.** With mirrored networking (§2),
`localhost` works from WSL to Windows services — same profile as Shape A. Without mirrored
networking (older Windows 10), the Windows host is reachable at the gateway IP:
`export WINHOST=$(ip route show default | awk '{print $3}')` and use `http://$WINHOST:<port>`
in the profile — the WSL analogue of `host.docker.internal`. The optional Windows-app bridge
(`WINAPP_BRIDGE`) follows the same substitution.

The Verifier itself reads all of this from the profile, so no agent-file edits are required
beyond the one-line topology note in `verifier.md:69` ("running inside a Linux Docker
container…") — update it to "running inside WSL on the user's Windows host" when you adopt
this guide; it is descriptive prose, not logic.

## 7. Migration checklist (from the container)

1. Provision WSL (§2–§4) — certificates before anything else.
2. Clone the target repo into `~/work/` (not `/mnt/c`), install the framework (§5).
3. Set the environment profile for Shape A or B (§6).
4. `opencode` → run the doctor pass: the Verifier's own Step-1 environment probe
   (`command -v dotnet node npm sqlcmd`, Playwright endpoint curl) is the acceptance test the
   framework already defines.
5. **Run the historical large-checklist workload that crashed under bun on Windows** (§1.3).
   Only after it passes: stop launching the container, keep the Dockerfile for CI.
6. Rotate nothing silently: when the corporate CA rotates, re-run §4 steps 1–2 —
   `update-ca-certificates` is idempotent.
