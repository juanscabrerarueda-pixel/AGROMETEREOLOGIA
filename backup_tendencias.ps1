param(
  [string]$Target = 'backups'
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$timestamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$destRoot = Join-Path $root $Target
$dest = Join-Path $destRoot $timestamp

New-Item -ItemType Directory -Path $dest -Force | Out-Null

$files = @('Index.html', 'app.html', 'theme.html', 'Code.gs', 'preview_tendencias.cmd')
foreach ($name in $files) {
  $src = Join-Path $root $name
  if (Test-Path $src) {
    Copy-Item -Path $src -Destination $dest -Force
  }
}

$backupLog = Join-Path $dest 'README.txt'
"Backup generado el $timestamp" | Set-Content -Path $backupLog -Encoding UTF8
"Archivos copiados:" | Add-Content -Path $backupLog
$files | ForEach-Object { Add-Content -Path $backupLog -Value "- $_" }

Write-Host "Respaldo creado en $dest"
