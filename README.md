# AI Black-Box QA Platform V1

Vercel-ready control plane for User Story + Acceptance Criteria → AI test plan → isolated runner contract → evidence/review.

## Stack
- Next.js 16.3.8 / React 19 / TypeScript
- Node.js 24
- Supabase PostgreSQL
- OpenAI Responses API
- External isolated runners: Playwright (Web) and Windows VM Agent (WinForms)

## Deploy directly to Vercel
1. Push this folder to GitHub.
2. Import the repository in Vercel. Framework is auto-detected as Next.js.
3. Deploy immediately: the demo UI and deterministic test planner work without secrets.
4. Create a Supabase project and execute `supabase/schema.sql` in SQL Editor.
5. Add variables from `.env.example` in Vercel → Project Settings → Environment Variables.
6. Redeploy.

No localhost is required for deployment. Local development is optional.

## Important execution architecture
Vercel hosts the control plane. Windows Forms testing **cannot** execute inside a Linux Vercel function. A Windows VM agent is registered separately and receives jobs through the runner contract. Web automation should also use an isolated runner for stable long-running/replayable execution. This prevents tests from taking over the user's current mouse, keyboard, browser, or desktop session.

## API
- `GET /api/health` deployment health
- `POST /api/plan` AI/fallback test plan
- `POST /api/runner/jobs` runner contract skeleton, protected by `x-runner-secret`

## V1 next implementation milestones
1. Persist project/story/test plan in Supabase.
2. Add auth/RBAC.
3. Implement Playwright worker and evidence upload.
4. Implement .NET Windows Agent + UI Automation.
5. Add live runner events, replay, QA review, Teach Mode, Application Memory.
