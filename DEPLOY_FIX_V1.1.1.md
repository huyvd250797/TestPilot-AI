# TestPilot AI V1.1.1 — Vercel deploy hotfix

## Root cause

Stagehand v4 was imported by a Next.js App Route without the Vercel/Next.js server bundling configuration required by Stagehand's official Next.js quickstart. Next.js attempted to bundle Stagehand internals and failed during `next build`.

## Fixes

1. `next.config.ts`
   - Adds `serverExternalPackages` for `@browserbasehq/stagehand` and `@browserbasehq/sdk`.
   - Adds `outputFileTracingIncludes` for the Stagehand browser extension zip used by `/api/runs/execute`.

2. `lib/web-runner.ts`
   - Uses Stagehand v4 `browserbase.launch()` so the Stagehand extension is provisioned for each cloud browser.
   - Uses `zod/v4`.
   - Avoids embedding username/password values into AI instructions during the login helper.

3. Dependency alignment
   - Pins Stagehand `4.1.0`.
   - Pins Browserbase SDK `2.21.0`.
   - Aligns Zod to `4.4.3`.

4. Configuration
   - Adds `BROWSERBASE_PROJECT_ID` to `.env.example` and the Setup page.

## Vercel variables

```env
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.6
BROWSERBASE_API_KEY=...
BROWSERBASE_PROJECT_ID=...
```

After pushing this patch, trigger a fresh Vercel deployment. If Vercel reuses a stale dependency cache, use **Redeploy** with build cache disabled once.
