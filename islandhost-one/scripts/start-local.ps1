$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
 $toolsRoot = Join-Path (Split-Path $project -Parent) '.tools'
 $portable = Get-ChildItem -LiteralPath $toolsRoot -Directory -Filter 'node-*-win-x64' -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
 if (-not $portable) { throw 'Install Node.js 22 or newer first.' }
 $env:PATH = $portable.FullName + ';' + $env:PATH
}
Set-Location -LiteralPath $project
& npm.cmd run dev
exit $LASTEXITCODE
