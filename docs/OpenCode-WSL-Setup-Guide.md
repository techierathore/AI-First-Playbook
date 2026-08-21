# OpenCode in WSL — Step-by-Step Setup Guide
**For corporate Windows laptops (Windows 10/11) and Windows Server 2022 VMs on Azure**

This is the hands-on replacement for the Docker-based setup in
[OpenCode-Setup-Guide.md](OpenCode-Setup-Guide.md). It installs OpenCode **directly inside
WSL (Ubuntu 24.04)** instead of a Linux container, which removes the three things that broke
on Windows Server:

1. **No Docker Desktop** — nothing to license, nothing that refuses to start on a server SKU.
2. **Corporate TLS handled once, at the OS level** — the OpenCode binary reads the Linux
   system trust store (built with `--use-system-ca`), so certificates are installed once per
   machine, not baked into an image and rebuilt on every rotation.
3. **Plain `localhost` topology** — no `host.docker.internal`, no port-bridge guesswork.

The *why* (with source citations) lives in [OpenCode-Guide.md](OpenCode-Guide.md). This
document is only the *how*: follow the phases top to bottom, paste the blocks, tick the
checklist in Phase 8. Every block is safe to re-run.

> **Legend:** 💻 = corporate laptop only · ☁️ = Azure Windows Server 2022 VM only ·
> (no icon) = both.

***

## Phase 0: Know your machine (2 minutes)

| | 💻 Corporate laptop | ☁️ Azure VM (Windows Server 2022) |
|---|---|---|
| Virtualization | Usually already on (check BIOS/Intune if not) | **VM size must support nested virtualization** — see Phase 1.0 |
| Microsoft Store | Often blocked by policy | Not present at all |
| Mirrored networking | Windows 11 22H2+ only | **Not available** (needs Server 2025) — use NAT (default) |
| Proxy / TLS inspection | Almost always (Zscaler, Netskope…) | Depends on VNet egress — test in Phase 3.0 |
| Admin rights | Needed once for Phase 1 (ask IT if you lack them) | You are local admin |
| Sessions | Laptop lid closes → WSL pauses | RDP **disconnect** keeps WSL alive; **sign out** kills it (Phase 7.3) |

Check your Windows build — everything below needs **Windows 10 2004 (build 19041)+**,
**Windows 11**, or **Windows Server 2022 (build 20348)+**:

```powershell
[System.Environment]::OSVersion.Version
(Get-ComputerInfo).OsName
```

***

## Phase 1: Enable WSL (Windows side, once per machine, admin PowerShell)

### 1.0 ☁️ Azure only — confirm the VM size can run WSL2

WSL2 is a Hyper-V VM, so the Azure VM itself must expose virtualization ("nested
virtualization"). Supported on v3-generation and newer sizes (`Dsv3`, `Dsv4`, `Dsv5`,
`Dasv5`, `Esv5`, …). **Not** supported on `Av2`, `Dv2`, or original `B`-series.

```powershell
# True = good. False = resize the VM (e.g. Standard_D4s_v5 / D8s_v5) before continuing.
(Get-ComputerInfo).HyperVRequirementVirtualizationFirmwareEnabled
```

If the property is blank, run `systeminfo` and look at the last "Hyper-V Requirements" lines
— "Virtualization Enabled In Firmware: Yes" is what you need. Resizing is done in the Azure
portal (VM → Size); it takes a reboot and no data is lost.

Recommended size for agentic builds (OpenCode + dotnet build + Playwright browser):
**4 vCPU / 16 GB** minimum, 8 vCPU / 32 GB comfortable.

### 1.1 Install WSL + Ubuntu 24.04 (primary path)

```powershell
wsl --install -d Ubuntu-24.04 --web-download
```

`--web-download` pulls WSL and the distro from Microsoft's servers instead of the Store, so it
works on ☁️ Server 2022 (no Store) and on 💻 laptops where the Store is blocked. **Reboot
when asked**, then re-open PowerShell and run:

