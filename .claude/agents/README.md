# `.claude/agents` — HomeServicesAdminWeb Agent Suite

Local personas for the AdminWeb repo. Each file is self-sufficient and embeds Akanso AdminWeb context.

## Repo context

AdminWeb is the Akanso admin and operations dashboard.

### Main surfaces
- providers/partners
- customers
- jobs
- categories
- geography
- contacts
- admins
- clients

## Shared assumptions

- AdminWeb is a separate app from CustomerWeb and ProviderWeb
- permission-gated routes are real
- Super Admin elevation exists
- long dialogs and dense tables are normal
- existing operational functionality should not be removed casually

## Personas

| File | Stage | Purpose |
|------|-------|---------|
| `product-manager.md` | 1 — Spec | Turn requests into scoped AdminWeb feature specs |
| `planner.md` | 2 — Plan | Decide what AdminWeb files and layers should change |
| `tester.md` | 3 — Test | Write high-value tests for AdminWeb changes |
| `frontend.md` | 4 — Implement | Implement AdminWeb frontend changes |
| `verifier.md` | 5 — Verify | Verify builds, behavior, and admin regression risk |
| `reviewer.md` | 6 — Review | Review AdminWeb changes for operational safety |
| `reporter.md` | 7 — Report | Summarize changes, verification, and remaining risk |

## How to use

Read the persona for your current stage before doing anything. Follow its inputs, outputs, and gate checklist.
