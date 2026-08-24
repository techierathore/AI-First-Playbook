#!/usr/bin/env bash
# provision-wsl.sh — provision a WSL Ubuntu environment for the AI-First
# Playbook + OpenCode, including corporate SSL certificates and proxy setup.
# Scripted form of docs/OpenCode-Guide.md §3–§4; idempotent — safe to re-run,
# including after a corporate CA rotation.
#
# Usage (inside WSL Ubuntu):
#   sudo -v && bash scripts/provision-wsl.sh [--certs=/mnt/c/temp/corp-ca] \
#        [--proxy=http://proxy.corp.local:8080] [--dotnet=10.0] \
#        [--no-dotnet] [--no-sql] [--no-playwright]
#
# Export the corporate CA chain from Windows FIRST if your proxy intercepts
# TLS (PowerShell — adjust the Subject filter):
#   $out="C:\temp\corp-ca"; New-Item -ItemType Directory -Force $out | Out-Null
#   Get-ChildItem Cert:\LocalMachine\Root, Cert:\LocalMachine\CA, Cert:\CurrentUser\Root |
#     Sort-Object Thumbprint -Unique | ForEach-Object {
#       $b64 = [Convert]::ToBase64String($_.RawData, 'InsertLineBreaks')
#       Set-Content "$out\corp-$($_.Thumbprint).crt" `
#         "-----BEGIN CERTIFICATE-----`r`n$b64`r`n-----END CERTIFICATE-----" -Encoding Ascii }
#   Export everything (no Subject filter): public CAs are harmless duplicates, and
#   LocalMachine\CA holds the *intermediate* that interception products install.
set -euo pipefail

CERT_DIR=""
PROXY=""
DOTNET_CHANNEL="8.0"
WITH_DOTNET=1
WITH_SQL=1
WITH_PLAYWRIGHT=1
for arg in "$@"; do
  case "$arg" in
    --certs=*) CERT_DIR="${arg#--certs=}" ;;
    --proxy=*) PROXY="${arg#--proxy=}" ;;
    --dotnet=*) DOTNET_CHANNEL="${arg#--dotnet=}" ;;
    --no-dotnet) WITH_DOTNET=0 ;;
    --no-sql) WITH_SQL=0 ;;
    --no-playwright) WITH_PLAYWRIGHT=0 ;;
    *) echo "unknown option: $arg" >&2; exit 1 ;;
  esac
done

say() { printf '\n== %s\n' "$*"; }

