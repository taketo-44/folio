# Generates configuration only. Does not change firewall, trust, or startup settings.
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$LanAddress,
    [string]$HostName,
    [ValidateRange(1024, 65535)][int]$Port = 8443,
    [string]$CaddyPath
)
$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$runtime = Join-Path $project '.runtime'
$dist = Join-Path $project 'dist'

$ip = $null
if (-not [System.Net.IPAddress]::TryParse($LanAddress, [ref]$ip) -or $ip.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork) {
    throw 'LanAddress must be the laptop IPv4 address, for example 192.168.1.50.'
}
$octets = $ip.GetAddressBytes()
$private = $octets[0] -eq 10 -or ($octets[0] -eq 172 -and $octets[1] -ge 16 -and $octets[1] -le 31) -or ($octets[0] -eq 192 -and $octets[1] -eq 168)
if (-not $private) { throw 'Use the laptop private home-network IP (10.x, 172.16-31.x, or 192.168.x).' }
if ($HostName) {
    if ($HostName.Length -gt 253 -or $HostName -notmatch '^(?=.{1,253}$)([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$') {
        throw 'HostName must be a DNS name only, without a scheme, port, path, or wildcard.'
    }
    $hostAddress = $HostName.ToLowerInvariant()
} else { $hostAddress = $ip.ToString() }
if (-not (Test-Path (Join-Path $dist 'index.html'))) { throw 'The dist folder is missing. Extract the whole Folio package first.' }
if (-not $CaddyPath) {
    $bundled = Join-Path $project 'caddy.exe'
    if (Test-Path $bundled) { $CaddyPath = $bundled }
    else {
        $command = Get-Command 'caddy.exe' -ErrorAction SilentlyContinue
        if ($command) { $CaddyPath = $command.Source }
    }
}
if (-not $CaddyPath -or -not (Test-Path -LiteralPath $CaddyPath)) {
    throw 'Download the official Windows Caddy binary and place caddy.exe beside dist, or pass -CaddyPath.'
}
$CaddyPath = (Resolve-Path -LiteralPath $CaddyPath).Path
New-Item -ItemType Directory -Force -Path $runtime | Out-Null
$configPath = Join-Path $runtime 'Caddyfile'
$storage = (Join-Path $runtime 'caddy-data').Replace('\', '/')
$root = $dist.Replace('\', '/')
# Do not interpolate an unsafe directory into the Caddyfile grammar.
if ($storage -match '["\r\n{}]' -or $root -match '["\r\n{}]') { throw 'Move Folio to a path without quotes, braces, or newlines.' }
$config = @"
{
    admin off
    persist_config off
    servers {
        protocols h1 h2
    }
    auto_https disable_redirects
    skip_install_trust
    storage file_system "$storage"
}

https://${hostAddress}:$Port {
    bind $($ip.ToString())
    tls internal
    root * "$root"
    encode gzip
    header {
        X-Content-Type-Options nosniff
        Referrer-Policy strict-origin-when-cross-origin
        Cache-Control no-cache
    }
    file_server
}
"@
[System.IO.File]::WriteAllText($configPath, $config, [System.Text.UTF8Encoding]::new($false))
& $CaddyPath validate --config $configPath --adapter caddyfile
if ($LASTEXITCODE -ne 0) { throw 'Caddy rejected the configuration. No firewall or startup changes were made.' }
$settings = [ordered]@{ address = $ip.ToString(); hostName = $hostAddress; port = $Port; caddyPath = $CaddyPath; url = "https://${hostAddress}:$Port" }
$settings | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $runtime 'lan-config.json') -Encoding UTF8
Write-Host "Configured: $($settings.url)"
Write-Host 'Start with: .\windows\Start-Folio.ps1'
Write-Host 'See WINDOWS-SETUP.md for firewall rules, certificate trust, and VPN access.'
