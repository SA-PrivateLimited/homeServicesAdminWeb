# baseline.md — Design tokens (Home Services Web)

> Brand colors come from `src/theme/themeConfig.ts` based on `VITE_CLIENT_NAME`.
> Applied at boot via `applyColorPalette()` → CSS custom properties on `:root`.

## Client selection

```env
VITE_CLIENT_NAME=homeservices   # homeservices | facebook | google
```

## Opacity inventory (gathered from AdminWeb + Website)

These steps are generated for each solid base color in `OPACITY_STEPS`:

| Step | Token suffix | Typical use |
|------|--------------|-------------|
| 4 | `opacity-04` | Soft black shadow layer |
| 5 | `opacity-05` | Row hover, ghost button hover |
| 6 | `opacity-06` | Sidebar logout hover, shadow |
| 8 | `opacity-08` | Sidebar nav active, danger hover |
| 10 | `opacity-10` | Brand washes, body gradients |
| 12 | `opacity-12` | Badge fills, marketing borders |
| 15 | `opacity-15` | Soft brand fills |
| 16 | `opacity-16` | Sidebar logout border |
| 20 | `opacity-20` | Login/hero gradients, modal shadow |
| 25 | `opacity-25` | Login card shadow |
| 30 | `opacity-30` | Reserved brand washes |
| 35 | `opacity-35` | Focus rings, hero accents |
| 45 | `opacity-45` | Modal backdrop |
| 50 | `opacity-50` | Reserved |
| 60 | `opacity-60` | Question card wash |
| 70 | `opacity-70` | Reserved / disabled-adjacent |
| 80 | `opacity-80` | Table header wash |
| 88 | `opacity-88` | Marketing hero overlay |
| 90 | `opacity-90` | Marketing download fade |

Bases that receive opacity variants:
`primary-color`, `primary-color-2`, `secondary-color`, `secondary-color-2`,
`color-bg`, `color-surface`, `color-text`, `color-error`, `color-success`,
`color-warning`, `color-sidebar`, `marketing-bg`, `marketing-bg-elevated`,
`neutral-white`, `neutral-black`.

Examples:
- `var(--primary-color-opacity-10)`
- `var(--neutral-white-opacity-08)`
- `var(--color-error-opacity-12)`
- `var(--marketing-bg-opacity-88)`

## Solid palette tokens

| Token | CSS variable |
|-------|--------------|
| Primary | `--primary-color` |
| Primary dark | `--primary-color-2` |
| Secondary | `--secondary-color` |
| Secondary dark | `--secondary-color-2` |
| Background | `--color-bg` |
| Surface / card | `--color-card` / `--color-surface` |
| Text | `--color-text` |
| Text muted | `--color-text-secondary` |
| Border | `--color-border` |
| Error | `--color-error` / `--warning-red` |
| Success | `--color-success` |
| Warning | `--color-warning` |
| White / Black | `--neutral-white` / `--neutral-black` |
| Marketing shell | `--marketing-bg`, `--marketing-bg-elevated`, `--marketing-text` |

## Rules
- **No hardcoded brand/UI hex or rgba in components/CSS** — only `var(--…)`.
- Hex is allowed **only** inside `themeConfig.ts` (and ephemeral CSS `:root` fallbacks that mirror the default client).
- Add a new client by extending `themeConfig` solids; opacities are derived from `OPACITY_STEPS`.
- If you need a new opacity %, add it to `OPACITY_STEPS` and document it in the inventory table above.
