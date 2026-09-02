# OpenCode on a Corporate Windows Laptop — WSL Setup

Follow the steps in order. Every command is copy-paste. After each step there is an
**Expect** line — if you don't see that, stop and read the **If it fails** note before
moving on.

You do **not** need to clone this repository to finish the setup. Everything below is
typed by hand. (There is an optional one-command script at the end, Step 13.)

> **Placeholders.** Anything in `<angle brackets>` — and any hostname ending in
> `.corp.local` — is an example, not a real address. Replace it with the value your IT
> team gives you, or skip that command. Pasting one literally leaves the tool pointing at
> a host that does not exist, which shows up later as `ENOTFOUND`.

**Two windows are used:**

- **PowerShell (Admin)** on Windows — steps 1, 2, 4
- **Ubuntu terminal** (type `wsl` in any terminal) — steps 3, 5 onwards

---

## The error most people hit first

```
$ curl -fsSL https://opencode.ai/install | bash
curl: (60) SSL certificate problem: unable to get local issuer certificate
```

**This is not a bug in OpenCode.** Your company runs a proxy (Zscaler, Netskope, Palo Alto,
Blue Coat…) that opens every HTTPS connection and re-signs it with the company's own
certificate. Windows trusts that certificate. A fresh Ubuntu inside WSL does not.

**So: do Step 4 before you run any `curl`, `npm`, `apt`, `dotnet` or `git` command in
Ubuntu.** Everything else in this guide fails for the same reason until that step is done.

If you already hit the error, jump straight to **Step 4**, then come back to Step 5.

---

## Step 1 — Check Windows can run WSL 2

**PowerShell (Admin):**

```powershell
[System.Environment]::OSVersion.Version
```

**Expect:** Build **19041 or higher** (Windows 10 2004+, Windows 11, or Windows Server 2022).

**If it fails:** older builds cannot run WSL 2. Ask IT for a Windows update.

---

## Step 2 — Install WSL and Ubuntu 24.04

**PowerShell (Admin):**

```powershell
wsl --install -d Ubuntu-24.04 --web-download
```

`--web-download` downloads from Microsoft directly instead of the Microsoft Store, because
the Store is blocked on most corporate machines.

**Reboot when it asks.** Then, back in PowerShell:

```powershell
wsl --update
wsl --set-default-version 2
wsl --set-default Ubuntu-24.04
wsl --list --verbose
```

**Expect:** a line like `* Ubuntu-24.04    Running    2` — the `2` matters.

**If it fails:**

| What you see | What to do |
|---|---|
| `WSL2 is not supported with your current machine configuration` / error `0x80370102` | Virtualization is off in BIOS or blocked by Intune. Ask IT to enable Virtualization / Hyper-V. |
| Download failed, or nothing happens for 10+ minutes | The proxy blocks the download. See "Offline install" below. |
| `wsl` opens something called `docker-desktop` or drops you at a `root@` prompt | Wrong default distro. Run `wsl --set-default Ubuntu-24.04` and open a new terminal. |

<details>
<summary><b>Offline install</b> (only if the command above was blocked)</summary>

```powershell
# a) Turn on the Windows features, then reboot
Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -NoRestart
Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux -NoRestart
Restart-Computer
```

```powershell
# b) Download wsl.<version>.x64.msi from https://github.com/microsoft/WSL/releases
#    (use a machine that can reach it), copy it over, then:
msiexec /i .\wsl.2.x.x.x.x64.msi /qn

# c) Download the Ubuntu 24.04 image (ubuntu-24.04....wsl) from https://ubuntu.com/desktop/wsl
wsl --install --from-file .\ubuntu-24.04.wsl
```
</details>

### First launch — create your Linux user

```powershell
wsl
```

You are asked for a **username** and **password**. These are new and local to Ubuntu — the
password is only used for `sudo`, it is not your Windows password. Use lowercase, no spaces.

**Expect:** a prompt like `yourname@YOURPC:~$`.

> If you land at `root@...` instead of your own name, you imported the distro manually. Fix it:
> ```bash
> adduser yourname && usermod -aG sudo yourname
> printf '[user]\ndefault=yourname\n' > /etc/wsl.conf
> exit
> ```
> then `wsl --shutdown` in PowerShell and `wsl` again.

---

## Step 3 — Do you actually have the certificate problem?

**Ubuntu:**

```bash
curl -sI https://opencode.ai | head -1
```

- **`HTTP/2 200`** (or any `HTTP/...` line) → no TLS interception here. **Skip to Step 6.**
- **`curl: (60) SSL certificate problem`** → continue with Step 4.

Want to see who is intercepting you? This prints the name of the certificate authority:

```bash
openssl s_client -connect opencode.ai:443 </dev/null 2>/dev/null | openssl x509 -noout -issuer
```

