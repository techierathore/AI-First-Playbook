#!/usr/bin/env bash
# provision-wsl.sh — provision a WSL Ubuntu environment for the AI-First
# Playbook + OpenCode, including corporate SSL certificates and proxy setup.
# Scripted form of docs/OpenCode-Guide.md §3–§4; idempotent — safe to re-run,
# including after a corporate CA rotation.
#
# Usage (inside WSL Ubuntu):
#   sudo -v && bash scripts/provision-wsl.sh [--certs=/mnt/c/temp/corp-ca] \
#        [--proxy=http://proxy.corp.local:8080] [--no-dotnet] [--no-sql] [--no-playwright]
#
# Export the corporate CA chain from Windows FIRST if your proxy intercepts
# TLS (PowerShell — adjust the Subject filter):
#   $out="C:\temp\corp-ca"; New-Item -ItemType Directory -Force $out | Out-Null
#   Get-ChildItem Cert:\LocalMachine\Root, Cert:\CurrentUser\Root |
#     Where-Object { $_.Subject -match "YourCorp|Zscaler" } |
#     ForEach-Object { Export-Certificate -Cert $_ -FilePath (Join-Path $out ("{0}.cer" -f $_.Thumbprint)) -Type CERT | Out-Null }
set -euo pipefail

CERT_DIR=""
PROXY=""
WITH_DOTNET=1
WITH_SQL=1
WITH_PLAYWRIGHT=1
for arg in "$@"; do
  case "$arg" in
    --certs=*) CERT_DIR="${arg#--certs=}" ;;
    --proxy=*) PROXY="${arg#--proxy=}" ;;
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
  sudo apt-get update -qq && sudo apt-get install -y -qq openssl ca-certificates
  found=0
  for f in "$CERT_DIR"/*.cer "$CERT_DIR"/*.crt "$CERT_DIR"/*.pem; do
    [ -e "$f" ] || continue
    found=1
    base="$(basename "${f%.*}")"
    # DER → PEM; fall back to a straight copy when the file is already PEM
    sudo openssl x509 -inform der -in "$f" -out "/usr/local/share/ca-certificates/corp-$base.crt" 2>/dev/null \
      || sudo cp "$f" "/usr/local/share/ca-certificates/corp-$base.crt"
  done
  [ "$found" = 1 ] || { echo "no .cer/.crt/.pem files in $CERT_DIR" >&2; exit 1; }
  sudo update-ca-certificates
  # Belt and braces for runtimes with their own stores. OpenCode's binary is
  # built with --use-system-ca so the system store alone suffices for it;
  # NODE_EXTRA_CA_CERTS covers node tooling and is OpenCode's documented knob.
  if ! grep -q NODE_EXTRA_CA_CERTS ~/.bashrc 2>/dev/null; then
    echo 'export NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt' >> ~/.bashrc
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
  say "Installing .NET SDK 8"
  sudo apt-get install -y -qq dotnet-sdk-8.0
fi

if [ "$WITH_SQL" = 1 ] && ! command -v sqlcmd >/dev/null 2>&1 && [ ! -x /opt/mssql-tools18/bin/sqlcmd ]; then
  say "Installing sqlcmd (mssql-tools18)"
  curl -sSL https://packages.microsoft.com/keys/microsoft.asc | sudo tee /etc/apt/trusted.gpg.d/microsoft.asc >/dev/null
  . /etc/os-release
  curl -sSL "https://packages.microsoft.com/config/ubuntu/${VERSION_ID}/prod.list" | sudo tee /etc/apt/sources.list.d/mssql-release.list >/dev/null
  sudo apt-get update -qq && sudo ACCEPT_EULA=Y apt-get install -y -qq mssql-tools18 unixodbc-dev
  grep -q mssql-tools18 ~/.bashrc 2>/dev/null || echo 'export PATH="$PATH:/opt/mssql-tools18/bin"' >> ~/.bashrc
fi

if [ "$WITH_PLAYWRIGHT" = 1 ]; then
  say "Installing Playwright browser dependencies"
  sudo npx --yes playwright install-deps >/dev/null
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
echo
echo "Topology reminders (docs/OpenCode-Guide.md §6):"
echo "  - Keep working repos in the WSL filesystem (~/work), not /mnt/c — I/O is far faster"
echo "    and /mnt/c can carry stale Linux-owner metadata from old root/container runs."
echo "  - Windows 11: enable [wsl2] networkingMode=mirrored in %UserProfile%\\.wslconfig"
echo "    so localhost works in both directions; then topology: same-host in the profile."
echo "  - No version pinning: leave OpenCode autoupdate on (docs/OpenCode-Guide.md §8)."
echo "    Lockdown flags (OPENCODE_DISABLE_AUTOUPDATE=1, OPENCODE_DISABLE_MODELS_FETCH=1)"
echo "    exist only for change-controlled environments that freeze all tooling."
