# Changelog

## 1.3.0 — Application Memory & UI Map

- Added canonical screen memory for Web and Windows execution.
- Added semantic screen identity, SHA-256 fingerprinting and deduplication.
- Added screen versioning only when UI fingerprints change.
- Added useful-control memory with confidence and seen counters.
- Added learned navigation graph between screens.
- Added `/memory` dashboard with screen, version, control and navigation statistics.
- Added memory maintenance for stale-screen marking and version pruning.
- Linked execution steps to `memory_screen_id` and `memory_fingerprint`.
- Fed known Windows controls/navigation back into the semantic resolver as advisory context.
- Kept binary screenshot/video data out of PostgreSQL; memory stores metadata and object-storage URLs only.
- Upgraded Windows Agent protocol/version to 1.3.0.

## 1.2.0 — Windows Forms Runner MVP

- Added .NET 10 Windows Agent with FlaUI UIA3 semantic desktop automation.
- Added runner registration, heartbeat, ONLINE/BUSY/OFFLINE state and runner dashboard.
- Added persistent Windows execution queue and job events in Supabase.
- Added Windows run dispatch from the Vercel control plane.
- Added Observe → AI Resolve → UIA Action → Re-observe loop with a 10-action guardrail per step.
- Added semantic selector matching: AutomationId → Name → ControlType.
- Added click, type, clear, select, wait, capture and visible-state verification.
- Added Windows screenshot evidence into the same execution history as Web tests.
- Added runtime-variable capture/reuse for Windows tests.
- Added Windows application targets to Projects & Environments.
- Added Windows-specific test-plan generation and run UI.
- Added interactive-session startup scripts for dedicated Windows Test VMs.
- Kept V1.1.1 Browserbase/Stagehand Web Runner intact.

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