If it says something like `issuer= ... Zscaler Root CA` or your company's name instead of a
public CA (DigiCert, Let's Encrypt, Google Trust Services), that confirms it.

---

## Step 4 — Install the corporate certificates into Ubuntu

This is the step that fixes `curl: (60)`. Do it once per machine, and again whenever IT
rotates the certificate (usually once a year — the symptom is that everything starts failing
with error 60 again).

### 4a. Export the certificates from Windows

**PowerShell** (Admin not required). Paste the whole block:

```powershell
$out = "C:\temp\corp-ca"
New-Item -ItemType Directory -Force $out | Out-Null
Remove-Item "$out\*.crt" -ErrorAction SilentlyContinue

$certs = Get-ChildItem Cert:\LocalMachine\Root, Cert:\LocalMachine\CA, Cert:\CurrentUser\Root |
         Sort-Object Thumbprint -Unique

foreach ($c in $certs) {
    $b64 = [Convert]::ToBase64String($c.RawData, 'InsertLineBreaks')
    $pem = "-----BEGIN CERTIFICATE-----`r`n$b64`r`n-----END CERTIFICATE-----`r`n"
    Set-Content -Path "$out\corp-$($c.Thumbprint).crt" -Value $pem -Encoding Ascii
}
"Exported $($certs.Count) certificates to $out"
```

**Expect:** `Exported 40 certificates to C:\temp\corp-ca` (any number from ~20 to ~200 is normal).

Notes:

- It exports **everything**, so you don't have to know your company CA's name. The public
  CAs that come along are already trusted by Ubuntu — harmless duplicates.
- `Cert:\LocalMachine\CA` is included on purpose. Interception products often put an
  *intermediate* certificate there, and Linux needs the whole chain, not just the root.

### 4b. Install them into Ubuntu

**Ubuntu:**

```bash
sudo mkdir -p /usr/local/share/ca-certificates
sudo cp /mnt/c/temp/corp-ca/*.crt /usr/local/share/ca-certificates/
sudo sed -i 's/\r$//' /usr/local/share/ca-certificates/*.crt   # strip Windows line endings
sudo update-ca-certificates
```

**Expect:** a line like `40 added, 0 removed; done.`

### 4c. Tell the other tools where the store is

Some runtimes keep their own certificate list and ignore the system one. This covers them:

```bash
cat >> ~/.bashrc <<'EOF'

# Corporate CA — added by the OpenCode WSL setup
export NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt
export SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt
export REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt
EOF
source ~/.bashrc
```

### 4d. Prove it worked

```bash
curl -sI https://opencode.ai/install | head -1
curl -sI https://registry.npmjs.org | head -1
curl -sI https://api.anthropic.com | head -1
```

**Expect:** three `HTTP/...` lines. No `curl: (60)`.

**If it still fails:**

| What you see | What to do |
|---|---|
| Still `(60)` on all three | The root you need wasn't in the stores you exported. Run the issuer check from Step 3, then in Windows open `certlm.msc`, search all stores for that issuer name, export it as **Base-64 X.509 (.CER)**, rename it `.crt`, drop it in `C:\temp\corp-ca`, and repeat 4b. |
| `(60)` only on some hosts | Different proxy policy per destination. Ask IT to allow `opencode.ai`, `registry.npmjs.org`, `api.anthropic.com`, `github.com`, `objects.githubusercontent.com`. |
| `Could not resolve host` | DNS, not certificates. See Step 12. |
| `Connection timed out` | You need an explicit proxy address — Step 5. |

> **Never** work around this with `curl -k`, `NODE_TLS_REJECT_UNAUTHORIZED=0`, or
> `git config http.sslVerify false`. It hides the problem in one tool and it will come back
> in the next one. OpenCode deliberately has no "ignore certificates" switch.

---

## Step 5 — Proxy address (only if Step 4d timed out)

Most corporate networks are transparent — the proxy intercepts without you configuring
anything, and Step 4 was all you needed. **If Step 4d gave you HTTP lines, skip this step.**

Find the proxy in **PowerShell**:

```powershell
netsh winhttp show proxy
Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings" |
  Select-Object ProxyServer, AutoConfigURL
```

- You get a `host:port` (e.g. `proxy.corp.local:8080`) → use it below.
- You only get an `AutoConfigURL` (a PAC file) → open that URL in a browser, find the
  `PROXY host:port` it returns, or ask IT for the plain address.

**Ubuntu:**

Substitute the real address you just found — `<proxy-host>` and `<port>` are placeholders:

```bash
cat >> ~/.bashrc <<EOF
export HTTP_PROXY=http://<proxy-host>:<port>
export HTTPS_PROXY=http://<proxy-host>:<port>
export NO_PROXY=localhost,127.0.0.1,::1
EOF
source ~/.bashrc
curl -sI https://opencode.ai | head -1     # must now print an HTTP line
```

**The `NO_PROXY` line is not optional.** OpenCode's interface talks to a small server on
your own machine. If that traffic goes to the proxy, the app starts and then hangs forever
on a spinner.

> **Proxies that ask for a Windows login (NTLM / Kerberos) do not work with OpenCode.** If
> yours does, ask IT for an unauthenticated rule to the hosts listed in Step 4d, or point
> OpenCode at your company's internal LLM gateway instead (Step 9).

---

## Step 6 — Install OpenCode

**Ubuntu:**

```bash
curl -fsSL https://opencode.ai/install | bash
echo 'export PATH="$HOME/.opencode/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
opencode --version
```

**Expect:** a version number.

**If it fails:**

| What you see | What to do |
|---|---|
| `curl: (60) SSL certificate problem` | Step 4 was skipped or didn't take. Re-run Step 4d. |
| `opencode: command not found` after a successful install | The `PATH` line above wasn't applied. Run `source ~/.bashrc`, or open a new Ubuntu terminal. |
| The proxy blocks `opencode.ai` entirely but npm works | Install through npm instead: `npm config set cafile /etc/ssl/certs/ca-certificates.crt` then `npm install -g opencode-ai`. |

---

## Step 7 — Install Node.js, .NET and sqlcmd

Skip whichever ones your projects don't use.

### 7a. Node.js 22

```bash
sudo apt-get update
sudo apt-get install -y curl git unzip
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version && npm --version
```

Point npm at the corporate certificates too:

```bash
npm config set cafile /etc/ssl/certs/ca-certificates.crt
```

**Internal npm mirror — skip this unless you have the real URL from IT.**

Most people do **not** need to change the registry: the default `registry.npmjs.org` works
fine once Step 4 is done. Only set this if your company runs an Artifactory / Nexus mirror
*and* you have its actual address:

```bash
npm config get registry                  # default: https://registry.npmjs.org/
# ONLY with a real address from IT — <angle brackets> are a placeholder, not a hostname:
npm config set registry https://<your-npm-mirror-host>/repository/npm-group/
npm ping                                 # must succeed before you continue
```

**Set it by mistake?** Every later `npm` and `npx` command dies with
`ENOTFOUND <that-host>`. Undo it:

```bash
npm config delete registry
npm config get registry                  # back to https://registry.npmjs.org/
```

### 7b. .NET SDK

Try Ubuntu's own packages first — this is the least trouble:

```bash
sudo apt-get install -y dotnet-sdk-8.0
dotnet --list-sdks
```

For .NET 9 or 10, check whether the package exists on your machine:

```bash
apt-cache policy dotnet-sdk-10.0 dotnet-sdk-9.0
```

If a `Candidate:` version is shown, install it the same way (`sudo apt-get install -y
dotnet-sdk-10.0`). If it says `Candidate: (none)`, add Microsoft's package feed:

```bash
sudo apt-get install -y wget
source /etc/os-release
wget https://packages.microsoft.com/config/ubuntu/$VERSION_ID/packages-microsoft-prod.deb -O /tmp/ms-prod.deb
sudo dpkg -i /tmp/ms-prod.deb
sudo apt-get update
sudo apt-get install -y dotnet-sdk-10.0
```

Still not available? Use Microsoft's install script, which always has every version:

```bash
curl -fsSL https://dot.net/v1/dotnet-install.sh -o /tmp/dotnet-install.sh
bash /tmp/dotnet-install.sh --channel 10.0 --install-dir "$HOME/.dotnet"
echo 'export DOTNET_ROOT="$HOME/.dotnet"' >> ~/.bashrc
echo 'export PATH="$HOME/.dotnet:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

Multiple SDKs can be installed side by side; `global.json` in a repo picks the one it needs.

```bash
dotnet --list-sdks
dotnet nuget list source
```

**If NuGet restore fails with a certificate error**, .NET is not seeing the store. Confirm
Step 4b ran, then retry. If your company uses an internal NuGet feed, add it:

```bash
# Replace the URL with your real feed — do not paste this line as-is
dotnet nuget add source https://<your-nuget-host>/v3/index.json -n corp
```

> ### ⚠️ .NET Framework 4.x does not run in WSL
>
> If your solution targets **.NET Framework** (`net48`, `net472`, anything `v4.x`) — as
> opposed to **.NET 8/9/10** — it cannot be built or run inside Ubuntu. .NET Framework is
> Windows-only and always will be. Two options:
>
> 1. **Build on Windows, drive from WSL.** OpenCode can call the Windows build directly —
>    see Step 10c. This is the normal answer for older ASP.NET / WinForms / WCF codebases.
> 2. **Keep OpenCode on Windows for that repo** and use WSL only for the .NET 8/9/10 ones.
>
> Check what you have: `grep -r TargetFramework --include=*.csproj .`

### 7c. sqlcmd (only if you use SQL Server)

Use Microsoft's own `.deb` to register the feed. It installs the signing key **and** the
source list together, correctly matched — which is the part that goes wrong if you do it by
hand (see the warning below).

```bash
# If you already ran the packages-microsoft-prod.deb step in 7b, skip to the install.
source /etc/os-release
curl -fsSL "https://packages.microsoft.com/config/ubuntu/${VERSION_ID}/packages-microsoft-prod.deb" -o /tmp/ms-prod.deb
sudo dpkg -i /tmp/ms-prod.deb
sudo apt-get update
sudo ACCEPT_EULA=Y apt-get install -y mssql-tools18 unixodbc-dev
echo 'export PATH="$PATH:/opt/mssql-tools18/bin"' >> ~/.bashrc
source ~/.bashrc
sqlcmd -?
```

**Expect:** `sqlcmd -?` prints usage text.

> ### ⚠️ `NO_PUBKEY EB3E94ADBE1229CF` / `Unable to locate package mssql-tools18`
>
> ```
> Err:2 https://packages.microsoft.com/ubuntu/24.04/prod noble InRelease
>   The following signatures couldn't be verified because the public key is not
>   available: NO_PUBKEY EB3E94ADBE1229CF
> E: The repository '...' is not signed.
> E: Unable to locate package mssql-tools18
> ```
>
> This happens if you registered the feed with `prod.list` and dropped the key into
> `/etc/apt/trusted.gpg.d/`. Microsoft's `prod.list` now pins its key:
>
> ```
> deb [arch=amd64,arm64,armhf signed-by=/usr/share/keyrings/microsoft-prod.gpg] ...
> ```
>
> Because of `signed-by=`, apt looks **only** at `/usr/share/keyrings/microsoft-prod.gpg`
> and ignores `trusted.gpg.d` entirely. That file doesn't exist, so the repository is
> unsigned, apt refuses it, and the package can't be found. It is not a certificate or
> proxy problem — the download itself worked.
>
> **Clean up and redo it:**
>
> ```bash
> # 1. Remove the half-configured feed
> sudo rm -f /etc/apt/sources.list.d/mssql-release.list /etc/apt/trusted.gpg.d/microsoft.asc
>
> # 2. Register it properly
> source /etc/os-release
> curl -fsSL "https://packages.microsoft.com/config/ubuntu/${VERSION_ID}/packages-microsoft-prod.deb" -o /tmp/ms-prod.deb
> sudo dpkg -i /tmp/ms-prod.deb
> sudo apt-get update
> sudo ACCEPT_EULA=Y apt-get install -y mssql-tools18 unixodbc-dev
> ```
>
> `apt-get update` must now show `Get:... packages.microsoft.com ...` with **no** `Err:` line.
>
> **If you must use `prod.list`** (for example your company mirrors that file), put the key
> where `signed-by=` points, in binary form:
>
> ```bash
> sudo mkdir -p /usr/share/keyrings
> curl -fsSL https://packages.microsoft.com/keys/microsoft.asc \
>   | sudo gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg
> sudo apt-get update
> ```
>
> `gpg --dearmor` matters: `signed-by` wants a binary keyring, not the armored `.asc` text.

**If `packages.microsoft.com` is blocked by the proxy**, install `sqlcmd` from its GitHub
release instead — one static binary, no apt feed:

```bash
curl -fsSL -o /tmp/sqlcmd.tar.bz2 \
  https://github.com/microsoft/go-sqlcmd/releases/latest/download/sqlcmd-linux-amd64.tar.bz2
sudo tar -xjf /tmp/sqlcmd.tar.bz2 -C /usr/local/bin sqlcmd
sqlcmd --version
```

This is the newer `go-sqlcmd`. Its flags differ slightly from `mssql-tools18` — notably it
uses `--trust-server-certificate` where the old one uses `-C`, though `-C` still works.

Connecting to a SQL Server that runs on **Windows**, not in WSL, is Step 10b.

---

## Step 8 — Playwright (browser automation)

The Playbook's `/verify` step drives a real browser to check UI work. Without this, it falls
back to reading code, which is much weaker evidence.

### 8a. Install the browser and its Linux dependencies

```bash
npx --yes playwright install --with-deps chromium
```

This downloads ~150 MB and installs about 20 system libraries. It takes a few minutes.

**Expect:** it finishes without error, and:

```bash
ls ~/.cache/ms-playwright
```

shows a `chromium-*` folder.

**If it fails:**

| What you see | What to do |
|---|---|
| `unable to verify the first certificate` / `SELF_SIGNED_CERT_IN_CHAIN` | `NODE_EXTRA_CA_CERTS` isn't set. Re-run Step 4c, then `source ~/.bashrc`. |
| The download host is blocked by the proxy | Ask IT to allow `cdn.playwright.dev` and `playwright.azureedge.net`. If they give you a mirror instead, `export PLAYWRIGHT_DOWNLOAD_HOST=<the-real-mirror-url>` before re-running. |
| `Host system is missing dependencies` | Re-run with `sudo`: `sudo npx --yes playwright install-deps chromium`. |
| `npm error code ENOTFOUND` … `request to https://<something>/playwright failed` | npm is pointed at a registry that doesn't resolve from WSL — usually the placeholder from Step 7a. Run `npm config get registry`; if it is anything other than your company's real mirror, `npm config delete registry` and retry. If it *is* the real mirror, check DNS with `nslookup <host>` — company mirrors often resolve only on the VPN. |

Sanity check that a browser actually launches (WSL has no screen, so headless only):

```bash
cd /tmp && npm init -y >/dev/null && npm install playwright >/dev/null
node -e "const{chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage();await p.goto('https://example.com');console.log('TITLE:',await p.title());await b.close();})()"
```

**Expect:** `TITLE: Example Domain`.

### 8b. Run the Playwright MCP server

This is what OpenCode connects to. It listens on port **8931** — the port the Playbook's
Verifier probes for.

```bash
npx --yes @playwright/mcp@latest --port 8931 --allowed-hosts "*"
```

Leave it running in its own terminal. To run it in the background instead:

```bash
sudo apt-get install -y tmux
tmux new -d -s playwright 'npx --yes @playwright/mcp@latest --port 8931 --allowed-hosts "*"'
```

Check it is up:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8931/mcp
```

**Expect:** `200`, `400`, `405`, `406` or `426`. Any of those means the server answered.
`000` means it isn't running.

### 8c. Tell OpenCode and the Playbook about it

In the project root `opencode.json`, enable the existing `mcp.playwright` entry. Keep its URL as
`{env:PLAYWRIGHT_MCP_URL}`:

```json
{
  "mcp": {
    "playwright": {
      "type": "remote",
      "url": "{env:PLAYWRIGHT_MCP_URL}",
      "enabled": true
    }
  }
}
```

And in `.playbook/environment-profile.yml`, set:

```yaml
browser:
  endpoint: "http://127.0.0.1:8931/mcp"
```

```bash
echo 'export PLAYWRIGHT_MCP_URL=http://127.0.0.1:8931/mcp' >> ~/.bashrc
source ~/.bashrc
```

> **Simpler alternative:** if you don't need the Playbook's Verifier probe, let OpenCode
> start the server itself and skip 8b entirely:
> ```json
> { "mcp": { "playwright": { "type": "local",
>     "command": ["npx", "-y", "@playwright/mcp@latest"], "enabled": true } } }
> ```
> Restart OpenCode after editing this file.

---

## Step 9 — Sign in to OpenCode

### 9a. Bring across settings from an existing setup

If you previously ran OpenCode on Windows (including the old Docker setup), copy your
credentials and settings in once. Some files may refuse to copy — that is expected and
handled below, so the copy is written to keep going rather than stop at the first one:

```bash
WIN_HOME=$(wslpath "$(cmd.exe /c 'echo %USERPROFILE%' 2>/dev/null | tr -d '\r')")
mkdir -p ~/.config/opencode ~/.local/share/opencode

cp -r --update=none "$WIN_HOME/.config/opencode/."      ~/.config/opencode/      2>/dev/null
cp -r --update=none "$WIN_HOME/.local/share/opencode/." ~/.local/share/opencode/ 2>/dev/null
chmod 600 ~/.local/share/opencode/auth.json 2>/dev/null

ls -l ~/.local/share/opencode/ ~/.config/opencode/
```

**Expect:** `auth.json` present and non-empty. That is the only file that has to make it
across — everything else OpenCode regenerates. Confirm it:

```bash
[ -s ~/.local/share/opencode/auth.json ] && echo "auth.json OK" || echo "auth.json MISSING"
```

After this, edit the **WSL copies only**. OpenCode in WSL does not read the Windows folders.

> ### `cp: warning: behavior of -n is non-portable`
>
> Harmless. Ubuntu 24.04 ships coreutils 9.4, which deprecated `cp -n` in favour of
> `--update=none`. The commands above already use the new form. (On anything older than
> coreutils 9.3, `--update=none` doesn't exist — use `cp -rn` and ignore the absence of
> the warning.)

> ### `cp: cannot open '.../opencode/account.json' for reading: Permission denied`
>
> The **Windows** file permissions on that file don't grant your account read access —
> typically left behind by the old Docker container, which wrote those files as `root`
> through a bind mount. It is not a WSL or Linux permissions problem, so `sudo` won't help.
>
> Pick one:
>
> **1. Ignore it (usually correct).** `account.json` is a cached profile blob; OpenCode
> rewrites it on next launch. If the check above said `auth.json OK`, you are done — move
> to Step 10.
>
> **2. Skip the copy and just log in again.** Fastest route if `auth.json` also failed:
> ```bash
> rm -rf ~/.local/share/opencode ~/.config/opencode
> mkdir -p ~/.local/share/opencode ~/.config/opencode
> opencode auth login          # Step 9b
> ```
>
> **3. Take ownership of the Windows folder, then re-copy.** Do this only if those files
> hold something you can't recreate. In **PowerShell (Admin)**:
> ```powershell
> takeown /f "$env:USERPROFILE\.local\share\opencode" /r /d y
> icacls  "$env:USERPROFILE\.local\share\opencode" /grant "$($env:USERNAME):(OI)(CI)F" /t
> takeown /f "$env:USERPROFILE\.config\opencode" /r /d y
> icacls  "$env:USERPROFILE\.config\opencode" /grant "$($env:USERNAME):(OI)(CI)F" /t
> ```
> Then re-run the `cp` block above. If `takeown` reports success but the copy still fails,
> the folder is on a path with inherited deny rules — use option 2.

### 9b. Or sign in fresh

```bash
opencode auth login
```

API keys are entered directly. When `opencode auth login` uses an Anthropic Claude Pro/Max
subscription, OpenCode prints a URL — open it in your Windows browser and paste the code back.

```bash
opencode auth list
opencode models | head
```

**Expect:** your provider listed, and models printed.

### 9c. Or paste the keys by hand

Two files, both inside WSL:

| File | What's in it | Path in Ubuntu | Same file from Windows Explorer |
|---|---|---|---|
| `auth.json` | API keys / tokens | `~/.local/share/opencode/auth.json` | `\\wsl.localhost\Ubuntu-24.04\home\<user>\.local\share\opencode\auth.json` |
| `opencode.json` | Providers, default models, MCP servers | `~/.config/opencode/opencode.json` | `\\wsl.localhost\Ubuntu-24.04\home\<user>\.config\opencode\opencode.json` |

Create them if they don't exist:

```bash
mkdir -p ~/.local/share/opencode ~/.config/opencode
[ -f ~/.local/share/opencode/auth.json ] || echo '{}' > ~/.local/share/opencode/auth.json
[ -f ~/.config/opencode/opencode.json ]  || echo '{ "$schema": "https://opencode.ai/config.json" }' > ~/.config/opencode/opencode.json
chmod 600 ~/.local/share/opencode/auth.json
```

Open them however you like:

```bash
notepad.exe "$(wslpath -w ~/.local/share/opencode/auth.json)"   # Notepad on Windows
code ~/.config/opencode/opencode.json                            # VS Code (WSL extension)
nano ~/.local/share/opencode/auth.json                           # in the terminal
```

`auth.json` — one entry per provider:

```json
{
  "anthropic": { "type": "api", "key": "sk-ant-..." },
  "openai":    { "type": "api", "key": "sk-..." }
}
```

Leave any `"type": "oauth"` entries alone — those are managed by `opencode auth login`.

`opencode.json` — default models, and any provider with a custom endpoint (your company's
internal LLM gateway, Azure OpenAI, Ollama):

```json
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
      "models": { "gpt-4.1": { "name": "GPT-4.1 (gateway)" } }
    }
  }
}
```

Check the file is valid JSON before restarting (a trailing comma is the usual mistake):

```bash
node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log("ok")' ~/.config/opencode/opencode.json
```

Keep credentials in these home-directory files. Put **model routing** in the project's own
`opencode.json` — then a repo can be shared without leaking keys. Never commit either file.

---

## Step 10 — The Windows bridge

WSL and Windows are two machines sharing one box. This step is how they reach each other.
Which parts you need depends on where your app and database run.

### 10a. Which way round is your setup?

| Situation | What to do |
|---|---|
| App and database both run **inside WSL** (`dotnet run`, `npm start` from the Ubuntu prompt) | Nothing to configure. Everything is `localhost`. Set `topology: same-host` in `environment-profile.yml`. **This is the recommended setup.** |
| App runs in WSL, **SQL Server / IIS runs on Windows** | Do 10b. |
| App must be **built or run on Windows** (.NET Framework, IIS, Windows services) | Do 10c. |
| You want to open a **WSL-hosted app in your Windows browser** | Do 10d. |

### 10b. Reaching a Windows service from inside WSL

Windows is not `localhost` from WSL's point of view (unless you turn on mirrored networking —
see the note below). It has its own address on a private network, and that address **changes
on every reboot**, so look it up rather than hard-coding it:

```bash
echo 'export WINHOST=$(ip route show default | awk "{print \$3}")' >> ~/.bashrc
source ~/.bashrc
echo $WINHOST          # something like 172.28.128.1
```

Test that you can reach a Windows service:

```bash
curl -sI http://$WINHOST:5000 | head -1                          # a web app on Windows
sqlcmd -S "$WINHOST,1433" -U sa -P "$SQLPASS" -C -Q "SELECT @@VERSION"   # SQL Server on Windows
```

`-C` means "trust the server certificate" — `sqlcmd` from `mssql-tools18` encrypts by default
and local SQL Server usually has a self-signed certificate.

**If the connection is refused or times out**, three things need to be true on the Windows
side:

1. **The service listens on all addresses, not just `127.0.0.1`.**
   For SQL Server: open **SQL Server Configuration Manager → SQL Server Network Configuration
   → Protocols → TCP/IP → Enabled = Yes**, and under **IP Addresses → IPAll** set
   **TCP Port = 1433**. Restart the SQL Server service.
   For a .NET app: run it with `--urls http://0.0.0.0:5000`.

