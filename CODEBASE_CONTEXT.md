# CODEBASE_CONTEXT.md — HomeServicesAdminWeb

> Agent reads this before Stage 2 (Plan). Keep updated when patterns change.

## App role
Admin ops web dashboard (Vite + React web).

## Tech stack
- **Framework:** Vite + React 19 + TypeScript
- **Routing:** React Router (`src/pages/`, `src/layouts/`)
- **State:** Zustand (`src/store/`) when needed
- **Backend access:** `src/services/api/` (fetch + JWT in localStorage for AdminWeb)
- **Theming:** `src/theme/themeConfig.ts` + `applyColorPalette()` from `VITE_CLIENT_NAME`
- **Styling:** CSS next to components + CSS variables (`--primary-color`, `--primary-color-opacity-10`, …)
- **i18n:** i18next + react-i18next where user-facing copy exists (`src/i18n/`)
- **Testing:** Vitest / RTL when present

## Folder conventions
```
src/
  theme/          ← themeConfig, applyTheme, colorUtils
  components/     ← shared UI
  pages/          ← route-level screens
  layouts/        ← shells (admin sidebar, etc.)
  services/api/   ← API clients
  store/          ← Zustand stores
  i18n/locales/
  styles/         ← global.css, shared page styles
  config/         ← API base URL
```

## Patterns
- Prefer reusing `src/components/*` / existing pages before new UI.
- User-visible strings go through `t('...')` when i18n is set up.
- Colors ONLY via palette CSS vars (`var(--primary-color)`, `var(--primary-color-opacity-10)`). No brand hex in components.
- New client brands: add entry under `themeConfig` (solids); opacities are derived.
- API calls live in `src/services/api/`, not inline in pages.
- Keep files under ~250 lines.

## Do not assume (Kural / RN defaults)
- No Antd barrel, no Redux Toolkit, no `menuConfig.ts`, no React Native StyleSheet.
- Navigation = React Router routes in `App.tsx`.
