# TestPilot AI V1.3 — Application Memory & UI Map

TestPilot AI is an AI-powered black-box QA platform for real Web and Windows Forms applications. V1.3 adds persistent application knowledge so runners do not need to rediscover the same UI from scratch on every test.

## V1.3 architecture

```text
User Story + AC
      ↓
AI Test Plan
      ↓
Web Runner / Windows Runner
      ↓
Observe current UI
      ↓
Application Memory lookup
      ├─ Known screen
      ├─ Known useful controls
      └─ Known navigation edges
      ↓
Execute + Verify
      ↓
Memory writer
      ├─ fingerprint / dedup
      ├─ screen versioning
      ├─ control confidence
      └─ navigation graph
```

## What V1.3 adds

- Canonical Application Screens for Web and Windows.
- Semantic screen identity + SHA-256 fingerprint.
- Repeated identical screens only update counters; they do not create duplicate screen rows.
- Screen version history only when the UI fingerprint changes.
- Useful-control filtering (buttons, inputs, menus, tabs, grids, etc.).
- Navigation graph learned from successful execution transitions.
- Confidence, seen count and successful-use count.
- Application Memory dashboard at `/memory`.
- Memory context is fed back into the Windows AI resolver as advisory knowledge.
- Execution steps link back to the learned screen and fingerprint.
- Stale-screen marking and old-version pruning.
- PostgreSQL stores metadata only; screenshot/video binary remains in Supabase Storage.

## Existing V1.2 capabilities remain

- Next.js 16 / React 19 / TypeScript / Vercel control plane.
- Browserbase + Stagehand isolated Web Runner.
- .NET 10 + FlaUI UIA3 Windows Agent.
- Runner queue, heartbeat and ONLINE/BUSY/OFFLINE state.
- Action / capture / verify execution model.
- Runtime variable capture/reuse.
- Screenshot evidence, persisted execution history and QA review.
- PASS / FAIL / BLOCKED.

## Upgrade from V1.2

1. Push this source to the existing GitHub repository.
2. Run `supabase/migrations/v1.3-application-memory.sql` in Supabase SQL Editor.
3. Redeploy Vercel.
4. Rebuild/restart the V1.3 Windows Agent.
5. Run tests with a Project ID.
6. Open `/memory` to inspect learned screens and navigation.

See `DEPLOY_V1.3.md` for details.

## Environment variables

No new secret is required by V1.3. Keep the existing V1.2 variables:

```env
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.6
BROWSERBASE_API_KEY=...
BROWSERBASE_PROJECT_ID=...
RUNNER_SHARED_SECRET=...
```

## Database growth policy

Application Memory grows primarily with **unique canonical screens and actual UI versions**, not with the number of test runs. Repeated visits update counters. Evidence binaries are kept out of PostgreSQL.

## Next version

**V1.4 — Reusable Skills & Teach Mode** will let QA demonstrate a flow once and publish it as an approved parameterized skill. See `NEXT_VERSION.md`.