2. **Windows Firewall allows the WSL network.** In **PowerShell (Admin)**:
   ```powershell
   New-NetFirewallRule -DisplayName "WSL inbound" -Direction Inbound `
     -InterfaceAlias "vEthernet (WSL)" -Action Allow
   ```
   Or narrow it to one port:
   ```powershell
   New-NetFirewallRule -DisplayName "WSL to SQL 1433" -Direction Inbound `
     -Protocol TCP -LocalPort 1433 -RemoteAddress 172.16.0.0/12 -Action Allow
   ```

3. **SQL Server allows the login type you're using.** Windows Authentication does not work
   from Linux without extra Kerberos setup — use SQL Authentication (a username and password)
   from WSL.

> **Windows 11 (22H2 and newer) only — the easy way:** turn on mirrored networking and
> Windows becomes plain `localhost` from WSL, with no gateway IP and no firewall rule.
> In PowerShell, create or edit `%USERPROFILE%\.wslconfig`:
> ```
> [wsl2]
> networkingMode=mirrored
> ```
> then `wsl --shutdown`. **Do not use this on Windows 10 or Windows Server 2022** — it is
> ignored there.

### 10c. Running Windows programs from inside WSL

Any Windows `.exe` can be called straight from the Ubuntu prompt. This is how you build a
.NET Framework solution, or anything else that must run on Windows, without leaving WSL:

