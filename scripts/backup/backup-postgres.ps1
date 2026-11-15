#requires -Version 5.1
<#
.SYNOPSIS
  Creates a PostgreSQL custom-format backup of the attendance database.

.DESCRIPTION
  - Writes a uniquely named dump outside the project folder by default.
  - Reads the connection string from DATABASE_URL or from the gitignored .env
    files; the password is never written to disk or to the log.
  - Writes a timestamped success/failure log next to the backups.
  - Validates the dump header and runs `pg_restore --list` before renaming the
    temporary file to its final name.
  - Retention is disabled by default (0 = keep everything). When a retention
    period is configured it only reports what would be removed unless
    -ApplyRetention is supplied.

.PARAMETER BackupRoot
  Destination folder. Defaults to $env:ATTENDANCE_BACKUP_ROOT or
  %USERPROFILE%\AttendanceSystemBackups.

.PARAMETER RetentionDays
  Number of days to keep. 0 disables retention. Defaults to
  $env:ATTENDANCE_BACKUP_RETENTION_DAYS or 0.

.PARAMETER ApplyRetention
  Actually deletes backups older than RetentionDays. Without this switch the
  script only logs what would be deleted. Do not enable before the retention
  period is approved.

.PARAMETER PgBin
  Folder containing pg_dump.exe and pg_restore.exe. Defaults to
  <project>\postgresql\bin, then PATH.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\backup\backup-postgres.ps1
#>
[CmdletBinding()]
param(
  [string]$BackupRoot = '',
  [int]$RetentionDays = -1,
  [switch]$ApplyRetention,
  [string]$PgBin = ''
)

$ErrorActionPreference = 'Stop'

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

function Get-DotEnvValue {
  param([string]$Path, [string]$Key)

  if (-not (Test-Path -LiteralPath $Path)) { return $null }

  foreach ($line in Get-Content -LiteralPath $Path -Encoding UTF8) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#')) { continue }

    $separator = $trimmed.IndexOf('=')
    if ($separator -lt 1) { continue }

    $name = $trimmed.Substring(0, $separator).Trim()
    if ($name -ne $Key) { continue }

    $value = $trimmed.Substring($separator + 1).Trim()
    if ($value.Length -ge 2) {
      $first = $value.Substring(0, 1)
      $last = $value.Substring($value.Length - 1, 1)
      if (($first -eq '"' -and $last -eq '"') -or ($first -eq "'" -and $last -eq "'")) {
        $value = $value.Substring(1, $value.Length - 2)
      }
    }
    return $value
  }

  return $null
}

function Get-Setting {
  param([string]$Name)

  $value = [Environment]::GetEnvironmentVariable($Name, 'Process')
  if (-not [string]::IsNullOrWhiteSpace($value)) { return $value }

  $candidates = @(
    (Join-Path $ProjectRoot '.env'),
    (Join-Path $ProjectRoot 'apps\api\.env')
  )
  foreach ($candidate in $candidates) {
    $value = Get-DotEnvValue -Path $candidate -Key $Name
    if (-not [string]::IsNullOrWhiteSpace($value)) { return $value }
  }

  return $null
}

function ConvertFrom-PostgresUrl {
  param([string]$Url)

  if ([string]::IsNullOrWhiteSpace($Url)) {
    throw 'DATABASE_URL is not configured (environment or .env).'
  }

  $uri = [System.Uri]$Url
  $scheme = $uri.Scheme.ToLowerInvariant()
  if ($scheme -ne 'postgres' -and $scheme -ne 'postgresql') {
    throw 'DATABASE_URL is not a PostgreSQL connection string.'
  }

  $userInfo = $uri.UserInfo.Split(':', 2)
  if ($userInfo.Count -lt 1 -or [string]::IsNullOrWhiteSpace($userInfo[0])) {
    throw 'DATABASE_URL does not contain a user name.'
  }

  $database = [System.Uri]::UnescapeDataString($uri.AbsolutePath.TrimStart('/'))
  if ([string]::IsNullOrWhiteSpace($database)) {
    throw 'DATABASE_URL does not contain a database name.'
  }

  $port = 5432
  if ($uri.Port -gt 0) { $port = $uri.Port }

  return [pscustomobject]@{
    Host     = $uri.Host
    Port     = $port
    User     = [System.Uri]::UnescapeDataString($userInfo[0])
    Password = if ($userInfo.Count -gt 1) { [System.Uri]::UnescapeDataString($userInfo[1]) } else { '' }
    Database = $database
  }
}

