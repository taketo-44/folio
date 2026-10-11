param([ValidateRange(1024,65535)][int]$Port = 4174)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$state = Join-Path $repo '.local'
New-Item -ItemType Directory -Path $state -Force | Out-Null
$node = Join-Path $state 'node.exe'
$hashFile = Join-Path $state 'node-SHASUMS256.txt'
if (!(Test-Path -LiteralPath $hashFile)) {
    Invoke-WebRequest -Uri 'https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt' -OutFile $hashFile -UseBasicParsing
}
$hashLine = Get-Content -LiteralPath $hashFile | Where-Object { $_ -match '  win-x64/node.exe$' } | Select-Object -First 1
if (!$hashLine) { throw 'No Windows Node checksum in official manifest.' }
$expected = $hashLine.Split(' ')[0]
function Get-RuntimeHash([string]$Path) {
    $file = [IO.File]::OpenRead($Path)
    $buffer = New-Object IO.BufferedStream($file, 1048576)
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($sha.ComputeHash($buffer)).Replace('-','') }
    finally { $sha.Dispose(); $buffer.Dispose(); $file.Dispose() }
}
$actual = if (Test-Path -LiteralPath $node) { Get-RuntimeHash $node } else { '' }
if ($actual -ne $expected) {
    Invoke-WebRequest -Uri 'https://nodejs.org/dist/latest-v24.x/win-x64/node.exe' -OutFile $node -UseBasicParsing
    $actual = Get-RuntimeHash $node
}
if ($actual -ne $expected) { throw 'Node checksum mismatch; runtime not started.' }
$pidFile = Join-Path $state 'metadata.pid'
if (Test-Path -LiteralPath $pidFile) {
    $savedPid = [int](Get-Content -LiteralPath $pidFile -Raw)
    $running = Get-Process -Id $savedPid -ErrorAction SilentlyContinue
    if ($running -and $running.Path -eq $node) {
        $listener = Get-NetTCPConnection -OwningProcess $savedPid -State Listen
        if ($listener.LocalAddress -ne '127.0.0.1' -or $listener.LocalPort -ne $Port) { throw 'Metadata process is on a different address or port.' }
        Write-Host 'Folio metadata service is already running.'
        return
    }
}
if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) { throw "Port $Port is already in use." }
$script = Join-Path $repo 'server\metadata.mjs'
$process = Start-Process -FilePath $node -ArgumentList @('--max-old-space-size=64', ('"' + $script + '"'), $Port) -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $state 'metadata.out.log') -RedirectStandardError (Join-Path $state 'metadata.err.log')
$process.Id | Set-Content -LiteralPath $pidFile
Start-Sleep -Seconds 1
$process.Refresh()
if ($process.HasExited) { throw "Metadata server exited. See $state\metadata.err.log" }
$healthy = $false
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    $process.Refresh()
    if ($process.HasExited) { throw "Metadata server exited. See $state\metadata.err.log" }
    try {
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/health" -TimeoutSec 1
        if ($health.service -eq 'folio-metadata') { $healthy = $true; break }
    } catch {}
    Start-Sleep -Seconds 1
}
if (!$healthy) {
    Stop-Process -Id $process.Id
    Remove-Item -LiteralPath $pidFile
    throw 'Metadata service did not become ready. See metadata.err.log.'
}
Write-Host "Folio metadata running on localhost:$Port."