```powershell
wsl --update
wsl --set-default-version 2
wsl --version          # expect WSL version 2.x
wsl --list --verbose   # expect Ubuntu-24.04 ... VERSION 2
```

### 1.2 Fallback — fully offline / download blocked

If `wsl --install` fails with a download or Store error, do it by hand:

```powershell
# a) Windows features (reboot afterwards)
Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -NoRestart
Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux -NoRestart
Restart-Computer
```

```powershell
# b) WSL itself — download the latest  wsl.<version>.x64.msi  from
#    https://github.com/microsoft/WSL/releases  (on another machine if needed) and run it:
msiexec /i .\wsl.2.x.x.x.x64.msi /qn
wsl --version

# c) Ubuntu — download the 24.04 WSL image (ubuntu-24.04 ... .wsl) from
#    https://ubuntu.com/desktop/wsl  and import it:
wsl --install --from-file .\ubuntu-24.04.wsl
#    (older WSL builds: wsl --import Ubuntu-24.04 C:\WSL\Ubuntu-24.04 .\ubuntu-24.04.wsl)
```

### 1.3 First start of Ubuntu — create your Linux user

```powershell
wsl -d Ubuntu-24.04
```

You'll be asked for a **Linux username and password** (lower-case, no spaces; the password is
for `sudo`, it is not your Windows password). If the distro was imported via `--import` you
land as root — create a user first:

```bash
# only after --import (skip if you were prompted for a username)
adduser srkra && usermod -aG sudo srkra
printf '[user]\ndefault=srkra\n' > /etc/wsl.conf
exit
```

### 1.4 Make Ubuntu the default distro and set resource limits

Back in PowerShell. The default-distro step matters: if Docker Desktop was ever installed,
`docker-desktop` may be the default and bare `wsl` commands land in the wrong place.

```powershell
wsl --set-default Ubuntu-24.04
```

Create `%USERPROFILE%\.wslconfig` (paste the whole block into PowerShell):

```powershell
@"
[wsl2]
# Leave ~25% of RAM to Windows; adjust to your machine
memory=12GB
processors=4
swap=4GB
# Keeps WSL running when the last terminal closes (unattended runs, Phase 7.3)
vmIdleTimeout=-1
"@ | Set-Content "$env:USERPROFILE\.wslconfig" -Encoding Ascii
wsl --shutdown
```

💻 **Windows 11 22H2+ only** (optional but recommended): add `networkingMode=mirrored` under
`[wsl2]` so `localhost` works in both directions between Windows and WSL. Do **not** add it on
☁️ Server 2022 or Windows 10 — WSL ignores it with a warning at best.

***

## Phase 2: Get the Playbook onto Windows

Clone (or copy) this repository somewhere on the Windows drive with your normal Git client:

```powershell
git clone <your-org-git-url>/AI-First-Playbook C:\Work\AI-First-Playbook
```

WSL sees it as `/mnt/c/Work/AI-First-Playbook`. We only need it here for the provisioning
script and the certificate export; your actual working repos go *inside* WSL in Phase 6.

***

## Phase 3: Corporate certificates (PowerShell, once — and after every CA rotation)

### 3.0 Do I even need this?

From the Ubuntu prompt (`wsl`):

```bash
curl -sI https://api.anthropic.com | head -1
```

- `HTTP/2 ...` or `HTTP/1.1 ...` → no TLS inspection on this network. Skip to Phase 4.
- `curl: (60) SSL certificate problem` → a proxy re-signs TLS. Continue with 3.1.

☁️ Azure VMs without forced tunnelling usually pass; 💻 laptops on the office network or VPN
almost never do.

### 3.1 Export every trusted root from Windows

Exports each certificate as its own `.cer` (no need to know your CA's name — public roots
that come along are already trusted by Ubuntu and are harmless duplicates):

