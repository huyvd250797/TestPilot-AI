param(
  [Parameter(Mandatory=$true)][string]$ControlPlaneUrl,
  [Parameter(Mandatory=$true)][string]$SharedSecret,
  [string]$RunnerName = $env:COMPUTERNAME,
  [string]$ExePath = ""
)
$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($ExePath)) {
  $ExePath = Join-Path $PSScriptRoot "..\publish\win-x64\TestPilot.WindowsAgent.exe"
}
$ExePath = [System.IO.Path]::GetFullPath($ExePath)
if (!(Test-Path $ExePath)) { throw "Agent executable not found: $ExePath. Run .\build.ps1 first." }

[Environment]::SetEnvironmentVariable("TESTPILOT_CONTROL_PLANE_URL", $ControlPlaneUrl.TrimEnd('/'), "User")
[Environment]::SetEnvironmentVariable("TESTPILOT_RUNNER_SHARED_SECRET", $SharedSecret, "User")
[Environment]::SetEnvironmentVariable("TESTPILOT_RUNNER_NAME", $RunnerName, "User")

# UI automation must run in the interactive user's desktop session. This task runs only on logon.
$task = "TestPilot Windows Agent"
$action = New-ScheduledTaskAction -Execute $ExePath
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 10 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName $task -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null

# Current PowerShell process does not automatically receive user env changes, so set them for immediate launch too.
$env:TESTPILOT_CONTROL_PLANE_URL = $ControlPlaneUrl.TrimEnd('/')
$env:TESTPILOT_RUNNER_SHARED_SECRET = $SharedSecret
$env:TESTPILOT_RUNNER_NAME = $RunnerName
Start-Process -FilePath $ExePath
Write-Host "Installed and started TestPilot Windows Agent. Keep this Windows session logged in and unlocked." -ForegroundColor Green
