# Optional: start the configured server when the current Windows user signs in.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$settingsPath = Join-Path $project '.runtime\lan-config.json'
if (-not (Test-Path $settingsPath)) { throw 'Run Configure-Lan.ps1 and verify the server manually first.' }
$settings = Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json
$config = Join-Path $project '.runtime\Caddyfile'
if (Get-ScheduledTask -TaskName 'FolioPrivateLan' -ErrorAction SilentlyContinue) { throw 'The FolioPrivateLan startup task already exists. Inspect it before replacing it.' }
$user = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$action = New-ScheduledTaskAction -Execute $settings.caddyPath -Argument "run --config `"$config`" --adapter caddyfile" -WorkingDirectory $project
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $user
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
$options = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName 'FolioPrivateLan' -Action $action -Trigger $trigger -Principal $principal -Settings $options -Description 'Serve Folio privately on the configured home-network address.' | Out-Null
Write-Host 'Startup configured for your next Windows sign-in. The task does not start before sign-in.'
Write-Host 'Locking Windows keeps the server running; signing out stops it. Sleep also makes it unavailable.'
