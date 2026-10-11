param(
    [Parameter(Mandatory=$true)][string[]]$RemoteAddress,
    [Parameter(Mandatory=$true)][string]$LocalAddress,
    [ValidateRange(1024,65535)][int]$Port = 8443
)
$ErrorActionPreference = 'Stop'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (!$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Run in Administrator PowerShell.' }
foreach ($address in $RemoteAddress) {
    if ($address -notmatch '^\d{1,3}(\.\d{1,3}){3}(/\d{1,2})?$') { throw 'Use explicit IPv4 addresses or CIDR subnets.' }
    $parts = $address.Split('/')
    $parsed = $null
    if (![Net.IPAddress]::TryParse($parts[0], [ref]$parsed) -or ($parts.Count -gt 1 -and [int]$parts[1] -gt 32)) { throw "Invalid address: $address" }
    if ($parts.Count -gt 1 -and [int]$parts[1] -eq 0) { throw 'Use a specific client subnet, not /0.' }
}
$localIP = $null
if (![Net.IPAddress]::TryParse($LocalAddress, [ref]$localIP) -or $localIP.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork) { throw 'LocalAddress must be the laptop IPv4 address.' }
$repo = Split-Path $PSScriptRoot -Parent
$exe = Join-Path $repo '.local\caddy.exe'
if (!(Test-Path -LiteralPath $exe)) { throw 'Start Folio first to install Caddy.' }
$name = 'Folio-HTTPS'
if (Get-NetFirewallRule -Name $name -ErrorAction SilentlyContinue) {
    Set-NetFirewallRule -Name $name -Enabled True -Direction Inbound -Action Allow -Profile Any -Program $exe -Protocol TCP -LocalPort $Port -LocalAddress $LocalAddress -RemoteAddress $RemoteAddress
} else {
    New-NetFirewallRule -Name $name -DisplayName 'Folio HTTPS (specified client networks)' -Enabled True -Direction Inbound -Action Allow -Profile Any -Program $exe -Protocol TCP -LocalPort $Port -LocalAddress $LocalAddress -RemoteAddress $RemoteAddress | Out-Null
}
Write-Host "Allowed TCP $Port to $LocalAddress from $($RemoteAddress -join ', ')."
