# TestPilot AI V1.1 — Web Execution MVP

**TestPilot AI** converts User Stories + Acceptance Criteria into executable black-box tests, runs them in an isolated cloud browser, captures outputs and screenshots, and produces auditable PASS / FAIL / BLOCKED evidence.

## What changed from V1.0

V1.0 was the control-plane foundation. V1.1 adds the first real execution path:

- Project + target environment persistence with Supabase.
- AI test planning with action / capture / verify steps.
- Real isolated cloud Chromium execution.
- Browser agent actions through Browserbase + Stagehand.
- Runtime variables: capture system-generated values and reuse `${variable}` in later steps.
- Step screenshots uploaded to Supabase Storage when configured.
- Browserbase session replay URL stored with the run.
- PASS / FAIL / BLOCKED execution status.
- Persisted execution steps and runtime context.
- Human-review-oriented replay UI foundation.

## Architecture

```text
Vercel / Next.js 16
   |
   +-- OpenAI -> Requirement/Test Planner
   |
   +-- Supabase -> projects, ACs, cases, runs, evidence metadata
   |
   +-- Browserbase cloud browser
         |
         +-- Stagehand v4 -> natural-language act/extract
         |
         +-- Target UAT / staging web app
```

The browser is remote. TestPilot does **not** control your local mouse/keyboard/browser.

## Deploy: GitHub -> Vercel

1. Push this repository to GitHub.
2. Create a Supabase project.
3. Run `supabase/schema.sql` in Supabase SQL Editor.
4. Create a Browserbase account/API key.
5. Create an OpenAI API key for the test planner.
6. Import the GitHub repository into Vercel.
7. Add the environment variables below.
8. Deploy.
9. Open `/api/health` and confirm the services you want show `true`.

### Vercel Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.6
BROWSERBASE_API_KEY=...
```

`SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY` and `BROWSERBASE_API_KEY` are server-only secrets.

## First run

1. Open **Projects** and register the UAT target.
2. Open **Test Design**.
3. Enter Target URL, User Story, and Acceptance Criteria.
4. Generate the executable plan.
5. Pick a case and press **Run**.
6. If login is required, enter a dedicated test account on the Web Runner screen.
7. Start the isolated run.
8. Review each action/capture/verify step and screenshot.
9. Open the Browserbase session replay for the full browser recording.

## Test step model

```json
{
  "kind": "capture",
  "instruction": "Extract the generated Customer No from the success state",
  "captureKey": "customerNo"
}
```

Later steps can use:

```text
Search for ${customerNo} in Customer List
```

This supports stateful business journeys rather than isolated clicks.

## Safety

V1.1 is intended for **UAT/staging/test tenants**. The runner can create or modify real data in the target system. Use dedicated test accounts and environments. Do not point autonomous execution at Production until environment policies, approval gates, secret redaction, and destructive-action controls are hardened.

Login credentials entered on `/runs/new` are sent only to the server-side runner request and are not intentionally persisted by that page. For enterprise use, move credentials to a dedicated secret manager / Browserbase identity flow.

## Known V1.1 boundaries

- Windows Forms execution is **not** included yet; that is V1.2 Windows Runner.
- The planner can fall back to deterministic demo cases if OpenAI is not configured.
- Real browser execution requires `BROWSERBASE_API_KEY`.
- Stagehand provides semantic/self-healing interaction, but human review is still required for AI-generated tests.
- Supabase evidence bucket is public in this MVP. Switch to a private bucket + signed URLs before using sensitive screenshots.
- Long, highly complex suites should later move behind an async orchestration/queue layer instead of one request per case.

## Recommended next version

**V1.2 — Windows Runner + hardened execution**

- Windows VM agent for WinForms.
- Windows UI Automation first, vision fallback second.
- Private evidence storage + signed URLs.
- Stored encrypted test credentials / identity management.
- Async run queue and parallel runner pool.
- QA review persistence and test-case revision workflow.