```powershell
$out = "C:\temp\corp-ca"
New-Item -ItemType Directory -Force $out | Out-Null
Remove-Item "$out\*.cer" -ErrorAction SilentlyContinue
Get-ChildItem Cert:\LocalMachine\Root, Cert:\CurrentUser\Root, Cert:\LocalMachine\CA |
  Sort-Object Thumbprint -Unique |
  ForEach-Object {
    Export-Certificate -Cert $_ -FilePath (Join-Path $out "$($_.Thumbprint).cer") -Type CERT | Out-Null
  }
"Exported $((Get-ChildItem $out).Count) certificates to $out"
```

`Cert:\LocalMachine\CA` is included on purpose: TLS-inspection vendors often install an
*intermediate* there, and OpenSSL needs the full chain.

### 3.2 Find your proxy address (if any)

```powershell
netsh winhttp show proxy
Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings" | Select-Object ProxyServer, AutoConfigURL
```

- A host:port like `proxy.corp.local:8080` → you'll pass `--proxy=http://proxy.corp.local:8080`
  in Phase 4.
- Only a PAC `AutoConfigURL` → open the PAC file in a browser and take the `PROXY host:port`
  it returns for `*.anthropic.com` / `api.openai.com`; ask IT if unclear.
- "Direct access" and 3.0 passed → no proxy flag needed.

> NTLM / Kerberos-authenticated proxies are **not supported** by OpenCode. If your proxy
> needs Windows auth, ask IT for an unauthenticated egress rule to your LLM endpoints, or
> route through an internal LLM gateway configured as a provider.

***

## Phase 4: Provision Ubuntu (one script, inside WSL)

Open Ubuntu (`wsl`) and run the repo's idempotent provisioning script. The `tr -d '\r'`
wrapper makes it immune to Windows line endings.

```bash
sudo -v
REPO=/mnt/c/Work/AI-First-Playbook      # adjust if you cloned elsewhere

# Pick the line that matches your Phase 3 result:
bash <(tr -d '\r' < $REPO/scripts/provision-wsl.sh)                                   # no inspection, no proxy
bash <(tr -d '\r' < $REPO/scripts/provision-wsl.sh) --certs=/mnt/c/temp/corp-ca       # TLS inspection, no explicit proxy
bash <(tr -d '\r' < $REPO/scripts/provision-wsl.sh) --certs=/mnt/c/temp/corp-ca --proxy=http://proxy.corp.local:8080
```

What it does (in order, each step skipped when already done): installs the certificates into
`/usr/local/share/ca-certificates` + `update-ca-certificates`, writes proxy + `NO_PROXY`
loopback exports to `~/.bashrc`, installs `curl git unzip`, Node.js 22, .NET SDK 8, `sqlcmd`,
Playwright browser dependencies, and finally OpenCode via `curl -fsSL https://opencode.ai/install | bash`.

Flags to trim it: `--no-dotnet`, `--no-sql`, `--no-playwright`.

Afterwards:

```bash
source ~/.bashrc
command -v opencode dotnet node npm sqlcmd
opencode --version
curl -sI https://api.anthropic.com | head -1      # must now return an HTTP line, not (60)
```

If `opencode` is not found: the installer puts it in `~/.opencode/bin` — add it once:

```bash
echo 'export PATH="$HOME/.opencode/bin:$PATH"' >> ~/.bashrc && source ~/.bashrc
```

**Locked-down proxy blocks `opencode.ai`?** Use the npm route, which honours your `.npmrc`
registry mirror / `cafile` / `proxy`:

```bash
npm config set cafile /etc/ssl/certs/ca-certificates.crt
npm install -g opencode-ai
```

***

## Phase 5: Sign in and carry over your existing OpenCode settings

### 5.1 Reuse what the Docker setup already had

The old `opencode-docker` function mounted your Windows `~/.config/opencode` and
`~/.local/share/opencode` folders. Copy them into WSL once and your auth + settings come with:

