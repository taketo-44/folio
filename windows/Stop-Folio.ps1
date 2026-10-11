$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$pidFile = Join-Path $repo '.local\caddy.pid'
$exe = Join-Path $repo '.local\caddy.exe'
if (!(Test-Path -LiteralPath $pidFile)) { & (Join-Path $PSScriptRoot 'Stop-Metadata.ps1'); Write-Host 'No background Folio process recorded.'; return }
$savedPid = [int](Get-Content -LiteralPath $pidFile -Raw)
$process = Get-Process -Id $savedPid -ErrorAction SilentlyContinue
if ($process) {
    if ($process.Path -ne $exe) { throw 'Recorded PID belongs to another process; refusing to stop it.' }
    Stop-Process -Id $savedPid
}
Remove-Item -LiteralPath $pidFile
& (Join-Path $PSScriptRoot 'Stop-Metadata.ps1')
Write-Host 'Folio stopped.'