```bash
# Windows tools, called from Linux
explorer.exe .                       # open the current folder in Windows Explorer
notepad.exe file.txt
powershell.exe -Command "Get-Service MSSQLSERVER"
cmd.exe /c "echo %USERPROFILE%"
```

Paths have to be translated, because Windows programs don't understand `/home/...`:

```bash
wslpath -w ~/work/MyApp        # /home/you/work/MyApp  ->  \\wsl.localhost\Ubuntu-24.04\home\you\work\MyApp
wslpath -u 'C:\Work\MyApp'     # C:\Work\MyApp          ->  /mnt/c/Work/MyApp
```

Building a .NET Framework solution that lives on the Windows drive:

```bash
MSBUILD="/mnt/c/Program Files/Microsoft Visual Studio/2022/Professional/MSBuild/Current/Bin/MSBuild.exe"
"$MSBUILD" "$(wslpath -w /mnt/c/Work/LegacyApp/LegacyApp.sln)" /p:Configuration=Debug
```

(Adjust `Professional` to `Enterprise`, `Community`, or `BuildTools` to match what's
installed. `ls "/mnt/c/Program Files/Microsoft Visual Studio/2022/"` will tell you.)

Two rules when you do this:

- **Keep the solution on `C:\`**, not in `~/work`. MSBuild over the `\\wsl.localhost\` network
  path is slow and occasionally flaky.
- Add the build command to `.playbook/environment-profile.yml` so the agent uses the same one
  you just tested.

### 10d. Opening a WSL app from your Windows browser

This works with no setup: run the app in WSL and open `http://localhost:<port>` in Edge or
Chrome on Windows. WSL forwards `localhost` automatically.