```bash
WIN_HOME=$(wslpath "$(cmd.exe /c 'echo %USERPROFILE%' 2>/dev/null | tr -d '\r')")
mkdir -p ~/.config ~/.local/share
[ -d "$WIN_HOME/.config/opencode" ]      && cp -rn "$WIN_HOME/.config/opencode"      ~/.config/
[ -d "$WIN_HOME/.local/share/opencode" ] && cp -rn "$WIN_HOME/.local/share/opencode" ~/.local/share/
chmod 600 ~/.local/share/opencode/auth.json 2>/dev/null; true
```

### 5.2 Or sign in fresh (or skip to 5.3 to paste keys by hand)

```bash
opencode auth login
```

Pick your provider. API-key providers are instant. OAuth flows (e.g. a Claude Pro/Max
subscription) print a URL — on ☁️ the VM has no browser, so copy the URL into a browser on
your laptop, finish the login, and paste the code back. Credentials land in
`~/.local/share/opencode/auth.json` (inside WSL — never in the repo).

```bash
opencode models | head          # lists models you're authorised for
```


### 5.3 Editing `auth.json` and `opencode.json` by hand (no `opencode auth login`)

If you prefer to paste keys and model configs directly — as you did on the office laptop for
the Docker container — the files are the same, only the path moved into the Linux home.

**Where they live**

