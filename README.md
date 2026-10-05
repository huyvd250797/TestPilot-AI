# TestPilot AI V1.2 — Windows Forms Runner MVP

TestPilot AI is an AI-powered black-box QA platform that turns User Stories and Acceptance Criteria into executable test cases, runs them against real Web or Windows Forms UIs, captures dynamic output/state, and preserves step-by-step evidence for human review.

## What V1.2 adds

V1.2 keeps the V1.1.1 cloud Web Runner and adds a real Windows Forms execution path:

```text
User Story + AC
      ↓
AI Test Plan
      ↓
TestPilot Vercel Control Plane
      ├─ Web → Browserbase + Stagehand → target website
      └─ Windows → Supabase job queue → Windows Agent → FlaUI UIA3 → WinForms app
                                                        ↓
                                              Screenshot / Actual / Capture
                                                        ↓
                                              PASS / FAIL / BLOCKED
                                                        ↓
                                                   QA Review
```

The Windows Agent runs only inside a dedicated interactive Windows test session. It does not touch the operator's local mouse/keyboard/desktop.

## Technology

### Control plane

- Next.js 16.3.8
- React 19.2
- TypeScript
- Node.js 24 on Vercel
- Supabase PostgreSQL + Storage
- OpenAI Responses API

### Web execution

- Browserbase isolated Chromium
- Stagehand 4.1.0

### Windows execution

- .NET 10 LTS (`net10.0-windows`)
- FlaUI Core/UIA3 5.0.0
- Interactive Windows VM agent
- Semantic selectors: AutomationId → Name → ControlType

## V1.2 capabilities

- Project/environment management for Web and Windows applications.
- User Story + Acceptance Criteria planning.
- AC Direct / AI Derived / AI Suggested / Assumption classification.
- Test data generation and runtime variable capture/reuse.
- Web action/capture/verify through isolated cloud Chromium.
- Windows action/capture/verify through dedicated Windows VM.
- Windows Agent registration + heartbeat + ONLINE/BUSY/OFFLINE state.
- Persistent Windows job queue.
- Observe → resolve one semantic action → execute → re-observe loop.
- UIA actions: click, type, clear, select, wait.
- Screenshot evidence after every Windows step.
- Expected vs Actual.
- PASS / FAIL / BLOCKED.
- Persisted run viewer and human QA review.

## 1. Deploy the Vercel control plane

Push this repository to GitHub and import it into Vercel.

Use Node.js 24.x.

Configure:

```env
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.6

BROWSERBASE_API_KEY=...
BROWSERBASE_PROJECT_ID=...

RUNNER_SHARED_SECRET=use-a-long-random-secret
```

`RUNNER_SHARED_SECRET` authenticates the Windows Agent to TestPilot's server API. Never prefix it with `NEXT_PUBLIC_`.

## 2. Upgrade Supabase

Open Supabase SQL Editor and run the complete file:

```text
supabase/schema.sql
```

It is safe to run after V1.1.1: the V1.2 migration uses `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` for the new runner infrastructure.

New V1.2 persistence includes:

- `runner_agents`
- `runner_jobs`
- `runner_job_events`
- `test_runs.platform`
- `test_runs.runner_id`

## 3. Verify Vercel

Open:

```text
https://YOUR_DOMAIN/api/health
```

Expected V1.2 fields include:

```json
{
  "name": "TestPilot AI",
  "version": "1.2.0",
  "services": {
    "supabase": true,
    "planner": true,
    "webRunner": true,
    "windowsControlPlane": true
  }
}
```

## 4. Prepare a Windows Test VM

Use a dedicated Windows 10/11 VM or Windows Server with Desktop Experience and a dedicated UAT user account.

Important: keep the test user **logged in and the desktop unlocked** during UI execution. The UI executor intentionally runs as an interactive startup task, not as a Session-0 Windows Service.

Copy the `windows-agent` folder to the VM.

### Build the agent

Install the .NET 10 SDK, then:

```powershell
cd windows-agent\scripts
.\build.ps1
```

This publishes a self-contained binary:

```text
windows-agent\publish\win-x64\TestPilot.WindowsAgent.exe
```

### Install for the test user

```powershell
.\install-startup.ps1 `
  -ControlPlaneUrl "https://YOUR_DOMAIN" `
  -SharedSecret "THE_SAME_RUNNER_SHARED_SECRET_FROM_VERCEL" `
  -RunnerName "WIN-UAT-01"
```

Open:

```text
https://YOUR_DOMAIN/runners
```

The VM should show `ONLINE`.

More agent details: `windows-agent/README.md`. A small `SampleWinFormsTarget` is included for runner smoke testing.

## 5. Run the first Windows test

1. Open **Projects**.
2. Add a `Windows Forms` environment.
3. Enter the executable path as it exists on the VM, e.g. `C:\Apps\ERP-UAT\ERP.exe`.
4. Open **Test Design** and choose `Windows Forms`.
5. Enter User Story + AC.
6. Generate the plan.
7. Click `Run Windows` on a case.
8. Queue the run.
9. An ONLINE runner claims it.
10. Open the persisted run to review screenshot evidence, Expected vs Actual and runtime captures.

## Windows semantic execution

For each `act` step V1.2 does not execute a blind pre-recorded coordinate sequence. It loops:

```text
Observe current UIA tree
       ↓
Server-side AI selects ONE safe semantic action
       ↓
Find control by AutomationId / Name / ControlType
       ↓
Execute with FlaUI
       ↓
Observe again
       ↓
DONE or next action
```

There is a maximum of 10 action iterations per test step. If a reliable target cannot be found, the step becomes `BLOCKED` rather than clicking arbitrary coordinates.

## Runtime capture example

A generated case can contain:

```text
CAPTURE: Read the generated Customer Number
captureKey: customerNo
```

If the UI contains `CUS000582`, the Windows Agent stores:

```json
{
  "customerNo": "CUS000582"
}
```

A later step can reference:

```text
Search for ${customerNo} in Customer List
```

## Security / safety defaults

- Use UAT/Staging, not Production.
- Use dedicated test users and test data.
- Windows Agent never receives Supabase service-role or OpenAI keys.
- The Agent only receives the shared runner secret; OpenAI resolution remains server-side on Vercel.
- TestPilot does not use pixel-coordinate clicks in V1.2.
- If the application exposes custom controls poorly through UI Automation, the case becomes `BLOCKED`; vision fallback is a later version.
- Evidence storage remains the V1.1 public MVP bucket. Switch to a private signed-URL bucket before testing sensitive data.

## Routes added in V1.2

```text
GET  /api/runners
POST /api/runner/register
POST /api/runner/heartbeat
GET  /api/runner/jobs
POST /api/runner/resolve-action
POST /api/runner/jobs/:id/step
POST /api/runner/jobs/:id/complete
```

## Repository layout

```text
app/                    Next.js control plane
lib/                    contracts, Supabase, Web Runner, runner auth
supabase/schema.sql     base schema + V1.2 runner migration
windows-agent/
  TestPilot.WindowsAgent/
    Models/
    Services/
    Program.cs
  scripts/
    build.ps1
    install-startup.ps1
    uninstall-startup.ps1
```

## What is intentionally deferred

- Vision fallback for custom/non-accessible WinForms controls.
- Live video stream / Take Control.
- Full video recording for Windows runs.
- Attach-to-running-process selection UI.
- OTP/SSO human handoff workflow.
- Reusable Application Memory / skills.
- Teach Mode.
- Self-healing flow versioning.
- Parallel runner affinity/pools.
- Automatic cleanup flows.

Those are natural follow-ups after the Windows UIA MVP is proven against the real application.
