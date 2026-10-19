param([Parameter(Mandatory=$true)][string]$DataFolder)
$ErrorActionPreference = 'Stop'
$node = Get-Command node -ErrorAction SilentlyContinue
if (!$node) { throw 'Node.js 20 or newer is required to recalculate the forecast. The bundled initial forecast does not require Node.' }
$generator = Join-Path $PSScriptRoot '../generate.mjs'
$output = Join-Path $DataFolder 'MQL5/Files/cebonk-killzone-forecast-v1.json'
& $node.Source $generator --output $output
if ($LASTEXITCODE -ne 0) { throw 'Forecast calculation failed. The original file was preserved.' }
Write-Host "Forecast updated: $output"
Write-Host 'The indicator reloads the file within 15 seconds. Calculations ran locally; no EA or web API was used.'