| File | Purpose | Linux path (inside WSL) | Same file seen from Windows Explorer / Notepad |
|---|---|---|---|
| `auth.json` | Provider credentials (API keys / OAuth tokens) | `~/.local/share/opencode/auth.json` | `\\wsl.localhost\Ubuntu-24.04\home\<linux-user>\.local\share\opencode\auth.json` |
| `opencode.json` (or `.jsonc`) | **Global** config: providers, custom models, default model, MCP servers | `~/.config/opencode/opencode.json` | `\\wsl.localhost\Ubuntu-24.04\home\<linux-user>\.config\opencode\opencode.json` |
| `opencode.json` | **Per-project** config (the Playbook's harness file) — overrides global | `~/work/<repo>/opencode.json` | `\\wsl.localhost\Ubuntu-24.04\home\<linux-user>\work\<repo>\opencode.json` |
| `.opencode/config.json` | Per-project extras (e.g. Playwright MCP, Phase 6) | `~/work/<repo>/.opencode/config.json` | same pattern |

`<linux-user>` is the name you chose in Phase 1.3 (`whoami` in WSL). On older Windows 10
builds use `\\wsl$\Ubuntu-24.04\...` instead of `\\wsl.localhost\...`. The Docker container
read `%USERPROFILE%\.local\share\opencode` and `%USERPROFILE%\.config\opencode` on Windows;
WSL OpenCode does **not** look there — Phase 5.1 copies them over once, after that edit the
WSL copies only.

**Three ways to open them**

```powershell
# A) Notepad from Windows (paths are live — saving writes straight into WSL)
notepad \\wsl.localhost\Ubuntu-24.04\home\<linux-user>\.local\share\opencode\auth.json
notepad \\wsl.localhost\Ubuntu-24.04\home\<linux-user>\.config\opencode\opencode.json
```

```bash
# B) From inside WSL — opens in Notepad / VS Code on Windows
notepad.exe "$(wslpath -w ~/.local/share/opencode/auth.json)"
code ~/.config/opencode/opencode.json          # VS Code with the WSL extension
# C) Terminal editor (works on the ☁️ VM over a bare RDP console)
nano ~/.local/share/opencode/auth.json         # Ctrl+O save, Ctrl+X exit
```

Create the folders first if this is a fresh machine and Phase 5.1 found nothing to copy:

```bash
mkdir -p ~/.local/share/opencode ~/.config/opencode
[ -f ~/.local/share/opencode/auth.json ] || echo '{}' > ~/.local/share/opencode/auth.json
[ -f ~/.config/opencode/opencode.json ]  || echo '{ "$schema": "https://opencode.ai/config.json" }' > ~/.config/opencode/opencode.json
chmod 600 ~/.local/share/opencode/auth.json
```

**`auth.json` format** — one entry per provider id; `type: "api"` for keys (OAuth entries,
written by `opencode auth login`, use `type: "oauth"` with `access`/`refresh`/`expires` —
leave those alone):

```json
{
  "anthropic": { "type": "api", "key": "sk-ant-..." },
  "openai":    { "type": "api", "key": "sk-..." },
  "azure":     { "type": "api", "key": "..." }
}
```

**`opencode.json` (global) format** — providers you need to point at a custom endpoint
(internal LLM gateway, Azure OpenAI, Ollama) and the default models. The key is optional
here if it is already in `auth.json`; `{env:VAR}` substitution is supported if you would
rather keep the key in `~/.bashrc`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "model": "anthropic/claude-sonnet-4-5",
  "small_model": "anthropic/claude-haiku-4-5",
  "provider": {
    "corp-gateway": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Corporate LLM Gateway",
      "options": {
        "baseURL": "https://llm-gateway.corp.local/v1",
        "apiKey": "{env:CORP_GATEWAY_KEY}"
      },
      "models": {
        "gpt-4.1": { "name": "GPT-4.1 (gateway)" }
      }
    }
  }
}
```

Per-project `opencode.json` (the Playbook ships one with the per-phase model tiers) wins over
the global file for any key it sets, so put **credentials and endpoints in the global files**
and **model routing in the project file** — then a repo can be shared without leaking keys.

**After editing**

```bash
# Valid JSON? (trailing commas are the usual mistake when pasting from Notepad)
node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log("ok")' ~/.local/share/opencode/auth.json
opencode auth list          # shows which providers have credentials
opencode models | head      # your provider's models must appear
```

Restart OpenCode if it was already running — both files are read at startup. Notepad saves
with Windows line endings; OpenCode's JSON parser does not care, so no conversion is needed.
**Never** copy these files into a repo, and keep `auth.json` at `chmod 600`.
***

## Phase 6: Put a project in WSL and install the harness

**Keep working repos on the Linux filesystem** (`~/work`), not under `/mnt/c`. Cross-OS file
I/O is several times slower and `/mnt/c` can carry stale root-owner metadata from the Docker
era that blocks writes.

```bash
mkdir -p ~/work && cd ~/work
git clone <your-org-git-url>/AI-First-Playbook            # the framework
git clone <your-org-git-url>/MyWebApp                     # a project to work on
cd MyWebApp
```

Install the OpenCode pack into the project exactly as `harness/README.md` describes:

```bash
cp -r ~/work/AI-First-Playbook/harness/opencode/. .opencode/
cp ~/work/AI-First-Playbook/opencode.json ./
(cd .opencode && npm install @opencode-ai/plugin)
```

Set the topology in `playbook/environment-profile.yml` (copy it from the framework if the
project lacks one):

- **Apps run inside WSL** (recommended; `dotnet run` / `npm start` from the same shell):
  `topology: same-host`, URLs `http://127.0.0.1:<port>`.
- **Apps stay on the Windows host** (e.g. SQL Server on Windows) **without mirrored
  networking** (☁️ Server 2022, Windows 10): Windows is reachable at the WSL gateway IP —
  `export WINHOST=$(ip route show default | awk '{print $3}')` and use `http://$WINHOST:<port>`.
  Open the Windows firewall for that port from the `172.x` WSL subnet.
- With mirrored networking (💻 Win 11): plain `localhost` both ways.

Playwright MCP per project (same `.opencode/config.json` snippet as the Docker guide — it now
runs natively in WSL, browsers download on first use):

```bash
sudo npx --yes playwright install chromium     # once per machine
```

***

## Phase 7: Daily use

### 7.1 From a terminal

