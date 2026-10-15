# TestPilot AI V1.3 — Application Memory & UI Map

V1.3 upgrades V1.2 without replacing the existing Supabase project or Vercel project.

## 1. Replace source and deploy

Push the V1.3 source to the same GitHub repository. Vercel can redeploy the existing project. Existing environment variables are unchanged.

## 2. Run the Supabase migration

In Supabase SQL Editor run:

```text
supabase/migrations/v1.3-application-memory.sql
```

New persistence:

- `application_memory_settings`
- `application_screens`
- `screen_versions`
- `ui_elements`
- `navigation_edges`
- `execution_steps.memory_screen_id`
- `execution_steps.memory_fingerprint`

No screenshot/video binary is stored in PostgreSQL. Memory rows only keep metadata and Storage URLs.

## 3. Rebuild the Windows Agent

The V1.3 agent sends a compact UIA snapshot after each logical step so the control plane can learn the current screen.

```powershell
cd windows-agent\scripts
.\build.ps1
```

Reinstall/restart the startup task if required. The agent should report version `1.3.0` in `/runners`.

## 4. Populate memory

Run cases with a valid Project ID. Both Web and Windows runs can learn screens.

Open:

```text
https://YOUR_DOMAIN/memory
```

Enter the Project ID and click **Load Memory**.

## Memory behavior

- Same screen + same fingerprint: update `seen_count`, `last_seen_at`, confidence and useful controls.
- Same canonical screen + changed fingerprint: create a new `screen_version`.
- Navigation between learned screens: upsert one `navigation_edge` and increase success count.
- Heavy execution screenshots/videos remain in object storage; canonical memory stores only URL references.
- `Run Memory Maintenance` marks screens stale after 180 days and keeps the latest 5 versions by default.

## Verify health

`/api/health` should report `version: 1.3.0` and `applicationMemory: true` when Supabase is configured.
