# CLAUDE.md — HomeServicesAdminWeb

## What this repo is

`HomeServicesAdminWeb` is the Akanso admin and operations dashboard.

It manages:

- providers/partners
- customers
- jobs
- categories and questionnaires
- geography coverage
- contact recommendations
- contact privacy
- admins and permissions
- clients/branding

Stack:

- Vite
- React
- TypeScript
- React Router
- Zustand
- i18next
- shared UI from `sapvt-ltd-web-packages`

## Repo truths

- This is a separate app from CustomerWeb and ProviderWeb.
- It is desktop-first but still needs responsive behavior.
- The app uses permission-gated routes and optional Super Admin elevation.
- Long dialogs, dense tables, and operational workflows are normal here.
- Existing admin functionality should not be removed casually during redesigns.

## Important architecture points

- Routes are centered in `src/App.tsx`.
- Shell/navigation lives in `src/layouts/AdminShell.tsx`.
- Auth/session lives in `src/store/authStore.ts`.
- API access is through `src/services/api/`.
- Shared UI behavior may come from `sapvt-ltd-web-packages`.

## Business rules to preserve

- Admin actions are permission-sensitive.
- Multi-role user concepts matter across customers and partners.
- Partner service verification and active/inactive state are different concerns.
- Contact privacy settings must reflect real backend behavior.
- Client branding is runtime-driven, not just hardcoded UI.

## Local guidance files

- Personas: `.claude/agents/`
- Cursor rules: `.cursor/rules/`
- Codebase patterns: `CODEBASE_CONTEXT.md`
- Ticket context: `agent-context/[ticket-id]/`

## Non-negotiable rules

- Do not commit `.env`, `.env.local`, or `agent-context/`.
- Stay surgical and name the exact pages/components/routes being changed.
- Prefer shared fixes when the same admin UI problem appears in multiple dialogs or screens.
- Preserve existing workflows unless the task explicitly changes the business rule.
