param(
 [Parameter(Mandatory=$true)][string]$DataFolder,
 [string]$MetaEditor = ''
)
$ErrorActionPreference = 'Stop'
$package = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$source = Join-Path $package 'MQL5'
if (!(Test-Path $source)) { $source = (Resolve-Path (Join-Path $package '../../MQL5')).Path }
$target = Join-Path $DataFolder 'MQL5'
foreach ($folder in @('Indicators','Include','Files')) {
 New-Item -ItemType Directory -Force (Join-Path $target $folder) | Out-Null
}
Copy-Item (Join-Path $source 'Include/CebonkKillzone') (Join-Path $target 'Include') -Recurse -Force
$relative = 'Indicators/CEBONK_KILLZONE_ASTROLOGY_v1.00.mq5'
Copy-Item (Join-Path $source $relative) (Join-Path $target 'Indicators') -Force
$forecast = Join-Path $target 'Files/cebonk-killzone-forecast-v1.json'
# Preserve a more recently calculated local forecast during reinstall.
if (!(Test-Path $forecast)) { Copy-Item (Join-Path $source 'Files/cebonk-killzone-forecast-v1.json') $forecast }
if ($MetaEditor -ne '') {
 if (!(Test-Path $MetaEditor)) { throw 'MetaEditor executable does not exist.' }
 $expert = (Resolve-Path (Join-Path $target $relative)).Path
 $log = [IO.Path]::ChangeExtension($expert, '.compile.log')
 $binary = [IO.Path]::ChangeExtension($expert, '.ex5')
 $started = Get-Date
 if (Test-Path $log) { Remove-Item $log }
 $arguments = @('/compile:"' + $expert + '"', '/inc:"' + $target + '"', '/log:"' + $log + '"')
 Start-Process -FilePath $MetaEditor -ArgumentList $arguments -Wait
 if (!(Test-Path $log)) { throw "Compiler log missing: $log" }
 $result = Get-Content $log -Raw
 if ($result -notmatch '(?im)\b0 errors?\b' -or !(Test-Path $binary) -or (Get-Item $binary).LastWriteTime -lt $started.AddSeconds(-2)) {
  Write-Host $result
  throw 'Compilation not verified: a zero-error log and fresh EX5 are required.'
 }
 Write-Host "Verified compiler log and fresh EX5: $binary"
}
Write-Host 'Installed. Compile with MetaEditor F7 if not compiled above, then attach from Navigator > Indicators.'