function Resolve-PgTool {
  param([string]$Tool)

  if (-not [string]::IsNullOrWhiteSpace($PgBin)) {
    $candidate = Join-Path $PgBin "$Tool.exe"
    if (Test-Path -LiteralPath $candidate) { return $candidate }
    throw "Cannot find $Tool.exe in PgBin '$PgBin'."
  }

  $bundled = Join-Path $ProjectRoot "postgresql\bin\$Tool.exe"
  if (Test-Path -LiteralPath $bundled) { return $bundled }

  $command = Get-Command "$Tool.exe" -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }

  throw "$Tool.exe was not found. Pass -PgBin or add PostgreSQL bin to PATH."
}

function Protect-LogText {
  param([string]$Text, [string]$Password)

  if ([string]::IsNullOrEmpty($Text)) { return '' }
  $safe = $Text
  if (-not [string]::IsNullOrEmpty($Password)) {
    $safe = $safe.Replace($Password, '***')
  }
  return $safe
}

if ([string]::IsNullOrWhiteSpace($BackupRoot)) {
  $BackupRoot = $env:ATTENDANCE_BACKUP_ROOT
}
if ([string]::IsNullOrWhiteSpace($BackupRoot)) {
  $BackupRoot = Join-Path $env:USERPROFILE 'AttendanceSystemBackups'
}
$BackupRoot = [System.IO.Path]::GetFullPath($BackupRoot)

if ($RetentionDays -lt 0) {
  $configuredRetention = $env:ATTENDANCE_BACKUP_RETENTION_DAYS
  if ([string]::IsNullOrWhiteSpace($configuredRetention)) { $configuredRetention = Get-Setting 'ATTENDANCE_BACKUP_RETENTION_DAYS' }
  if ([string]::IsNullOrWhiteSpace($configuredRetention)) {
    $RetentionDays = 0
  } else {
    $RetentionDays = [int]$configuredRetention
  }
}

$logDir = Join-Path $BackupRoot 'logs'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$logFile = Join-Path $logDir ('backup-{0}.log' -f (Get-Date -Format 'yyyy-MM'))

function Write-Log {
  param([string]$Message)
  $line = '{0} {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
  Add-Content -LiteralPath $logFile -Value $line -Encoding UTF8
  Write-Host $line
}

$db = $null
$partialFile = ''

