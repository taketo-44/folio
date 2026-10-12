# Run as Administrator on the Windows host after Configure-Lan.ps1.
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string[]]$AllowedNetworks
)
$ErrorActionPreference = 'Stop'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Open PowerShell as Administrator to add this firewall rule.' }
foreach ($network in $AllowedNetworks) {
    $parts = $network.Split('/')
    $ip = $null
    $prefix = 0
    if ($parts.Length -ne 2 -or -not [Net.IPAddress]::TryParse($parts[0], [ref]$ip) -or $ip.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork -or -not [int]::TryParse($parts[1], [ref]$prefix) -or $prefix -lt 1 -or $prefix -gt 32) {
        throw "Use explicit IPv4 CIDRs for AllowedNetworks, for example 192.168.1.0/24 and 10.8.0.0/24. Invalid: $network"
    }
    $bytes = $ip.GetAddressBytes()
    $privateRange = ($bytes[0] -eq 10 -and $prefix -ge 8) -or ($bytes[0] -eq 172 -and $bytes[1] -ge 16 -and $bytes[1] -le 31 -and $prefix -ge 12) -or ($bytes[0] -eq 192 -and $bytes[1] -eq 168 -and $prefix -ge 16)
    if (-not $privateRange) { throw "Use private home/VPN network ranges only. Invalid: $network" }
}
$project = Split-Path -Parent $PSScriptRoot
$settings = Get-Content -LiteralPath (Join-Path $project '.runtime\lan-config.json') -Raw | ConvertFrom-Json
$ruleName = 'FolioPrivateLan'
if (Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue) {
    throw 'FolioPrivateLan already exists. Inspect it first; remove that specific rule before changing networks.'
}
New-NetFirewallRule -Name $ruleName -DisplayName 'Folio - home network and VPN' -Direction Inbound -Action Allow -Protocol TCP -LocalPort $settings.port -LocalAddress $settings.address -RemoteAddress $AllowedNetworks -Program $settings.caddyPath -Profile Private | Out-Null
Write-Host "Allowed TCP $($settings.port) on $($settings.address), from: $($AllowedNetworks -join ', ')"
Write-Host 'This applies only to the Windows Private network profile. No router forwarding is required.'
