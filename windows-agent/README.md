# TestPilot AI V1.2 — Windows Agent

The Windows Agent executes authorized WinForms black-box tests inside a dedicated Windows VM. It does **not** run on Vercel and it must run in an interactive, logged-in desktop session.

## Architecture

`Vercel Control Plane → Windows job queue → Windows Agent → FlaUI UIA3 → WinForms app`

For each natural-language test step the agent captures the UI Automation tree, asks TestPilot's server-side AI resolver for one semantic next action, executes it, re-observes the UI, and stops when the step is complete or blocked. Screenshots and Expected/Actual results are posted back to the Vercel API.

## Requirements

- Windows 10/11 or Windows Server with Desktop Experience.
- Dedicated UAT/test user account.
- Desktop session stays logged in and unlocked while execution is active.
- Network access from the VM to your TestPilot Vercel URL.
- To build: .NET 10 SDK. The `build.ps1` output is self-contained, so the deployed VM executable does not require a separately installed .NET runtime.

## Build on Windows

```powershell
cd windows-agent\scripts
.\build.ps1
```

Output:

`windows-agent\publish\win-x64\TestPilot.WindowsAgent.exe`

## Configure Vercel

Create a long random `RUNNER_SHARED_SECRET` in Vercel. Example generation in PowerShell:

```powershell
-join ((48..57)+(65..90)+(97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
```

Redeploy TestPilot after adding the variable.

## Install on the VM

Run from the **dedicated interactive test user**:

```powershell
.\install-startup.ps1 `
  -ControlPlaneUrl "https://your-testpilot.vercel.app" `
  -SharedSecret "PASTE_THE_SAME_RUNNER_SHARED_SECRET" `
  -RunnerName "WIN-UAT-01"
```

The script stores user-scoped environment variables and creates an **At Log On / Interactive** scheduled task. This is deliberate: Windows desktop automation cannot reliably control WinForms from a non-interactive service session.

Then open:

`https://your-testpilot.vercel.app/runners`

The machine should become `ONLINE` within seconds.

## V1.2 supported actions

- Launch `.exe` with optional arguments.
- Observe UIA3 tree.
- Semantic target matching using AutomationId → Name → ControlType.
- Click.
- Clear/type text.
- Select ComboBox/List items.
- Wait/re-observe.
- Capture visible UI values into runtime variables.
- Verify visible UI state.
- Screenshot every execution step.
- PASS / FAIL / BLOCKED reporting.

## Guardrails

- Maximum 10 AI observe/action iterations per `act` step.
- No pixel-coordinate action in V1.2; if UIA does not expose a usable target, the case becomes `BLOCKED` instead of clicking blindly.
- Passwords/secrets are not part of the Windows MVP payload.
- Use a staging/UAT environment and dedicated test data.

Vision fallback, live-control takeover, video recording, custom-control adapters and reusable application skills are planned for later versions.

## Optional smoke-test target

A tiny WinForms customer app is included in `SampleWinFormsTarget` so you can validate the runner before pointing it at your real application:

```powershell
cd windows-agent\scripts
.\build-sample.ps1
```

Then use this Application Path in TestPilot:

`windows-agent\publish\sample\SampleWinFormsTarget.exe`

Suggested ACs:

- Customer Code is required.
- Customer Code must be unique.
- After successful creation, a generated Customer Number is shown.
- Created customer appears in Customer List.
