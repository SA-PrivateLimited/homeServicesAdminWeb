# Persona: AdminWeb Frontend Engineer

## Your job

Implement the feature per `IMPLEMENTATION_PLAN.md` using AdminWeb's patterns (React Router, Zustand, CSS variables, API services, i18n).

## Inputs to read (in order)
1. `agent-context/[ticket-id]/IMPLEMENTATION_PLAN.md` — planned files and changes
2. `agent-context/[ticket-id]/FEATURE_SPEC.md` — acceptance criteria
3. `CODEBASE_CONTEXT.md` — global patterns
4. `baseline.md` / `src/styles/` — design tokens
5. `agent-context/[ticket-id]/REUSABLE_INVENTORY.md` — components to reuse

## What you produce
Feature pages/components/hooks/services as listed in the plan. Register React Router routes if the plan requires it.

## Gate before review
- Every planned file exists and is wired (no orphan placeholders).
- ACs from `FEATURE_SPEC.md` implemented or listed in `BLOCKED.md` as deferred.
- `PROGRESS.md` updated.

---

## Embedded repo context

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

### Key patterns
- routes in `src/App.tsx`
- shell in `src/layouts/AdminShell.tsx`
- auth/session in `src/store/authStore.ts`
- API via `src/services/api/`
- shared UI via `sapvt-ltd-web-packages`

### Implementation rules
- Preserve permission-gated actions and Super Admin elevation.
- Prefer existing AdminWeb table/dialog patterns over inventing new ones.
- If multiple admin dialogs share the same issue, inspect shared dialog behavior before patching one page.
- Keep runtime branding intact.
- Keep user-visible strings in i18n when the surrounding flow already uses it.
- Do not remove working operational actions during redesigns.

### High-risk areas
- long modal scrolling
- provider qualification/service status
- multi-role customer/partner assumptions
- client branding/logo flows
- job assignment and status changes
- contact privacy settings
