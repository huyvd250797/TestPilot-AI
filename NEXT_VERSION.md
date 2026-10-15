# Next: TestPilot AI V1.4 — Reusable Skills & Teach Mode

V1.4 will turn the UI Map learned in V1.3 into reusable, human-approved automation skills.

## Goal

A QA user can take control of an isolated Web/Windows runner, demonstrate a business flow once, then publish the recorded flow as a parameterized skill that future test plans can reuse.

## Planned scope

- Teach Mode for Web and Windows runners.
- Record semantic actions, screen transitions and postconditions during a human demonstration.
- Convert a demonstration into reusable skills such as `LOGIN_AS(role)`, `OPEN_CUSTOMER_MANAGEMENT`, `CREATE_CUSTOMER(data)`, `SEARCH_CUSTOMER(key)` and `CREATE_ORDER(customerNo, items)`.
- Skill inputs/outputs and runtime-variable binding.
- Skill versioning and approval workflow.
- Deterministic Replay Mode: prefer approved skills over fresh AI exploration.
- Skill confidence, success/failure counters and last-confirmed application version.
- Link each skill to the V1.3 Application Memory screens/navigation edges it depends on.
- Fall back to AI exploration when a skill cannot continue safely.

## Why V1.4 follows V1.3

V1.3 gives TestPilot a durable map of screens, controls and navigation. V1.4 packages validated paths through that map into reusable actions, reducing AI calls and making regression execution faster and more deterministic.

## After V1.4

V1.5 is planned as **AI Self-Healing & Vision Fallback**: semantic recovery when known selectors/paths change, plus guarded visual targeting for controls that do not expose usable DOM/UI Automation metadata.
