$ErrorActionPreference = "Stop"
$project = Join-Path $PSScriptRoot "..\SampleWinFormsTarget\SampleWinFormsTarget.csproj"
$out = Join-Path $PSScriptRoot "..\publish\sample"
dotnet publish $project -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o $out
Write-Host "Published sample WinForms target to $out" -ForegroundColor Green
