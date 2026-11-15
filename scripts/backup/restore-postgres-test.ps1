#requires -Version 5.1
<#
.SYNOPSIS
  Restores a custom-format backup into a dedicated TEST database and verifies it.

.DESCRIPTION
  Safety rules enforced by this script:
  - The target database name must match attendance_restore_test_<suffix>.
  - The target name must differ from the production DATABASE_URL database.
  - The script never connects to the production database except to run
    read-only SELECT count queries for comparison.
  - The test database is dropped afterwards unless -KeepTestDatabase is used.

  Verification compares row counts between the source and the restored copy,
  checks foreign-key/index/migration counts, and looks for orphan rows,
  duplicate tokens and duplicate lecture QR values.

.PARAMETER BackupFile
  Path to an attendance_*.dump file created by backup-postgres.ps1.

.PARAMETER TestDatabaseName
  Name of the throwaway database. Defaults to
  attendance_restore_test_<yyyyMMdd_HHmmss>.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\backup\restore-postgres-test.ps1 `
    -BackupFile "$env:USERPROFILE\AttendanceSystemBackups\attendance_20261106_020000.dump" `
    -IUnderstandThisIsATestDatabase
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile,

  [string]$TestDatabaseName = '',
  [string]$AdminUrl = '',
  [string]$SourceUrl = '',
  [string]$PgBin = '',
  [string]$ReportPath = '',
  [switch]$KeepTestDatabase,
  [switch]$IUnderstandThisIsATestDatabase
)

$ErrorActionPreference = 'Stop'