```bash
wsl                      # or: wsl -d Ubuntu-24.04
cd ~/work/MyWebApp
opencode
```

Windows Terminal gives the best TUI rendering. ☁️ Server 2022 doesn't ship it — the plain
`wsl` console works fine; optionally install Windows Terminal from its GitHub releases
(`.msixbundle`, `Add-AppxPackage`).

### 7.2 From VS Code (recommended on laptops)

Install the **WSL** extension, then `Ctrl+Shift+P → WSL: Connect to WSL`, open
`~/work/MyWebApp`, and run `opencode` in the integrated terminal. The file tree, Git, and
the agent all see the same Linux filesystem.

### 7.3 ☁️ Unattended / YOLO runs on the VM

WSL lives in your Windows logon session. **Disconnect** RDP (close the window) and it keeps
running; **Sign out** and it dies. To survive a dropped RDP link, run the agent inside `tmux`:

```bash
sudo apt-get install -y tmux
tmux new -s build            # start
#   ... opencode / node scripts/playbook-yolo.mjs ...
#   detach: Ctrl+b then d
tmux attach -t build         # come back later
```

`vmIdleTimeout=-1` from Phase 1.4 prevents WSL from shutting down when the last terminal
closes. Also set the VM's Windows power plan to **High performance** and disable RDP
session time-limits in Local Group Policy (Remote Desktop Session Host → Session Time Limits)
if your image has them.

### 7.4 Optional PowerShell shortcut (replaces `opencode-docker`)

Add to `notepad $PROFILE`:

```powershell
function opencode-wsl {
    # Runs OpenCode in WSL for the current Windows folder (fine for quick looks;
    # for real work keep the repo under ~/work inside WSL — see Phase 6).
    wsl -d Ubuntu-24.04 --cd "$PWD" -e bash -lc "opencode $args"
}
```

***

## Phase 8: Acceptance checklist — run this yourself before training the team

Inside WSL, from a project with the harness installed:

```bash
# 1. Toolchain
command -v opencode dotnet node npm sqlcmd && opencode --version

# 2. TLS chain through the corporate proxy
curl -sI https://api.anthropic.com | head -1
curl -sI https://registry.npmjs.org | head -1
dotnet nuget list source >/dev/null && echo "dotnet ok"

# 3. Loopback is NOT proxied (the TUI talks to a local server)
env | grep -i no_proxy          # must contain localhost,127.0.0.1 when a proxy is set

# 4. Model round-trip on a free model (zero cost)
FREE=$(opencode models | grep -m1 -- "-free$")   # any zero-cost model
opencode run -m "$FREE" "reply with the single word OK"

# 5. Harness integrity (from ~/work/AI-First-Playbook)
(cd ~/work/AI-First-Playbook && npm run validate && npm run test:guardrails)

# 6. Guardrail smoke test — plant a bug, run /verify, confirm FAIL lands inline
#    (harness/README.md "smoke test")

# 7. The historical crash case: run the large-checklist workload that used to
#    throw "expected integer" under Windows-native bun. It must complete here.
```

☁️ On the VM additionally: disconnect RDP for 10 minutes mid-run (Phase 7.3) and reconnect —
the `tmux` session must still be running.

All green → stop using `opencode-docker`; keep the Dockerfile only for CI.

***

## Phase 9: Troubleshooting

