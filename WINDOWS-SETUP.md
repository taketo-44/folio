# Host Folio on this Windows laptop

Caddy runs on Windows and serves only Folio's public assets from `dist/`, including when the repo lives in WSL. No WSL port forwarding or build step is needed. A localhost-only Node.js service handles IACR ePrint and arXiv citation lookup. HTTPS is required for the app's `crypto.randomUUID()` calls.

## Start

From Windows PowerShell in the repository:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\windows\Start-Folio.ps1 -HostName 172.20.24.151 -Background
```

This was the laptop's institute Wi-Fi address when configured. Check `ipconfig` after changing networks. Omit `-HostName` to select the first active IPv4 network with a gateway, or supply a stable DNS name assigned to this laptop.

The script downloads Caddy from its official HTTPS endpoint if missing, validates the config, and starts it hidden. It also downloads the portable Node.js 24 runtime from nodejs.org (checking the official SHA-256 manifest) and starts the metadata service on 127.0.0.1:4174. No Node installer or third-party packages are used. The executable, generated config, logs, certificates, and private keys stay in git-ignored `.local/`. Do not share that directory.

## Trust HTTPS on each client

After startup, transfer only this **public root certificate** to each device using a trusted channel:

```text
.local/caddy-data/pki/authorities/local/root.crt
```

Import it as a trusted root CA in the device/browser certificate settings. On Windows, import into the current user's Trusted Root Certification Authorities store. On iOS, installing the profile also requires enabling full trust under Settings > General > About > Certificate Trust Settings. Android trust varies by browser and device policy. Institute-managed devices may require IT.

Do not rely on bypassing a certificate warning: Folio needs a trusted secure context. Scripts do not automatically change trust stores. Preserve `.local/caddy-data/` to keep the same root CA when restarting.

## Allow local-network clients

Run in **Administrator PowerShell** from the repository:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\windows\Enable-FolioFirewall.ps1 -LocalAddress 172.20.24.151 -RemoteAddress 172.20.24.0/24
```

This adds or updates only the named `Folio-HTTPS` rule: Caddy, TCP 8443, the specified laptop address, and the specified client subnet. It applies to Public networks too; do not reclassify institute Wi-Fi. Replace both addresses if the network changes. Institute network restrictions or Wi-Fi client isolation can still prevent connections.

After trusting the certificate, another device on the subnet can open **https://172.20.24.151:8443**.

The laptop must stay powered on, awake, and connected. Closing PowerShell leaves the background server running. It does not restart after reboot; run the start command after signing in. Logs are in `.local/server.err.log`. Foreground mode (omit `-Background`) stops with Ctrl+C.

## FortiClient later

Connect the remote device to the institute VPN. It must route to this laptop's institute address and permit TCP 8443. If the URL is unreachable, ask IT whether VPN clients can access this laptop; having a VPN connection does not establish this permission.

Find the remote device's VPN IPv4 address or obtain the VPN client subnet from IT. Re-run the firewall script with **both** local and VPN client networks:

```powershell
.\windows\Enable-FolioFirewall.ps1 -LocalAddress 172.20.24.151 -RemoteAddress '172.20.24.0/24','VPN_CLIENT_IP_OR_CIDR'
```

Replace the placeholder first; the script rejects non-IP values. Trust the same certificate and use the same HTTPS URL. No router port forwarding is needed.

## Data and Google Drive

This serves a browser-storage app, not a shared library. Each browser keeps its own localStorage metadata and IndexedDB PDFs. JSON export/import moves metadata and notes; Google Drive backup/restore moves PDFs too. Restore before editing and backing up from a second device.

Google OAuth does not accept a private IP address as an Authorized JavaScript origin. Remote Drive authorization needs a suitable DNS hostname for this laptop, with its exact HTTPS origin (including port) registered in a Google OAuth web client. A trusted local certificate alone does not remove Google's restrictions. Local library features work at the IP URL.

Use a consistent address across devices. Changing the origin creates a separate browser library. Export metadata and back up PDFs before moving addresses or clearing browser storage.

## Stop and undo

```powershell
.\windows\Stop-Folio.ps1
# Administrator PowerShell:
Remove-NetFirewallRule -Name Folio-HTTPS
```

Stopping Folio does not delete browser data or certificates. Remove the Folio root CA through each device's certificate settings when retiring the host.

References: [Caddy local HTTPS](https://caddyserver.com/docs/automatic-https), [Google origin requirements](https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow#js-origin-validation).

## Effect on the institute network

Folio serves its static app over HTTPS on this laptop. It does not configure the router, DHCP, DNS, VPN, network sharing, or other devices. It responds to requests directed to this laptop and does not scan or broadcast to other users. Ordinary web traffic uses a small amount of shared bandwidth when someone opens the app. Discovery and DOI lookup requests are made by the requesting browser on explicit actions. An ePrint lookup makes one HTTPS request from the laptop to eprint.iacr.org for the entered article; repeat lookups are cached. The localhost-only service accepts article IDs, not arbitrary destinations, does not follow redirects, and limits upstream requests to two concurrent requests and twenty per minute, with a 15-second deadline and a 512 KiB response limit.

The public HTTPS server binds only to the selected laptop IPv4 address and loopback on TCP 8443. Its metadata helper binds only to 127.0.0.1:4174; it is reached through Caddy at /api/eprint and /api/arxiv and requires no additional firewall rule. It does not bind to other laptop interfaces or IPv6. HTTP redirects, the Caddy administration API, and HTTP/3 (UDP) are disabled. Windows Firewall further restricts incoming connections to the configured client subnet. For a DNS hostname, use `-BindAddress LAPTOP_IPV4` to select the intended interface explicitly.

The current firewall subnet includes other institute Wi-Fi users. It controls reachability rather than providing authentication. To restrict access to your own devices, pass their individual IPv4 addresses to the firewall script instead of the whole subnet. No browser library is uploaded to this server.

See [Caddy interface binding](https://caddyserver.com/docs/caddyfile/directives/bind).