if (-not $IUnderstandThisIsATestDatabase) {
  throw 'Refusing to run without -IUnderstandThisIsATestDatabase. This script creates and then drops a TEST database only.'
}

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$BackupFile = (Resolve-Path -LiteralPath $BackupFile).Path

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
  param([string]$Name, [string]$Override)

  if (-not [string]::IsNullOrWhiteSpace($Override)) { return $Override }

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
  param([string]$Url, [string]$Label)

  if ([string]::IsNullOrWhiteSpace($Url)) {
    throw "$Label is not configured (environment or .env)."
  }

  $uri = [System.Uri]$Url
  $scheme = $uri.Scheme.ToLowerInvariant()
  if ($scheme -ne 'postgres' -and $scheme -ne 'postgresql') {
    throw "$Label is not a PostgreSQL connection string."
  }

  $userInfo = $uri.UserInfo.Split(':', 2)
  if ($userInfo.Count -lt 1 -or [string]::IsNullOrWhiteSpace($userInfo[0])) {
    throw "$Label does not contain a user name."
  }

  $database = [System.Uri]::UnescapeDataString($uri.AbsolutePath.TrimStart('/'))
  if ([string]::IsNullOrWhiteSpace($database)) {
    throw "$Label does not contain a database name."
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

$psql = Resolve-PgTool 'psql'
$pgRestore = Resolve-PgTool 'pg_restore'

$admin = ConvertFrom-PostgresUrl -Url (Get-Setting 'DATABASE_ADMIN_URL' $AdminUrl) -Label 'DATABASE_ADMIN_URL'
$source = ConvertFrom-PostgresUrl -Url (Get-Setting 'DATABASE_URL' $SourceUrl) -Label 'DATABASE_URL'

if ([string]::IsNullOrWhiteSpace($TestDatabaseName)) {
  $TestDatabaseName = 'attendance_restore_test_{0}' -f (Get-Date -Format 'yyyyMMdd_HHmmss')
}

if ($TestDatabaseName -notmatch '^attendance_restore_test_[A-Za-z0-9_]{1,40}$') {
  throw 'TestDatabaseName must match ^attendance_restore_test_[A-Za-z0-9_]{1,40}$.'
}
if ($TestDatabaseName -eq $source.Database) {
  throw 'Refusing to restore over the production database.'
}
if ($TestDatabaseName -eq $admin.Database) {
  throw 'Refusing to use the maintenance database as the restore target.'
}

$backupInfo = Get-Item -LiteralPath $BackupFile
if ($backupInfo.Length -le 0) { throw 'The backup file is empty.' }
$backupSha256 = (Get-FileHash -LiteralPath $BackupFile -Algorithm SHA256).Hash

if ([string]::IsNullOrWhiteSpace($ReportPath)) {
  $ReportPath = Join-Path $backupInfo.DirectoryName ('restore-report-{0}.txt' -f (Get-Date -Format 'yyyyMMdd_HHmmss'))
}
$ReportPath = [System.IO.Path]::GetFullPath($ReportPath)

$report = New-Object System.Collections.Generic.List[string]
$targetCreated = $false
$oldPassword = $env:PGPASSWORD

function Add-Report {
  param([string]$Line)
  $report.Add($Line) | Out-Null
  Write-Host $Line
}

function Invoke-Psql {
  param(
    [string]$Database,
    [string[]]$Sql,
    [switch]$TuplesOnly
  )

  $arguments = @(
    '--host', $admin.Host,
    '--port', [string]$admin.Port,
    '--username', $admin.User,
    '--dbname', $Database,
    '--no-psqlrc',
    '-v', 'ON_ERROR_STOP=1'
  )
  if ($TuplesOnly) { $arguments += @('-t', '-A', '-F', '|') }

  # Write SQL to a file instead of -c: Windows PowerShell strips embedded double
  # quotes from native arguments, which would break quoted identifiers.
  $sqlFile = Join-Path ([System.IO.Path]::GetTempPath()) ('attendance-restore-{0}.sql' -f [guid]::NewGuid())
  ($Sql -join "`r`n") | Set-Content -LiteralPath $sqlFile -Encoding UTF8
  $arguments += @('-f', $sqlFile)

  $previousPreference = $ErrorActionPreference
  try {
    $env:PGPASSWORD = $admin.Password
    # PostgreSQL NOTICEs arrive on stderr. Keep them non-terminating so the
    # real exit code decides success/failure.
    $ErrorActionPreference = 'Continue'
    $output = & $psql @arguments 2>&1
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousPreference
    Remove-Item -LiteralPath $sqlFile -Force -ErrorAction SilentlyContinue
  }

  if ($exitCode -ne 0) {
    $detail = Protect-LogText -Text (($output | Out-String).Trim()) -Password $admin.Password
    throw "psql failed on database '$Database' (exit $exitCode). $detail"
  }
  return @($output)
}

function Get-RowCounts {
  param([string]$Database)

  $query = @'
SELECT 'Student', count(*) FROM "Student"
UNION ALL SELECT 'Section', count(*) FROM "Section"
UNION ALL SELECT 'Lecture', count(*) FROM "Lecture"
UNION ALL SELECT 'AttendanceRecord', count(*) FROM "AttendanceRecord"
UNION ALL SELECT 'StudentQrToken', count(*) FROM "StudentQrToken"
UNION ALL SELECT 'StaffUser', count(*) FROM "StaffUser"
UNION ALL SELECT 'AuditLog', count(*) FROM "AuditLog"
UNION ALL SELECT 'SystemSetting', count(*) FROM "SystemSetting"
UNION ALL SELECT '_prisma_migrations', count(*) FROM "_prisma_migrations";
'@

  $counts = @{}
  $lines = Invoke-Psql -Database $Database -Sql @($query) -TuplesOnly
  foreach ($line in $lines) {
    $text = [string]$line
    if ([string]::IsNullOrWhiteSpace($text)) { continue }
    $parts = $text.Split('|')
    if ($parts.Count -ne 2) { continue }
    $counts[$parts[0]] = [int]$parts[1]
  }
  return $counts
}

function Get-StructureChecks {
  param([string]$Database)

  $query = @'
SELECT 'foreign_keys', count(*) FROM pg_constraint WHERE contype = 'f' AND connamespace = 'public'::regnamespace
UNION ALL SELECT 'indexes', count(*) FROM pg_indexes WHERE schemaname = 'public'
UNION ALL SELECT 'orphan_attendance_lecture', count(*) FROM "AttendanceRecord" a LEFT JOIN "Lecture" l ON l.id = a."lectureId" WHERE l.id IS NULL
UNION ALL SELECT 'orphan_attendance_student', count(*) FROM "AttendanceRecord" a LEFT JOIN "Student" s ON s.id = a."studentId" WHERE a."studentId" IS NOT NULL AND s.id IS NULL
UNION ALL SELECT 'orphan_qr_student', count(*) FROM "StudentQrToken" q LEFT JOIN "Student" s ON s.id = q."studentId" WHERE s.id IS NULL
UNION ALL SELECT 'duplicate_student_token', count(*) FROM (SELECT token FROM "StudentQrToken" GROUP BY token HAVING count(*) > 1) d
UNION ALL SELECT 'duplicate_lecture_qr', count(*) FROM (SELECT "qrToken" FROM "Lecture" GROUP BY "qrToken" HAVING count(*) > 1) d
UNION ALL SELECT 'students_with_multiple_active_qr', count(*) FROM (SELECT "studentId" FROM "StudentQrToken" WHERE "revokedAt" IS NULL GROUP BY "studentId" HAVING count(*) > 1) d;
'@

  $checks = @{}
  $lines = Invoke-Psql -Database $Database -Sql @($query) -TuplesOnly
  foreach ($line in $lines) {
    $text = [string]$line
    if ([string]::IsNullOrWhiteSpace($text)) { continue }
    $parts = $text.Split('|')
    if ($parts.Count -ne 2) { continue }
    $checks[$parts[0]] = [int]$parts[1]
  }
  return $checks
}

$sourceCounts = $null
$sourceChecks = $null
$targetCounts = $null
$targetChecks = $null
$result = 'FAILED'

try {
  Add-Report ('Restore test: {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
  Add-Report ('Backup file: {0}' -f $BackupFile)
  Add-Report ('Backup size: {0} MB' -f [Math]::Round($backupInfo.Length / 1MB, 2))
  Add-Report ('Backup SHA256: {0}' -f $backupSha256)
  Add-Report ('Source database (read-only checks): {0}' -f $source.Database)
  Add-Report ('Test database: {0}' -f $TestDatabaseName)
  Add-Report ''

  Add-Report 'Reading source counts...'
  $sourceCounts = Get-RowCounts -Database $source.Database
  $sourceChecks = Get-StructureChecks -Database $source.Database
  foreach ($key in ($sourceCounts.Keys | Sort-Object)) {
    Add-Report ("  source {0}={1}" -f $key, $sourceCounts[$key])
  }
  Add-Report ''

  Add-Report 'Creating empty test database...'
  Invoke-Psql -Database 'postgres' -Sql @(
    ('DROP DATABASE IF EXISTS "{0}";' -f $TestDatabaseName),
    ('CREATE DATABASE "{0}";' -f $TestDatabaseName)
  ) | Out-Null
  $targetCreated = $true

  Add-Report 'Restoring custom-format dump...'
  $previousPreference = $ErrorActionPreference
  $env:PGPASSWORD = $admin.Password
  try {
    $ErrorActionPreference = 'Continue'
    $restoreOutput = & $pgRestore `
      --host $admin.Host `
      --port $admin.Port `
      --username $admin.User `
      --dbname $TestDatabaseName `
      --no-owner `
      --no-privileges `
      --single-transaction `
      --exit-on-error `
      $BackupFile 2>&1
    $restoreExit = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousPreference
    if ($null -eq $oldPassword) { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue } else { $env:PGPASSWORD = $oldPassword }
  }

  if ($restoreExit -ne 0) {
    $detail = Protect-LogText -Text (($restoreOutput | Out-String).Trim()) -Password $admin.Password
    throw "pg_restore failed (exit $restoreExit). $detail"
  }

  Add-Report 'Restore command succeeded.'
  Add-Report ''

  Add-Report 'Reading restored counts...'
  $targetCounts = Get-RowCounts -Database $TestDatabaseName
  $targetChecks = Get-StructureChecks -Database $TestDatabaseName

  $mismatches = New-Object System.Collections.Generic.List[string]
  foreach ($key in ($sourceCounts.Keys | Sort-Object)) {
    $sourceValue = $sourceCounts[$key]
    $targetValue = $targetCounts[$key]
    $status = 'OK'
    if ($null -eq $targetValue) {
      $status = 'MISSING'
      $mismatches.Add("$key missing in restored database") | Out-Null
    } elseif ($sourceValue -ne $targetValue) {
      $status = 'MISMATCH'
      $mismatches.Add("$key source=$sourceValue restored=$targetValue") | Out-Null
    }
    Add-Report ("  {0}: source={1} restored={2} [{3}]" -f $key, $sourceValue, $targetValue, $status)
  }

  Add-Report ''
  Add-Report 'Structure and data-integrity checks:'
  foreach ($key in ($targetChecks.Keys | Sort-Object)) {
    Add-Report ("  {0}={1}" -f $key, $targetChecks[$key])
  }

  $mustBeZero = @(
    'orphan_attendance_lecture',
    'orphan_attendance_student',
    'orphan_qr_student',
    'duplicate_student_token',
    'duplicate_lecture_qr'
  )
  foreach ($key in $mustBeZero) {
    if ($null -eq $targetChecks[$key] -or $targetChecks[$key] -ne 0) {
      $mismatches.Add("integrity check $key is not zero") | Out-Null
    }
  }

  foreach ($key in @('foreign_keys', 'indexes')) {
    if ($sourceChecks[$key] -ne $targetChecks[$key]) {
      $mismatches.Add("$key source=$($sourceChecks[$key]) restored=$($targetChecks[$key])") | Out-Null
    }
  }

  if ($targetChecks['students_with_multiple_active_qr'] -gt 0) {
    Add-Report ("  WARNING: {0} students have multiple active QR tokens (reported, not modified)." -f $targetChecks['students_with_multiple_active_qr'])
  }

  Add-Report ''
  if ($mismatches.Count -gt 0) {
    Add-Report 'RESULT: FAILED'
    foreach ($mismatch in $mismatches) {
      Add-Report ("  - {0}" -f $mismatch)
    }
    $result = 'FAILED'
  } else {
    Add-Report 'RESULT: PASS - restored database matches the source and integrity checks are clean.'
    $result = 'PASS'
  }
} catch {
  $safeMessage = Protect-LogText -Text $_.Exception.Message -Password $admin.Password
  Add-Report ''
  Add-Report ("RESULT: FAILED - {0}" -f $safeMessage)
  $result = 'FAILED'
} finally {
  if ($null -eq $oldPassword) { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue } else { $env:PGPASSWORD = $oldPassword }

  if ($targetCreated -and -not $KeepTestDatabase) {
    try {
      Invoke-Psql -Database 'postgres' -Sql @(
        ('DROP DATABASE IF EXISTS "{0}";' -f $TestDatabaseName)
      ) | Out-Null
      Add-Report ("Dropped test database: {0}" -f $TestDatabaseName)
    } catch {
      Add-Report ("WARNING: could not drop test database {0}: {1}" -f $TestDatabaseName, $_.Exception.Message)
    }
  } elseif ($targetCreated) {
    Add-Report ("Test database kept for inspection: {0}" -f $TestDatabaseName)
  }

  Add-Report ("Finished: {0}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
  try {
    $report | Set-Content -LiteralPath $ReportPath -Encoding UTF8
    Write-Host ("Report written to: {0}" -f $ReportPath)
  } catch {
    Write-Warning ("Could not write report file: {0}" -f $_.Exception.Message)
  }
}

if ($result -eq 'PASS') { exit 0 } else { exit 1 }