| Symptom | Cause → Fix |
|---|---|
| `wsl --install` → *WSL2 is not supported with your current machine configuration* / error `0x80370102` | ☁️ VM size has no nested virtualization → resize (Phase 1.0). 💻 Virtualization off in BIOS / Hyper-V blocked by policy → IT. |
| `wsl --install` hangs or *download failed* | Store/egress blocked → offline MSI + `.wsl` image (Phase 1.2). |
| Bare `wsl` opens `docker-desktop` or a root shell | Wrong default distro → `wsl --set-default Ubuntu-24.04`; missing `/etc/wsl.conf [user]` (Phase 1.3). |
| `bash: $'\r': command not found` | Script has CRLF endings → use the `tr -d '\r'` invocation (Phase 4) or `git config core.autocrlf false` before cloning. |
| `curl: (60) SSL certificate problem` / `unable to get local issuer certificate` / `UNABLE_TO_VERIFY_LEAF_SIGNATURE` | CA not in Linux store → re-run Phase 3.1 + Phase 4 with `--certs`. Verify with `openssl s_client -connect api.anthropic.com:443 </dev/null 2>/dev/null \| openssl x509 -noout -issuer`. Never disable TLS verification — OpenCode has no such switch by design. |
| `apt-get update` fails on `Certificate verification failed` | Same as above; the script installs certs first for exactly this reason. If even that fails, temporarily `export HTTPS_PROXY=` (unset) and check whether the proxy is the one blocking. |
| OpenCode TUI starts then freezes / spinner forever | Loopback going through the proxy → `NO_PROXY=localhost,127.0.0.1,::1` missing (Phase 4 sets it; `source ~/.bashrc`). |
| `Temporary failure in name resolution` inside WSL, especially 💻 on VPN | VPN replaced DNS after WSL booted → `wsl --shutdown` and reopen. Persistent: in `/etc/wsl.conf` add `[network]\ngenerateResolvConf=false`, then `sudo bash -c 'echo nameserver <corp-dns-ip> > /etc/resolv.conf'`. Windows 11: `dnsTunneling=true` under `[wsl2]` in `.wslconfig` instead. |
| ☁️ Can't reach a Windows-host service from WSL on `localhost` | Server 2022 has no mirrored networking → use the gateway IP (Phase 6, shape B) and a firewall rule. |
| Windows can't reach a WSL-hosted app on `localhost` | Should work by default (`localhostForwarding`). If not, the app is bound to `127.0.0.1` only inside WSL → bind to `0.0.0.0`, or run `wsl --shutdown`. |
| `opencode: command not found` after install | `~/.opencode/bin` not on PATH → Phase 4 PATH line. |
| Everything slow, `git status` takes seconds | Repo lives under `/mnt/c` → move it to `~/work` (Phase 6). |
| `EACCES` writing files in a repo copied from `/mnt/c` | Stale root-owner metadata from the container era → clone fresh into `~/work`; or add `[automount] options="metadata"` to `/etc/wsl.conf`, `wsl --shutdown`, then `sudo chown -R $USER:$USER <repo>`. |
| ☁️ Run died overnight | You signed out of RDP, or an RDP session limit logged you off → `tmux` + disconnect-don't-sign-out (Phase 7.3); check Group Policy session limits. |
| OpenCode updated itself and something looks off | Expected — no version pinning. Run the Phase 8 steps 5–6; a failure there is the harness, anything else is your checklist or code ([OpenCode-Guide.md](OpenCode-Guide.md) §8). |

***

## Appendix: What's different from the Docker guide

| Docker guide | This guide |
|---|---|
| `docker build` per machine, certs baked into image | `provision-wsl.sh` per machine, certs in OS store, re-run on rotation |
| `opencode-docker` PowerShell function | `wsl` → `cd ~/work/<repo>` → `opencode` (or `opencode-wsl`) |
| Repo on `C:\`, mounted into `/app` | Repo in `~/work` inside WSL (fast, correct file ownership) |
| `host.docker.internal` for Windows services | `localhost` (mirrored) or WSL gateway IP (NAT) |
| Auth/config in Windows `%USERPROFILE%`, mounted | Auth/config in WSL home (`~/.local/share/opencode/auth.json`, `~/.config/opencode/opencode.json`); copy once (Phase 5.1), edit via `\\wsl.localhost\Ubuntu-24.04\home\...` (Phase 5.3) |
| Alpine + `--allow-untrusted` workarounds | Stock Ubuntu 24.04, nothing untrusted |
