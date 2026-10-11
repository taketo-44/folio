$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$pidFile = Join-Path $repo '.local\metadata.pid'
$exe = Join-Path $repo '.local\node.exe'
if (!(Test-Path -LiteralPath $pidFile)) { return }
$savedPid = [int](Get-Content -LiteralPath $pidFile -Raw)
$process = Get-Process -Id $savedPid -ErrorAction SilentlyContinue
if ($process) {
    if ($process.Path -ne $exe) { throw 'Recorded metadata PID belongs to another process; refusing to stop it.' }
    Stop-Process -Id $savedPid
}
Remove-Item -LiteralPath $pidFile
Write-Host 'Folio metadata stopped.'