If it doesn't connect, the app is bound to `127.0.0.1` inside Linux only. Bind to all
interfaces instead:

```bash
dotnet run --urls http://0.0.0.0:5000
npm start -- --host 0.0.0.0
```

### 10e. Where to keep your files

**Put working repositories in `~/work` inside Ubuntu, not under `/mnt/c`.**

Working across the boundary makes every file operation several times slower — `git status`
on a large repo goes from instant to seconds — and files under `/mnt/c` can carry ownership
metadata that causes `EACCES` errors when the agent writes to them.

Access them from Windows when you need to (VS Code, Explorer, Notepad) via:

```
\\wsl.localhost\Ubuntu-24.04\home\<your-user>\work
```

The exception is 10c: code that must be built by Windows tooling stays on `C:\`.

---

## Step 11 — Set up a project

```bash
mkdir -p ~/work && cd ~/work
git clone <your-org-git-url>/MyWebApp
cd MyWebApp
```

Install the minimal hidden Playbook runtime without adding a project dependency:

```bash
npx @techierathore/ai-first-playbook@latest install
```

Fill in the hidden environment profile placeholders — this file tells the agent how to
build, run, test and verify your project:

```bash
nano .playbook/environment-profile.yml
```

Set at minimum: `project_type`, `topology`, the four `commands`, the `application` URLs, and
`browser.endpoint` if you did Step 8.

The installer creates only `.opencode/` and `.playbook/` plus managed `.gitignore` entries.
Optional guides are available under `.playbook/guides/` only with `--with-guides`.

---

## Step 12 — Daily use

```bash
wsl                    # from any Windows terminal
cd ~/work/MyWebApp
opencode; reset        # reset restores terminal input/mouse modes after the TUI exits
```

**From VS Code (recommended):** install the **WSL** extension, then
`Ctrl+Shift+P → WSL: Connect to WSL`, and open `~/work/MyWebApp`. Run `opencode; reset` in the
integrated terminal. The editor, Git and the agent all see the same Linux filesystem.

**Optional PowerShell shortcut** — add to `notepad $PROFILE`:

```powershell
function oc { wsl -d Ubuntu-24.04 -e bash -lc "cd ~/work && opencode $args; reset" }
```

### Add "Open Ubuntu here" to the Windows right-click menu

Saves navigating to a folder twice. Right-click any folder in File Explorer (or the empty
space inside one) and get an Ubuntu prompt already `cd`-ed there.

**PowerShell** (writes to your own user hive — no admin rights needed for this step):

```powershell
$distro = "Ubuntu-24.04"

