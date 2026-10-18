param(
 [Parameter(Mandatory=$true)][string]$MetaEditor,
 [Parameter(Mandatory=$true)][string]$DataFolder
)
$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot '../MQL5'
$target = Join-Path $DataFolder 'MQL5'
if (!(Test-Path $MetaEditor)) { throw 'MetaEditor executable does not exist.' }
New-Item -ItemType Directory -Force (Join-Path $target 'Experts'), (Join-Path $target 'Include'), (Join-Path $target 'Scripts'), (Join-Path $target 'Files') | Out-Null
Copy-Item (Join-Path $source 'Include/CebonkSwing') (Join-Path $target 'Include') -Recurse -Force
Copy-Item (Join-Path $source 'Experts/CEBONK_ASTRO_SWING_BERJANGGUT_v1.10.mq5') (Join-Path $target 'Experts') -Force
Copy-Item (Join-Path $source 'Scripts/CEBONK_SWING_SELFTEST.mq5') (Join-Path $target 'Scripts') -Force
# Preserve an existing broker-verified offset table and tester archive.
foreach ($file in @('cebonk-broker-offsets.csv','swing-forecast-v2.history.jsonl')) {
 $destination = Join-Path (Join-Path $target 'Files') $file
 if (!(Test-Path $destination)) { Copy-Item (Join-Path (Join-Path $source 'Files') $file) $destination }
}
foreach ($relative in @('Experts/CEBONK_ASTRO_SWING_BERJANGGUT_v1.10.mq5','Scripts/CEBONK_SWING_SELFTEST.mq5')) {
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
  throw "Compile not verified: $relative"
 }
 Write-Host "Verified compiler log and fresh EX5: $binary"
}
