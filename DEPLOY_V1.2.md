# TestPilot AI V1.2 Upgrade Checklist

## A. Vercel

Add one new secret to the existing V1.1.1 project:

```text
RUNNER_SHARED_SECRET=<long-random-secret>
```

Keep the existing Supabase, OpenAI and Browserbase variables. Push V1.2 and let Vercel redeploy.

Verify `/api/health` reports version `1.2.0` and `windowsControlPlane: true`.

## B. Supabase

Run:

```text
supabase/migrations/v1.2-windows-runner.sql
```

Or run the full `supabase/schema.sql`.

## C. Windows Test VM

1. Keep a dedicated test user logged in/unlocked.
2. Install .NET 10 SDK for building the agent.
3. Build:

```powershell
cd windows-agent\scripts
.\build.ps1
```

4. Install interactive startup agent:

```powershell
.\install-startup.ps1 `
  -ControlPlaneUrl "https://YOUR-TESTPILOT.vercel.app" `
  -SharedSecret "SAME_SECRET_AS_VERCEL" `
  -RunnerName "WIN-UAT-01"
```

5. Open `/runners` and confirm the machine is ONLINE.

## D. Smoke test

Optional sample target:

```powershell
.\build-sample.ps1
```

Application path:

```text
...\windows-agent\publish\sample\SampleWinFormsTarget.exe
```

Use Test Design → Windows Forms and create ACs for required/unique customer code and generated customer number.
