param([string]$HostName, [string]$BindAddress, [ValidateRange(1024,65535)][int]$Port = 8443, [switch]$Background)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$state = Join-Path $repo '.local'
$exe = Join-Path $state 'caddy.exe'
New-Item -ItemType Directory -Path $state -Force | Out-Null
if (!(Test-Path -LiteralPath $exe)) {
    Invoke-WebRequest -Uri 'https://caddyserver.com/api/download?os=windows&arch=amd64' -OutFile $exe -UseBasicParsing
}
if (!$HostName) {
    $network = Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.IPv4Address } | Select-Object -First 1
    if (!$network) { throw 'No active IPv4 network. Supply -HostName explicitly.' }
    $HostName = $network.IPv4Address.IPAddress | Select-Object -First 1
}
if ($HostName -notmatch '^[a-zA-Z0-9][a-zA-Z0-9.-]*$') { throw 'HostName must be an IPv4 address or DNS name.' }
if (!$BindAddress) {
    $hostIP = $null
    if ([Net.IPAddress]::TryParse($HostName, [ref]$hostIP) -and $hostIP.AddressFamily -eq [Net.Sockets.AddressFamily]::InterNetwork) {
        $BindAddress = $HostName
    } else {
        $network = Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.IPv4Address } | Select-Object -First 1
        $BindAddress = $network.IPv4Address.IPAddress | Select-Object -First 1
    }
}
$bindIP = $null
if (![Net.IPAddress]::TryParse($BindAddress, [ref]$bindIP) -or $bindIP.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork) { throw 'BindAddress must be a local IPv4 address.' }
if (!(Get-NetIPAddress -IPAddress $BindAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue)) { throw 'BindAddress is not assigned to this laptop.' }

$pidFile = Join-Path $state 'caddy.pid'
if (Test-Path -LiteralPath $pidFile) {
    $savedPid = [int](Get-Content -LiteralPath $pidFile -Raw)
    $running = Get-Process -Id $savedPid -ErrorAction SilentlyContinue
    if ($running -and $running.Path -eq $exe) { throw 'Folio is already running. Run Stop-Folio.ps1 first.' }
}
$root = (Join-Path $repo 'dist').Replace('\','/')
$data = (Join-Path $state 'caddy-data').Replace('\','/')
$config = Join-Path $state 'Caddyfile'
@"
{
    admin off
    auto_https disable_redirects
    skip_install_trust
    storage file_system {
        root "$data"
    }
    servers {
        protocols h1 h2
    }
}
https://$($HostName):$Port, https://localhost:$Port {
    bind $BindAddress 127.0.0.1
    tls internal
    root * "$root"
    @metadata path /api/eprint /api/arxiv
    handle @metadata {
        reverse_proxy 127.0.0.1:4174
    }
    @assets path / /index.html /app.js /style.css
    handle @assets {
        header Cache-Control "no-store"
        header X-Content-Type-Options "nosniff"
        file_server
    }
    handle {
        respond "Not found" 404
    }
}
"@ | Set-Content -LiteralPath $config -Encoding UTF8
& $exe validate --config $config --adapter caddyfile
if ($LASTEXITCODE -ne 0) { throw 'Caddy configuration validation failed.' }
& (Join-Path $PSScriptRoot 'Start-Metadata.ps1')
Write-Host "Folio URL: https://$($HostName):$Port"
Write-Host "Client trust certificate: $state\caddy-data\pki\authorities\local\root.crt"
if ($Background) {
    $process = Start-Process -FilePath $exe -ArgumentList @('run','--config', ('"' + $config + '"'), '--adapter','caddyfile') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $state 'server.out.log') -RedirectStandardError (Join-Path $state 'server.err.log')
    $process.Id | Set-Content -LiteralPath $pidFile
    Start-Sleep -Seconds 2
    $process.Refresh()
    if ($process.HasExited) { throw "Server exited. See $state\server.err.log" }
    Write-Host "Running in background (PID $($process.Id)). Stop with windows\Stop-Folio.ps1."
} else {
    try { & $exe run --config $config --adapter caddyfile }
    finally { & (Join-Path $PSScriptRoot 'Stop-Metadata.ps1') }
}
