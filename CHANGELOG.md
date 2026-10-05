# Changelog

## 1.1.1 — Vercel Build Fix

- Added `serverExternalPackages` for Stagehand and Browserbase SDK.
- Added output-file tracing for the Stagehand v4 browser extension.
- Switched the Web Runner to Stagehand v4 `browserbase.launch()`.
- Aligned Zod to v4 and pinned Stagehand/Browserbase dependencies.
- Added optional/recommended `BROWSERBASE_PROJECT_ID` configuration.
- Kept login secrets out of natural-language AI instructions where possible.

## 1.1.0 — Web Execution MVP

- Rebranded the application to TestPilot AI.
- Added Projects & Web Environments persistence.
- Expanded AI plans into executable action / capture / verify steps.
- Added isolated Browserbase cloud-browser execution with Stagehand v4.
- Added runtime variable capture and reuse across steps.
- Added screenshot evidence with Supabase Storage fallback.
- Added run persistence, Browserbase session IDs, replay links, and execution step logs.
- Added persisted run viewer and QA Review decisions.
- Added Vercel-ready health/configuration flow.
- Retained an external runner contract for the upcoming Windows Runner.