try {
  $databaseUrl = Get-Setting 'DATABASE_URL'
  $db = ConvertFrom-PostgresUrl -Url $databaseUrl

  $pgDump = Resolve-PgTool 'pg_dump'
  $pgRestore = Resolve-PgTool 'pg_restore'

  New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null

  $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
  $finalFile = Join-Path $BackupRoot ("attendance_{0}.dump" -f $stamp)
  $partialFile = "$finalFile.partial"

  Write-Log ("START target_db={0} host={1} port={2} user={3}" -f $db.Database, $db.Host, $db.Port, $db.User)
  Write-Log ("OUTPUT {0}" -f $finalFile)

  $oldPassword = $env:PGPASSWORD
  $env:PGPASSWORD = $db.Password
  try {
    $dumpOutput = & $pgDump `
      --format=custom `
      --compress=6 `
      --no-owner `
      --no-privileges `
      --file=$partialFile `
      --host=$($db.Host) `
      --port=$($db.Port) `
      --username=$($db.User) `
      --dbname=$($db.Database) 2>&1
    $dumpExit = $LASTEXITCODE
  } finally {
    if ($null -eq $oldPassword) { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue } else { $env:PGPASSWORD = $oldPassword }
  }

  if ($dumpExit -ne 0) {
    $detail = Protect-LogText -Text (($dumpOutput | Out-String).Trim()) -Password $db.Password
    throw "pg_dump failed with exit code $dumpExit. $detail"
  }

  if (-not (Test-Path -LiteralPath $partialFile)) {
    throw 'pg_dump reported success but no dump file was created.'
  }

  $fileInfo = Get-Item -LiteralPath $partialFile
  if ($fileInfo.Length -le 0) {
    throw 'The dump file is empty.'
  }

  # Custom-format dumps start with the ASCII signature "PGDMP".
  $bytes = [System.IO.File]::ReadAllBytes($partialFile)
  $signature = [System.Text.Encoding]::ASCII.GetString($bytes, 0, [Math]::Min(5, $bytes.Length))
  if ($signature -ne 'PGDMP') {
    throw 'The dump file does not have a valid PostgreSQL custom-format header.'
  }

  $oldPassword = $env:PGPASSWORD
  $env:PGPASSWORD = $db.Password
  try {
    $listOutput = & $pgRestore --list $partialFile 2>&1
    $listExit = $LASTEXITCODE
  } finally {
    if ($null -eq $oldPassword) { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue } else { $env:PGPASSWORD = $oldPassword }
  }

  if ($listExit -ne 0) {
    $detail = Protect-LogText -Text (($listOutput | Out-String).Trim()) -Password $db.Password
    throw "pg_restore --list rejected the dump (exit $listExit). $detail"
  }

  $tableDataEntries = @($listOutput | Select-String -Pattern 'TABLE DATA').Count
  if ($tableDataEntries -lt 1) {
    throw 'The dump contains no table data entries.'
  }

  $sha256 = (Get-FileHash -LiteralPath $partialFile -Algorithm SHA256).Hash
  Move-Item -LiteralPath $partialFile -Destination $finalFile -Force

  $sizeMb = [Math]::Round((Get-Item -LiteralPath $finalFile).Length / 1MB, 2)
  Write-Log ("SUCCESS file={0} size_mb={1} table_data_entries={2} sha256={3}" -f (Split-Path -Leaf $finalFile), $sizeMb, $tableDataEntries, $sha256)

  if ($RetentionDays -gt 0) {
    $cutoff = (Get-Date).AddDays(-$RetentionDays)
    $oldBackups = @(Get-ChildItem -LiteralPath $BackupRoot -Filter 'attendance_*.dump' -File |
      Where-Object { $_.LastWriteTime -lt $cutoff })

    if ($oldBackups.Count -eq 0) {
      Write-Log ("RETENTION nothing older than {0} days" -f $RetentionDays)
    } elseif ($ApplyRetention) {
      foreach ($old in $oldBackups) {
        Remove-Item -LiteralPath $old.FullName -Force
        Write-Log ("RETENTION deleted {0}" -f $old.Name)
      }
    } else {
      foreach ($old in $oldBackups) {
        Write-Log ("RETENTION dry-run would delete {0}" -f $old.Name)
      }
    }
  } else {
    Write-Log 'RETENTION disabled (0); all backups are kept'
  }

  exit 0
} catch {
  $safeMessage = Protect-LogText -Text $_.Exception.Message -Password $(if ($db) { $db.Password } else { '' })
  Write-Log ("FAILED {0}" -f $safeMessage)
  if (-not [string]::IsNullOrEmpty($partialFile) -and (Test-Path -LiteralPath $partialFile)) {
    Remove-Item -LiteralPath $partialFile -Force -ErrorAction SilentlyContinue
  }
  exit 1
}
