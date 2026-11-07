#requires -Version 5.1
<#
.SYNOPSIS
  Registers (or removes) the Windows Task Scheduler job for PostgreSQL backups.

.DESCRIPTION
  The task runs backup-postgres.ps1 as the current Windows user. The backup
  script reads DATABASE_URL from the environment or the gitignored .env files,
  so no password is stored in the task action or in this repository.

  Run PowerShell as Administrator if Task Scheduler requires elevation.

.PARAMETER At
  Daily start time in 24-hour HH:mm format. Default 02:00.

.PARAMETER BackupRoot
  Backup destination passed to the backup script. Defaults to
  %USERPROFILE%\AttendanceSystemBackups.

.PARAMETER RetentionDays
  Optional retention period passed to the backup script. Omit to keep the
  backup script default (0 = keep all backups).

.PARAMETER Unregister
  Removes the scheduled task instead of creating it.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\backup\register-backup-task.ps1

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\backup\register-backup-task.ps1 -Unregister
#>
[CmdletBinding()]
param(
  [string]$TaskName = 'AttendanceSystem-Postgres-Backup',
  [string]$At = '02:00',
  [string]$BackupRoot = '',
  [int]$RetentionDays = -1,
  [switch]$Unregister
)

$ErrorActionPreference = 'Stop'

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$BackupScript = (Resolve-Path (Join-Path $PSScriptRoot 'backup-postgres.ps1')).Path

if ([string]::IsNullOrWhiteSpace($BackupRoot)) {
  $BackupRoot = Join-Path $env:USERPROFILE 'AttendanceSystemBackups'
}
$BackupRoot = [System.IO.Path]::GetFullPath($BackupRoot)

if ($Unregister) {
  $existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  if (-not $existing) {
    Write-Host "Task '$TaskName' is not registered."
    exit 0
  }
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Host "Task '$TaskName' removed."
  exit 0
}

$arguments = @(
  '-NoProfile',
  '-ExecutionPolicy', 'Bypass',
  '-File', ('"{0}"' -f $BackupScript),
  '-BackupRoot', ('"{0}"' -f $BackupRoot)
)
if ($RetentionDays -ge 0) {
  $arguments += @('-RetentionDays', [string]$RetentionDays)
}

$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ($arguments -join ' ')
$trigger = New-ScheduledTaskTrigger -Daily -At $At
$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Hours 2) `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries

Register-ScheduledTask `
  -TaskName $TaskName `
  -Description 'Daily custom-format PostgreSQL backup for the attendance system' `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Force | Out-Null

Write-Host "Registered task '$TaskName'."
Write-Host "Schedule: daily at $At (current Windows user; runs only when the user is logged on)."
Write-Host "Backup root: $BackupRoot"
Write-Host "Backup script: $BackupScript"
Write-Host ''
Write-Host 'Verify with:'
Write-Host ("  Get-ScheduledTask -TaskName '{0}' | Format-List" -f $TaskName)
Write-Host ("  Get-ScheduledTaskInfo -TaskName '{0}'" -f $TaskName)
Write-Host ("  Start-ScheduledTask -TaskName '{0}'" -f $TaskName)
Write-Host ("  Get-Content '{0}\logs\backup-*.log' -Tail 20" -f $BackupRoot)