# ── 1. Corporate certificates first — downloads below fail without them ─────
if [ -n "$CERT_DIR" ]; then
  say "Installing corporate CA certificates from $CERT_DIR"
  # No apt/network here on purpose: behind TLS inspection every download fails
  # until the store is fixed, so this step must work with what Ubuntu ships
  # (ca-certificates and openssl are both in the base WSL image).
  sudo mkdir -p /usr/local/share/ca-certificates
  found=0
  for f in "$CERT_DIR"/*.cer "$CERT_DIR"/*.crt "$CERT_DIR"/*.pem; do
    [ -e "$f" ] || continue
    found=1
    base="$(basename "${f%.*}")"
    dest="/usr/local/share/ca-certificates/corp-$base.crt"
    # Already PEM (Base-64)? copy it. Otherwise convert DER → PEM.
    if grep -q "BEGIN CERTIFICATE" "$f" 2>/dev/null; then
      sudo cp "$f" "$dest"
    else
      sudo openssl x509 -inform der -in "$f" -out "$dest" 2>/dev/null || {
        echo "skipping unreadable certificate: $f" >&2; sudo rm -f "$dest"; continue; }
    fi
  done
  [ "$found" = 1 ] || { echo "no .cer/.crt/.pem files in $CERT_DIR" >&2; exit 1; }
  # Certificates exported from Windows carry CRLF line endings
  sudo sed -i 's/\r$//' /usr/local/share/ca-certificates/*.crt
  sudo update-ca-certificates
  # Belt and braces for runtimes with their own stores. OpenCode's binary is
  # built with --use-system-ca so the system store alone suffices for it;
  # NODE_EXTRA_CA_CERTS covers node tooling and is OpenCode's documented knob.
  if ! grep -q NODE_EXTRA_CA_CERTS ~/.bashrc 2>/dev/null; then
    {
      echo 'export NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt'
      echo 'export SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt'
      echo 'export REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt'
    } >> ~/.bashrc
  fi
  export NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt
  # Fail early and loudly rather than 20 lines later inside apt or curl
  if ! curl -sI https://opencode.ai >/dev/null 2>&1; then
    echo "TLS still failing after installing certificates from $CERT_DIR." >&2
    echo "Check the issuer with:" >&2
    echo "  openssl s_client -connect opencode.ai:443 </dev/null 2>/dev/null | openssl x509 -noout -issuer" >&2
    echo "then export that CA from Windows (certlm.msc) and re-run." >&2
    exit 1
  fi
fi

# ── 2. Proxy ────────────────────────────────────────────────────────────────
if [ -n "$PROXY" ]; then
  say "Configuring proxy $PROXY (NO_PROXY loopback is REQUIRED — the OpenCode TUI talks to a local server)"
  if ! grep -q "AI-First Playbook proxy" ~/.bashrc 2>/dev/null; then
    {
      echo "# AI-First Playbook proxy"
      echo "export HTTPS_PROXY=$PROXY"
      echo "export HTTP_PROXY=$PROXY"
      echo "export NO_PROXY=localhost,127.0.0.1,::1"
    } >> ~/.bashrc
  fi
  export HTTPS_PROXY="$PROXY" HTTP_PROXY="$PROXY" NO_PROXY=localhost,127.0.0.1,::1
fi

# ── 3. Base tooling ─────────────────────────────────────────────────────────
say "Installing base packages"
sudo apt-get update -qq
sudo apt-get install -y -qq curl git unzip ca-certificates

if ! command -v node >/dev/null 2>&1; then
  say "Installing Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y -qq nodejs
fi

if [ "$WITH_DOTNET" = 1 ] && ! command -v dotnet >/dev/null 2>&1; then
  say "Installing .NET SDK $DOTNET_CHANNEL"
  # 1) Ubuntu's own feed (8.0/9.0 on 24.04). 2) Microsoft's feed. 3) dotnet-install.sh.
  if ! sudo apt-get install -y -qq "dotnet-sdk-$DOTNET_CHANNEL" 2>/dev/null; then
    . /etc/os-release
    curl -fsSL "https://packages.microsoft.com/config/ubuntu/${VERSION_ID}/packages-microsoft-prod.deb" -o /tmp/ms-prod.deb \
      && sudo dpkg -i /tmp/ms-prod.deb >/dev/null && sudo apt-get update -qq
    if ! sudo apt-get install -y -qq "dotnet-sdk-$DOTNET_CHANNEL" 2>/dev/null; then
      say "Falling back to dotnet-install.sh for channel $DOTNET_CHANNEL"
      curl -fsSL https://dot.net/v1/dotnet-install.sh -o /tmp/dotnet-install.sh
      bash /tmp/dotnet-install.sh --channel "$DOTNET_CHANNEL" --install-dir "$HOME/.dotnet"
      grep -q 'DOTNET_ROOT' ~/.bashrc 2>/dev/null || {
        echo 'export DOTNET_ROOT="$HOME/.dotnet"' >> ~/.bashrc
        echo 'export PATH="$HOME/.dotnet:$PATH"' >> ~/.bashrc
      }
      export DOTNET_ROOT="$HOME/.dotnet" PATH="$HOME/.dotnet:$PATH"
    fi
  fi
  # .NET Framework 4.x is Windows-only and cannot be built here — call MSBuild.exe
  # across the WSL/Windows boundary instead (docs/OpenCode-WSL-Setup-Guide.md §10c).
fi

if [ "$WITH_SQL" = 1 ] && ! command -v sqlcmd >/dev/null 2>&1 && [ ! -x /opt/mssql-tools18/bin/sqlcmd ]; then
  say "Installing sqlcmd (mssql-tools18)"
  . /etc/os-release
  # Register the feed with Microsoft's own .deb: it ships the signing key at the exact
  # path its sources file pins with signed-by=/usr/share/keyrings/microsoft-prod.gpg.
  # Dropping the key in /etc/apt/trusted.gpg.d instead yields NO_PUBKEY EB3E94ADBE1229CF,
  # because signed-by makes apt ignore trusted.gpg.d entirely.
  sudo rm -f /etc/apt/sources.list.d/mssql-release.list /etc/apt/trusted.gpg.d/microsoft.asc
  if curl -fsSL "https://packages.microsoft.com/config/ubuntu/${VERSION_ID}/packages-microsoft-prod.deb" -o /tmp/ms-prod.deb; then
    sudo dpkg -i /tmp/ms-prod.deb >/dev/null
  fi
  sudo apt-get update -qq
  if ! sudo ACCEPT_EULA=Y apt-get install -y -qq mssql-tools18 unixodbc-dev; then
    say "apt feed unavailable — installing go-sqlcmd from its GitHub release instead"
    curl -fsSL -o /tmp/sqlcmd.tar.bz2 \
      https://github.com/microsoft/go-sqlcmd/releases/latest/download/sqlcmd-linux-amd64.tar.bz2 \
      && sudo tar -xjf /tmp/sqlcmd.tar.bz2 -C /usr/local/bin sqlcmd
  fi
  grep -q mssql-tools18 ~/.bashrc 2>/dev/null || echo 'export PATH="$PATH:/opt/mssql-tools18/bin"' >> ~/.bashrc
fi

if [ "$WITH_PLAYWRIGHT" = 1 ]; then
  say "Installing Playwright system dependencies and the Chromium browser"
  sudo npx --yes playwright install-deps chromium >/dev/null
  npx --yes playwright install chromium
  # The Playbook Verifier probes a Playwright MCP server on this port; start it with
  #   npx @playwright/mcp@latest --port 8931 --allowed-hosts "*"
  grep -q PLAYWRIGHT_MCP_URL ~/.bashrc 2>/dev/null || \
    echo 'export PLAYWRIGHT_MCP_URL=http://127.0.0.1:8931' >> ~/.bashrc
fi

# ── 4. OpenCode ─────────────────────────────────────────────────────────────
if ! command -v opencode >/dev/null 2>&1 && [ ! -x "$HOME/.opencode/bin/opencode" ]; then
  say "Installing OpenCode"
  # Behind a proxy where the script host is blocked but npm is mirrored,
  # use instead:  npm install -g opencode-ai   (honors .npmrc registry/cafile/proxy)
  curl -fsSL https://opencode.ai/install | bash
fi

say "Done. Open a new shell (or 'source ~/.bashrc'), then verify:"
echo "  command -v opencode dotnet node npm sqlcmd"
echo "  curl -sI https://api.anthropic.com | head -1   # proves the CA chain works"
echo "  npx --yes @playwright/mcp@latest --port 8931 --allowed-hosts '*'  # then:"
echo "  curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8931/mcp"
echo
echo "Topology reminders (docs/OpenCode-Guide.md §6):"
echo "  - Keep working repos in the WSL filesystem (~/work), not /mnt/c — I/O is far faster"
echo "    and /mnt/c can carry stale Linux-owner metadata from old root/container runs."
echo "  - Windows 11: enable [wsl2] networkingMode=mirrored in %UserProfile%\\.wslconfig"
echo "    so localhost works in both directions; then topology: same-host in the profile."
echo "  - No version pinning: leave OpenCode autoupdate on (docs/OpenCode-Guide.md §8)."
echo "    Lockdown flags (OPENCODE_DISABLE_AUTOUPDATE=1, OPENCODE_DISABLE_MODELS_FETCH=1)"
echo "    exist only for change-controlled environments that freeze all tooling."