# Resolve the REAL wsl.exe rather than trusting PATH — this is what prevents
# "error 2147942402 (0x80070002)" (see the box below).
$wsl = (Get-Command wsl.exe -ErrorAction SilentlyContinue).Source
if (-not $wsl) {
  $wsl = @("$env:SystemRoot\System32\wsl.exe", "$env:ProgramFiles\WSL\wsl.exe") |
         Where-Object { Test-Path $_ } | Select-Object -First 1
}
if (-not $wsl) { throw "wsl.exe not found — run 'wsl --update' first" }
"Using: $wsl"

$menus = @(
  @{ Name = "OpenUbuntuHere";   Label = "Open Ubuntu here";   Run = "" },
  @{ Name = "OpenOpenCodeHere"; Label = "Open OpenCode here"; Run = "opencode; reset; exec bash -l" }
)

foreach ($base in 'Directory\shell', 'Directory\Background\shell', 'Drive\shell') {
  foreach ($m in $menus) {
    $key = "HKCU:\Software\Classes\$base\$($m.Name)"
    New-Item -Path "$key\command" -Force | Out-Null
    Set-ItemProperty -Path $key -Name '(default)' -Value $m.Label
    Set-ItemProperty -Path $key -Name 'Icon' -Value "$wsl,0"

    $cmd = "`"$wsl`" -d $distro --cd `"%V`""
    if ($m.Run) { $cmd += " -e bash -lc `"$($m.Run)`"" }
    Set-ItemProperty -Path "$key\command" -Name '(default)' -Value $cmd
  }
}
"Done. Right-click a folder to try it."
```

Change `$distro` if `wsl --list --verbose` shows a different name. No restart or sign-out
needed — the entries appear immediately.

**Nothing about the folder is hardcoded.** `%V` is a shell-verb placeholder that File
Explorer replaces at click time with the folder you right-clicked — it is stored in the
registry literally, exactly as written. Read the entry back to confirm yours did:

```powershell
Get-ItemProperty "HKCU:\Software\Classes\Directory\shell\OpenUbuntuHere\command" |
  Select-Object -ExpandProperty '(default)'
```

**Expect** a literal `%V` at the end, e.g.
`"C:\Windows\System32\wsl.exe" -d Ubuntu-24.04 --cd "%V"`. If you see a real path there
instead, the value was written with `%V` already expanded — re-run the script, and make sure
you didn't substitute a folder into it by hand.

(`%V` is the folder itself, which is what you want here. `%1` would be the *selected item*,
which breaks on the right-click-empty-space case. The registry value must be `REG_SZ` — the
script's `Set-ItemProperty` does that; a `REG_EXPAND_SZ` would try to read `%V` as an
environment variable and come back empty.)

This calls `wsl.exe` directly and deliberately **does not route through Windows Terminal**.
That is the version that works on locked-down machines and on Server 2022, where Windows
Terminal isn't installed at all.

**Windows 11:** these land under **Show more options** (or press `Shift`+right-click). To
put them on the main menu, restore the classic context menu:

```powershell
reg add "HKCU\Software\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\InprocServer32" /f /ve
Stop-Process -Name explorer -Force        # Explorer restarts by itself
```

Undo that with `reg delete "HKCU\Software\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}" /f`
and another Explorer restart.

**To remove the menu entries:**

```powershell
foreach ($base in 'Directory\shell', 'Directory\Background\shell', 'Drive\shell') {
  foreach ($n in 'OpenUbuntuHere', 'OpenOpenCodeHere') {
    Remove-Item -Path "HKCU:\Software\Classes\$base\$n" -Recurse -Force -ErrorAction SilentlyContinue
  }
}
```

> ### ⚠️ `error 2147942402 (0x80070002) when launching \`wsl.exe -d Ubuntu-24.04 --cd ...\``
>
> `0x80070002` is `ERROR_FILE_NOT_FOUND`: the launcher could not find **`wsl.exe`**, not your
> folder. It happens when the menu entry says bare `wsl.exe` and relies on `PATH` — which
> fails if `System32` isn't on the PATH of the process doing the launching, or if WSL was
> installed as an app (`C:\Program Files\WSL\wsl.exe`) rather than the in-box copy.
>
> **Fix:** the script above resolves the real path with `Get-Command` and writes it into the
> registry in full. Re-run it. Check what it found first:
>
> ```powershell
> (Get-Command wsl.exe).Source
> Test-Path "$env:SystemRoot\System32\wsl.exe"
> Test-Path "$env:ProgramFiles\WSL\wsl.exe"
> ```
>
> Then confirm the command itself works before blaming the menu:
>
> ```powershell
> cd C:\        # or any folder you want to test with
> & (Get-Command wsl.exe).Source -d Ubuntu-24.04 --cd "$PWD" -e pwd
> ```
> **Expect:** the Linux form of wherever you are, e.g. `/mnt/c`. If *that* fails, the problem
> is WSL or the distro name, not the context menu.

> ### ⚠️ Two windows open, the second one erroring on `exec bash`
>
> Only happens if you route the entry through `wt.exe`. Windows Terminal treats `;` as its
> own **tab separator**, so a command such as `-lc "opencode; reset; exec bash -l"` becomes
> *"run opencode"*, *"run reset"*, and *"run exec bash -l"* in separate tabs, and the latter
> tabs fail because those fragments are no longer running inside the intended WSL shell.
>
> The script above avoids this by not using `wt.exe`. If you do want Windows Terminal, escape
> the semicolon for it as `\;`, and use the **profile** form for the plain entry rather than
> a `--` commandline:
>
> ```powershell
> # Plain Ubuntu prompt — lets Windows Terminal use its own registered profile
> wt.exe -p "Ubuntu-24.04" -d "%V"
>
> # With a command — note the escaped \; and the full path to wsl.exe
> wt.exe -d "%V" -- "C:\Windows\System32\wsl.exe" -d Ubuntu-24.04 --cd "%V" -e bash -lc "opencode\; reset\; exec bash -l"
> ```
>
> The profile name after `-p` must match Windows Terminal's profile exactly — check
> **Settings → dropdown**, it is sometimes `Ubuntu-24.04` and sometimes just `Ubuntu`.

> ### If your IT policy forces terminals to run as Administrator
>
> You will get a UAC prompt each time — that is the policy working, not a fault. Two things
> to know:
>
> - **An elevated shell has a different environment.** `$HOME` may resolve to a different
>   Windows profile, and `%V` still points at the folder you clicked, so the menu keeps
>   working — but a cancelled UAC prompt surfaces as error `1223` (`ERROR_CANCELLED`), which
>   is *not* the same as `0x80070002` above.
> - **Elevation is not required for OpenCode itself.** If the prompt becomes tiresome, skip
>   the context menu and work from an already-open Ubuntu session (`wsl`, then
>   `cd /mnt/c/YourFolder`) — one elevation per session instead of one per folder. Better
>   still, keep repos in `~/work` (Step 10e) and never leave WSL.

| Problem | Fix |
|---|---|
| `error 2147942402 (0x80070002)` | `wsl.exe` not found by path — re-run the script above, which embeds the resolved full path |
| Two windows, one failing on `exec bash` | Windows Terminal split on `;` — use the direct `wsl.exe` form, or escape it as `\;` |
| Random numbers or escape text appear after OpenCode exits | The TUI left terminal mouse/input reporting enabled. Launch with `opencode; reset`; the context-menu command above already does this before opening the login shell. |
| Menu item does nothing, or a window flashes and closes | Wrong distro name. Check `wsl --list --verbose` and set `$distro` to match exactly. |
| `error 1223` | You clicked No on the UAC prompt |
| Opens in `/home/<you>` instead of the folder you clicked | Older WSL build without `--cd` — run `wsl --update` in an admin PowerShell |
| Item is missing on Windows 11 | It is under **Show more options** — `Shift`+right-click, or apply the classic-menu tweak above |
| Everything is slow once it opens | You are in `/mnt/c`. This menu is for browsing and quick looks; keep real work in `~/work` (Step 10e). |

> Use this for convenience, not as your main workflow. A folder opened this way sits under
> `/mnt/c`, where file access is several times slower and the agent can hit `EACCES` on
> Windows-owned files. The "Open OpenCode here" entry is genuinely useful on a legacy
> solution that has to stay on `C:\` (Step 10c) — for everything else, work in `~/work`.

The reverse direction also works, from Ubuntu:

```bash
explorer.exe .          # open the current WSL folder in File Explorer
```

**Long unattended runs:** WSL shuts down when the last terminal closes. Prevent that, and
survive a closed terminal, with `.wslconfig` plus `tmux`:

Create or edit `%USERPROFILE%\.wslconfig` on the Windows side:

```
[wsl2]
vmIdleTimeout=-1
memory=12GB
processors=4
```

Size `memory` at roughly 75% of the machine's RAM and leave the rest to Windows — on a
16 GB laptop use `12GB` / `processors=4`; on a 32 GB VM (for example `Standard_D8ads_v6`)
use `memory=24GB` / `processors=6`. Run `wsl --shutdown` after editing; the file is only
read when WSL next starts.

```bash
tmux new -s build       # detach with Ctrl+b then d
tmux attach -t build    # come back later
```

---

## Step 13 — Optional: the one-command version

Once you have done Step 4 by hand at least once and understand what it does, a full framework
source checkout has a script that performs steps 4, 5, 6 and 7 together. It is useful for setting
up a second machine or a teammate's.

```bash
git clone <repository-url> ~/work/AI-First-Playbook
cd ~/work/AI-First-Playbook
sudo -v
bash <(tr -d '\r' < scripts/provision-wsl.sh) --certs=/mnt/c/temp/corp-ca
```

Add `--proxy=http://proxy.corp.local:8080` if Step 5 applied to you, and
`--dotnet=10.0` to pick a .NET version (default `8.0`). Trim with `--no-dotnet`,
`--no-sql`, `--no-playwright`. It is safe to re-run — it skips anything
already installed, which makes it the fastest way to reinstall certificates after a CA
rotation.

The `tr -d '\r'` part strips Windows line endings from the script; without it you get
`bash: $'\r': command not found`.

---

## Step 14 — Final check

Run all of this from a project with the harness installed. Everything must pass before you
start real work.

```bash
# 1. Tools are present
command -v opencode node npm dotnet sqlcmd && opencode --version

# 2. Certificates work
curl -sI https://api.anthropic.com | head -1
curl -sI https://registry.npmjs.org | head -1
dotnet nuget list source >/dev/null && echo "dotnet ok"

# 3. Local traffic is not going through the proxy
env | grep -i no_proxy        # must include localhost,127.0.0.1 — if you set a proxy at all

# 4. Playwright is up
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8931/mcp

# 5. A model answers
opencode run "reply with the single word OK"

# 6. The installed harness is intact
test -f .opencode/command/verify.md
test -f .opencode/plugin/spec-guardrails.ts
test -f .playbook/environment-profile.yml
```

Then one manual test: plant an obvious bug, run `/verify`, and confirm the Verifier marks it
`FAIL` **inline in the checklist**. If it writes a separate report file instead, the plugin
isn't loading — check `.opencode/plugin/` exists and rerun the Step 11 installer.

---

## Troubleshooting

| What you see | Why | Fix |
|---|---|---|
| `curl: (60) SSL certificate problem: unable to get local issuer certificate` | Corporate CA not in Ubuntu's trust store | **Step 4** |
| `SELF_SIGNED_CERT_IN_CHAIN` / `UNABLE_TO_VERIFY_LEAF_SIGNATURE` from npm or Node | Same cause, Node's own store | Step 4c, then `source ~/.bashrc` |
| `The SSL connection could not be established` from `dotnet restore` | Same cause | Step 4b, then retry |
| `apt-get update` fails on `Certificate verification failed` | Same cause | Step 4b |
| `apt-get update`: `NO_PUBKEY EB3E94ADBE1229CF`, then `Unable to locate package mssql-tools18` | Microsoft's `prod.list` pins `signed-by=/usr/share/keyrings/microsoft-prod.gpg`; a key in `trusted.gpg.d` is ignored | Step 7c warning box — use `packages-microsoft-prod.deb`, or `gpg --dearmor` the key to that exact path |
| OpenCode starts, then spins forever | Local traffic is being sent to the proxy | Add `NO_PROXY=localhost,127.0.0.1,::1` (Step 5) |
| Random numbers or escape text appear after OpenCode exits | The TUI's terminal input/mouse mode was not restored | Run `reset`; launch it as `opencode; reset` thereafter (Step 12) |
| `bash: $'\r': command not found` | Script saved with Windows line endings | `bash <(tr -d '\r' < script.sh)`, or `git config --global core.autocrlf false` and re-clone |
| `opencode: command not found` | `~/.opencode/bin` not on `PATH` | Step 6 |
| `Temporary failure in name resolution` | The VPN changed DNS after WSL started | `wsl --shutdown` in PowerShell, then reopen. If it keeps happening: add `[network]` / `generateResolvConf=false` to `/etc/wsl.conf` and put your company DNS in `/etc/resolv.conf` |
| `wsl` opens `docker-desktop` or a root shell | Wrong default distro | `wsl --set-default Ubuntu-24.04` |
| Can't reach SQL Server / an app running on Windows | WSL is on a different network | Step 10b |
| Windows browser can't open a WSL app | App bound to `127.0.0.1` only | Step 10d |
| Everything is slow; `git status` takes seconds | Repo is under `/mnt/c` | Move it to `~/work` (Step 10e) |
| `EACCES` when the agent writes files | Stale ownership metadata on `/mnt/c` | Clone fresh into `~/work` |
| `cp: cannot open '/mnt/c/Users/<you>/...' for reading: Permission denied` | Windows ACL on the file denies your account — usually written as `root` by the old Docker bind mount | Step 9a — ignore it if `auth.json` copied, otherwise `takeown` + `icacls`, or just re-run `opencode auth login` |
| `cp: warning: behavior of -n is non-portable` | coreutils 9.3+ deprecated `cp -n` | Cosmetic; use `cp -r --update=none` |
| Playwright: `Host system is missing dependencies` | Linux libraries missing | `sudo npx --yes playwright install-deps chromium` |
| Any `npm`/`npx` command: `ENOTFOUND npm.<something>` | npm registry set to a host that doesn't exist or isn't reachable from WSL | `npm config delete registry` to return to the default, or `nslookup` the host if it is your real mirror |
| Playwright: browser download blocked | Proxy blocks the CDN | `PLAYWRIGHT_DOWNLOAD_HOST=<mirror>`, or ask IT to allow `cdn.playwright.dev` |
| Build fails with "Framework not supported" on a `net48` project | .NET Framework can't run on Linux | Step 7b warning box, then Step 10c |
| WSL died overnight | Terminal closed, or you signed out of Windows | `vmIdleTimeout=-1` and `tmux` (Step 12) |
| OpenCode updated itself and something changed | Auto-update is on by design | Re-run Step 14 items 5–6 |

---

## Appendix A — Azure Windows Server 2022 VMs

Everything above applies, with these differences:

| | Difference |
|---|---|
| **VM size** | WSL 2 runs as a lightweight VM, so the Azure VM must expose nested virtualization. Supported on v3 generation and newer: `Dsv3`/`Dsv4`/`Dsv5`, `Dasv5`/`Dadsv5`, `Dadsv6`/`Dalsv6`, `Esv5`. **Not** on `Av2`, `Dv2`, or the original `B`-series. **`Standard_D8ads_v6` (8 vCPU / 32 GB) is supported and is a comfortable size** — 4 vCPU / 16 GB is the practical minimum. Confirm on the VM itself: `(Get-ComputerInfo).HyperVRequirementVirtualizationFirmwareEnabled` → `True`. `False` means resize in the Azure portal (VM → Size; needs a reboot, no data lost). |
| **Microsoft Store** | Not present at all. `--web-download` in Step 2 is mandatory. |
| **Mirrored networking** | Not available on Server 2022. Use the gateway IP method in Step 10b. |
| **Windows Terminal** | Not installed. The plain `wsl` console works, or install it from its GitHub releases (`.msixbundle`, `Add-AppxPackage`). |
| **Browser for OAuth** | There isn't one. Copy the login URL from the VM to a browser on your laptop and paste the code back (Step 9b). |
| **Sessions** | **Disconnecting** RDP keeps WSL running. **Signing out** kills it. Always use `tmux` (Step 12), and check Group Policy for RDP session time limits (Remote Desktop Session Host → Session Time Limits). |
| **Proxy** | Depends on your VNet egress. Run Step 3 to find out — many Azure VMs have no interception and can skip Step 4 entirely. |

---

## Appendix B — What changed from the Docker setup

The former Docker-based workstation approach is superseded. Keep containerized setup only for CI
images that explicitly require it.

| Docker setup | This setup |
|---|---|
| Docker Desktop required (licensing; won't start on Windows Server) | No Docker |
| Certificates baked into the image; rebuild on every rotation | Certificates in the OS store; re-run Step 4 on rotation |
| `opencode-docker` PowerShell function | `wsl` → `cd ~/work/<repo>` → `opencode` |
| Repo on `C:\`, mounted into `/app` | Repo in `~/work` inside Ubuntu |
| `host.docker.internal` for Windows services | Gateway IP, or `localhost` with mirrored networking (Step 10b) |
| Auth in Windows `%USERPROFILE%`, mounted in | Auth in the WSL home directory (Step 9) |
| Alpine plus `--allow-untrusted` workarounds | Stock Ubuntu 24.04, nothing untrusted |

The steps above are the supported workstation and Windows Server setup.
