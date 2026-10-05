param([string]$Runtime = "win-x64")
$ErrorActionPreference = "Stop"
$project = Join-Path $PSScriptRoot "..\TestPilot.WindowsAgent\TestPilot.WindowsAgent.csproj"
$out = Join-Path $PSScriptRoot "..\publish\$Runtime"
dotnet publish $project -c Release -r $Runtime --self-contained true -p:PublishSingleFile=true -o $out
Write-Host "Published TestPilot Windows Agent to $out" -ForegroundColor Green
