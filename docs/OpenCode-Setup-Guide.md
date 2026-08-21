
# OpenCode (SST) + .NET 10 + Playwright MCP Setup Guide
**For Windows Users (Corporate Environment Friendly)**

This guide sets up a crash-free Linux environment for OpenCode using Docker. It solves:
1.  **"Integer Panic" crash** (by running on Linux/Alpine).
2.  **"SSL Certificate" errors** (by injecting corporate trust certificates).
3.  **Project-Specific Playwright Integration** (using project-level config).

***

### Phase 1: One-Time Configuration
*Do this once on your machine.*

**1. Create Configuration Folder**
Open PowerShell and run:
```powershell
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.opencode-docker-config" | Out-Null
cd "$env:USERPROFILE\.opencode-docker-config"
```

**2. Export Windows Corporate Certificates**
Run this script to export your trusted corporate certificates.
*(Paste the whole block into PowerShell)*
```powershell
echo "Exporting Windows Root Certificates..."
$certPath = "$env:USERPROFILE\.opencode-docker-config\corporate-certs.crt"
$rootCerts = Get-ChildItem Cert:\LocalMachine\Root
$content = ""
foreach ($cert in $rootCerts) {
    try {
        $base64 = [System.Convert]::ToBase64String($cert.RawData, 'InsertLineBreaks')
        $content += "-----BEGIN CERTIFICATE-----`n$base64`n-----END CERTIFICATE-----`n"
    } catch {}
}
Set-Content -Path $certPath -Value $content -Encoding Ascii
echo "Success! Certificates saved to corporate-certs.crt"
```

**3. Create the Dockerfile**
Create a file named `Dockerfile` (no extension) in that same folder (`%USERPROFILE%\.opencode-docker-config\`).
Paste this content:

```dockerfile
# Start with the official OpenCode image (Alpine-based)
FROM ghcr.io/sst/opencode:latest

USER root

# 1. OS Fixes (Alpine Proxy Bypass)
# Switch to HTTP temporarily to avoid initial SSL handshake issues
RUN sed -i 's/https/http/g' /etc/apk/repositories
RUN apk update --allow-untrusted && \
    apk add --no-cache --allow-untrusted \
    bash icu-libs krb5-libs libgcc libintl libssl3 libstdc++ zlib curl git openssh ca-certificates nodejs npm

# =========================================================
# 2. INJECT WINDOWS CERTIFICATES (The Real SSL Fix)
# =========================================================
COPY corporate-certs.crt /usr/local/share/ca-certificates/corporate-certs.crt
RUN sed -i 's/\r$//' /usr/local/share/ca-certificates/corporate-certs.crt && \
    update-ca-certificates

# 3. Install .NET SDKs (8, 9, 10)
# We use -k (insecure) for the install script download only
RUN curl -k -sSL https://dot.net/v1/dotnet-install.sh | bash /dev/stdin --channel 8.0 --install-dir /usr/share/dotnet && \
    curl -k -sSL https://dot.net/v1/dotnet-install.sh | bash /dev/stdin --channel 9.0 --install-dir /usr/share/dotnet && \
    curl -k -sSL https://dot.net/v1/dotnet-install.sh | bash /dev/stdin --channel 10.0 --install-dir /usr/share/dotnet

ENV DOTNET_ROOT=/usr/share/dotnet
ENV PATH=$PATH:$DOTNET_ROOT

# 4. Install Playwright MCP Server globally (but enabled per-project)
RUN npm install -g @playwright/mcp

# 5. Environment Variables for Stability
ENV DOTNET_NOLOGO=1
ENV DOTNET_CLI_TELEMETRY_OPTOUT=1
# Force .NET to use the system certificates we just updated
ENV DOTNET_SYSTEM_NET_HTTP_USESOCKETSHTTPHANDLER=1
```

**4. Build the Image**
Run this command in PowerShell (inside the config folder):
```powershell
docker build -t my-opencode-dotnet .
```

***

### Phase 2: Create the Shortcut Command
This adds the `opencode-docker` command to your terminal.

1.  Open your PowerShell profile:
    ```powershell
    notepad $PROFILE
    ```
2.  Paste this function at the end:

```powershell
function opencode-docker {
    <#
    .SYNOPSIS
    Runs OpenCode (Linux) in Docker with .NET 10 + Playwright + SSL Fix.
    Uses Host Networking for simplicity.
    #>
    
    # Define Host Paths (Windows)
    $HostAuthPath   = "$env:USERPROFILE\.local\share\opencode"
    $HostConfigPath = "$env:USERPROFILE\.config\opencode"

    # Define Container Paths (Linux)
    $ContainerAuthPath   = "/root/.local/share/opencode"
    $ContainerConfigPath = "/root/.config/opencode"

    # Create folders if missing
    if (-not (Test-Path $HostAuthPath))   { New-Item -ItemType Directory -Force -Path $HostAuthPath | Out-Null }
    if (-not (Test-Path $HostConfigPath)) { New-Item -ItemType Directory -Force -Path $HostConfigPath | Out-Null }

    # Run Container
    # --network host: Shares host networking stack. 
    # NOTE: Idle connections >30 mins may still time out. Restart if frozen.
    docker run --rm -it `
        -v "${PWD}:/app" `
        -v "${HostAuthPath}:${ContainerAuthPath}" `
        -v "${HostConfigPath}:${ContainerConfigPath}" `
        -w /app `
        --network host `
        my-opencode-dotnet
}
```
3.  **Save** and Restart PowerShell.

***

### Phase 3: Project-Specific Playwright Setup
To use Playwright MCP in a specific project only (avoiding bloat in others):

1.  Inside your specific project folder (e.g., `C:\Work\MyWebApp`), create a folder named `.opencode` if it doesn't exist.
2.  Inside `.opencode`, create a file named `config.json`.
3.  Paste this configuration:

```json
{
  "mcp": {
    "playwright": {
      "type": "local",
      "command": ["npx", "-y", "@playwright/mcp@latest"],
      "enabled": true
    }
  }
}
```

**Usage:**
*   **Start:** Type `opencode-docker` in your terminal.
*   **Playwright:** It will only be active for projects that have this `config.json` file.
*   **SSL:** `dotnet restore` works globally for all projects.
