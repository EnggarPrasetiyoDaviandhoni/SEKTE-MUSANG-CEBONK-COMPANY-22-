param(
 [Parameter(Mandatory=$true)][string]$DataFolder,
 [string]$MetaEditor = ''
)
$ErrorActionPreference = 'Stop'
$package = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$source = Join-Path $package 'MQL5'
if (!(Test-Path $source)) { $source = (Resolve-Path (Join-Path $package '../../MQL5')).Path }
$target = Join-Path $DataFolder 'MQL5'
foreach ($folder in @('Indicators','Scripts','Include','Files')) {
 New-Item -ItemType Directory -Force (Join-Path $target $folder) | Out-Null
}
Copy-Item (Join-Path $source 'Include/CebonkKillzone') (Join-Path $target 'Include') -Recurse -Force
$programs = @('Indicators/CEBONK_KILLZONE_ASTROLOGY_v1.01.mq5','Scripts/CEBONK_KILLZONE_WEBREQUEST_v1.01.mq5')
foreach ($relative in $programs) {
 Copy-Item (Join-Path $source $relative) (Join-Path $target $relative) -Force
}
if ($MetaEditor -ne '') {
 if (!(Test-Path $MetaEditor)) { throw 'MetaEditor executable does not exist.' }
 foreach ($relative in $programs) {
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
}
Write-Host 'Installed. Compile both programs with MetaEditor F7 if not compiled above.'
Write-Host 'Allow https://raw.githubusercontent.com in MT5 WebRequest settings. Run the downloader from Scripts, then attach the indicator.'
