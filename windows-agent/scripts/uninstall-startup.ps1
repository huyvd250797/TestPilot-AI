$ErrorActionPreference = "SilentlyContinue"
Unregister-ScheduledTask -TaskName "TestPilot Windows Agent" -Confirm:$false
Get-Process "TestPilot.WindowsAgent" | Stop-Process -Force
Write-Host "TestPilot Windows Agent startup task removed." -ForegroundColor Yellow
