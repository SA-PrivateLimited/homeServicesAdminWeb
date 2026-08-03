# HomeServicesAdminWeb

Web ops dashboard for **Home Services** admins (preferred over the mobile admin app for desk work).

## Stack
Vite + React + TypeScript + React Router + Zustand + i18next

Talks to `homeServicesBackend` with JWT auth (`role: admin`).

## Run
```bash
cp .env.example .env   # set VITE_API_BASE_URL + VITE_CLIENT_NAME
npm install
npm run dev
```

## Theming
Brand colors come from `src/theme/themeConfig.ts` selected by `VITE_CLIENT_NAME` (`homeservices` | `facebook` | `google`).  
Use CSS vars only: `var(--primary-color)`, `var(--primary-color-opacity-10)`, `var(--secondary-color)`, …

## Screens (parity with RN admin)
- Overview stats (click-through to each section)
- Providers list + detail/edit + approve/reject
- Document verify / reject with reason
- Provider approvals (filters + rejection reason)
- Customers / Users (role change)
- Job cards (filter, detail modal, status update)
- Service categories CRUD + bilingual questionnaire editor
- Shared contacts (status + admin notes)

## Not ported yet
- Fee change requests (backend routes missing)
- Admin create-provider (backend `POST /providers` missing)

## Agent pipeline
Same FE Agent setup as the other Home Services apps — see `AGENTS.md` / `CLAUDE.md`.
# homeServicesAdminWeb
