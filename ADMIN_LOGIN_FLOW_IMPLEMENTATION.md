# Admin Login Flow — Implementation Report

**App:** `HomeServicesAdminWeb`  
**Date:** 2026-08-07  
**Scope:** How admin authentication is implemented end-to-end (UI → store → API → session → route guards → Super Admin elevation).

---

## 1. Executive summary

Admin Web login is **email + password + TOTP MFA** (Google Authenticator / Authy style). It does **not** use Firebase Phone Auth, SMS OTP, or phone+PIN (those are used by Customer / Provider apps).

After a successful MFA step, the app stores a **JWT** and an **admin user** in `localStorage`, then unlocks the dashboard via `RequireAuth` (`role === 'admin'`).

A separate **Super Admin** gate (4-digit shared key) can be elevated **after** login to unlock Admins / Clients management. That elevation token lives in `sessionStorage` and is sent as `X-Super-Admin-Token`.

---

## 2. High-level flow

```
[/login]
  email + password
       │
       ▼
 POST /api/auth/login
       │
       ├─ requiresMfaSetup → show QR + secret → POST /api/auth/mfa/enable → JWT
       ├─ requiresMfa      → enter TOTP code → POST /api/auth/mfa/verify → JWT
       └─ user + token     → persist only if role=admin (unusual for admins)
       │
       ▼
 RequireAuth (token + user.role === 'admin') → AdminShell
       │
       └─ optional: “Act as Super Admin”
            → 4-digit code
            → POST /api/superadmin/elevate
            → sessionStorage token + X-Super-Admin-Token header
            → unlock /admins and /clients
```

---

## 3. Entry points & routing

### Boot sequence
1. `src/main.tsx` — `loadRuntimeConfig()`, optional branding theme, render `<App />`
2. `src/App.tsx` — on mount calls `useAuthStore().hydrate()` to restore session

### Routes (`src/App.tsx`)

| Path | Access | Component |
|------|--------|-----------|
| `/login` | Public | `LoginPage` |
| `/`, overview, providers, geography, customers, jobs, categories, contacts, … | Auth required | Inside `RequireAuth` → `AdminShell` |
| `/admins`, `/clients` | Auth + Super Admin elevated | `AdminsPage`, `ClientsPage` |
| `/users` | Auth | Redirect → `/admins` |
| `*` | — | Navigate → `/` |

### Route guard — `RequireAuth`

File: `src/components/RequireAuth.tsx`

Checks:
1. `hydrated` — otherwise shows “Loading…”
2. `token` present
3. `user` present
4. `user.role === 'admin'`

If any check fails → `<Navigate to="/login" replace />`.

Does **not** preserve `location.state.from` (always lands on `/` after login).

---

## 4. Login UI — `LoginPage`

File: `src/pages/LoginPage.tsx`  
Styles: `src/pages/LoginPage.css`

### Local UI state
- `email`, `password`, `mfaCode`
- `step`: `'credentials' | 'mfa' | 'mfa_setup'`
- `error`, `loading`

### Step A — Credentials
- Form: email + password
- Calls `beginLogin(email, password)` from auth store
- Outcomes:
  - `kind: 'session'` → navigate `/`
  - `kind: 'mfa'` → clear password → MFA verify screen
  - `kind: 'mfa_setup'` → clear password → QR + secret + first TOTP screen

### Step B — MFA setup (`mfa_setup`)
Shown when backend says the admin has not enrolled TOTP yet.
- Displays QR (`qrCodeDataUrl`) and manual `secret`
- User enters 6-digit authenticator code
- Calls `completeMfaSetup(mfaToken, code)` → session → `/`

### Step C — MFA verify (`mfa`)
Shown when TOTP is already enabled.
- User enters 6-digit code
- Calls `completeMfaVerify(mfaToken, code)` → session → `/`

### Already logged in
If `user` exists in store → `<Navigate to="/" replace />`.  
Note: page does **not** wait for `hydrated`, so a brief login form flash is possible during session restore.

---

## 5. Auth store (Zustand)

File: `src/store/authStore.ts`

### State

| Field | Type | Meaning |
|-------|------|---------|
| `user` | `AdminUser \| null` | Current admin |
| `token` | `string \| null` | JWT |
| `hydrated` | `boolean` | Session restore finished |
| `superAdminElevated` | `boolean` | Super Admin token present |

### Actions

| Action | Role |
|--------|------|
| `hydrate()` | Restore JWT → `GET /api/users/me` → set session or clear |
| `beginLogin(email, password)` | Clears Super Admin elevation → `POST /api/auth/login` |
| `completeMfaSetup(mfaToken, code)` | `POST /api/auth/mfa/enable` → persist session |
| `completeMfaVerify(mfaToken, code)` | `POST /api/auth/mfa/verify` → persist session |
| `elevateToSuperAdmin(code)` | `POST /api/superadmin/elevate` |
| `exitSuperAdmin()` | Clear elevation token |
| `changeSuperAdminKey(current, next)` | `PUT /api/superadmin/key` |
| `logout()` | Best-effort `POST /api/auth/logout` + clear local session |

---

## 6. Session persistence

File: `src/services/backendAuth.ts`

| Key | Storage | Purpose |
|-----|---------|---------|
| `hs_admin_jwt` | `localStorage` | Access JWT |
| `hs_admin_user` | `localStorage` | Cached admin user JSON |
| `hs_super_admin_token` | **`sessionStorage`** | Super Admin elevation (tab-scoped) |

### `persistSession(user, token)`
- Throws if `user.role !== 'admin'` (“Admin access required”)
- Writes JWT + user to `localStorage`

### Hydrate behavior
1. Read JWT from `localStorage`
2. If missing → clear Super Admin + session → `hydrated: true`, logged out
3. If present → `GET /api/users/me`
4. Success → persist + restore Super Admin flag from `sessionStorage`
5. Failure → clear everything

---

## 7. API contracts used by login

File: `src/services/backendAuth.ts`  
HTTP client: `src/services/api/apiClient.ts`

### Client headers
- `Authorization: Bearer <hs_admin_jwt>` (unless `skipAuth: true`)
- `X-Super-Admin-Token: <token>` when Super Admin elevated
- Response envelope `{ success, data }` → client returns `data`

### Auth endpoints

| Client helper | Method / path | Body | Result |
|---------------|---------------|------|--------|
| `loginWithBackend` | `POST /api/auth/login` | `{ email, password }` | Session **or** MFA challenge |
| `enableMfaWithBackend` | `POST /api/auth/mfa/enable` | `{ mfaToken, code }` | `{ user, token }` |
| `verifyMfaWithBackend` | `POST /api/auth/mfa/verify` | `{ mfaToken, code }` | `{ user, token }` |
| `fetchCurrentAdmin` | `GET /api/users/me` | — | Admin user (role must be admin) |
| `logoutWithBackend` | `POST /api/auth/logout` | `{}` | Best-effort |

### `LoginStepResult` (client-normalized)

```ts
| { kind: 'session'; user; token }
| { kind: 'mfa'; mfaToken; email? }
| { kind: 'mfa_setup'; mfaToken; email?; secret; otpauthUrl; qrCodeDataUrl }
```

Mapped from backend flags: `requiresMfa`, `requiresMfaSetup`, plus MFA token / QR fields.

### Super Admin endpoints

File: `src/services/api/superAdminApi.ts`

| Helper | Method / path | Body |
|--------|---------------|------|
| `elevateSuperAdmin` | `POST /api/superadmin/elevate` | `{ code }` (4-digit) |
| `updateSuperAdminKey` | `PUT /api/superadmin/key` | `{ currentCode, newCode }` |

Elevate response includes `superAdminToken` (stored in `sessionStorage`).

---

## 8. Backend expectations (admin users)

For **admin** accounts, password login typically does **not** return a session immediately:

| Backend condition | Client outcome |
|-------------------|----------------|
| Admin has `totpEnabled` | `requiresMfa` + `mfaToken` |
| Admin has not enrolled MFA | `requiresMfaSetup` + QR/secret + `mfaToken` |
| Non-admin password login | May return session — Admin Web rejects via `persistSession` / `RequireAuth` |

Admin accounts are **not** self-registered in this app. They are created by an elevated Super Admin (`AdminsPage`).

---

## 9. Super Admin (post-login elevation)

UI: `src/layouts/AdminShell.tsx`

1. Authenticated admin opens “Act as Super Admin”
2. Enters shared **4-digit** key
3. `elevateToSuperAdmin(code)` stores token in `sessionStorage`
4. Nav unlocks **Admins** and **Clients** (`superAdminOnly: true`)
5. Page guards: if not elevated → redirect `/`
6. Can update the key or exit Super Admin
7. Logout clears JWT, user, and Super Admin token

This is **not** a separate user role in the JWT; it is an additional short-lived privilege token.

---

## 10. Role & access model

| Layer | Rule |
|-------|------|
| `persistSession` / `fetchCurrentAdmin` | Must be `role === 'admin'` |
| `RequireAuth` | Must be admin or redirect to `/login` |
| Super Admin | Elevation token after authenticated admin enters shared key |
| `/admins`, `/clients` | Require `superAdminElevated` |

---

## 11. Unauthenticated / guest behavior

- Only public route: `/login`
- No guest dashboard browsing
- Unknown routes → `/` → `RequireAuth` → `/login` if unauthenticated
- API `401` → `handleUnauthorizedSession()` clears storage and hard-navigates to `/login`

---

## 12. Error handling

| Area | Behavior |
|------|----------|
| Login / MFA forms | Show `err.message` or generic i18n error |
| Wrong password / MFA | Backend 401 messages surfaced via `ApiError` |
| Hydrate failure | Silent clear → logged-out state |
| Logout API failure | Ignored; local clear still runs |
| Super Admin elevate / key change | Modal error text |
| MFA submit | Disabled until code length is 6 |
| Super Admin elevate | Disabled until code length is 4 |

---

## 13. Config & environment

| Source | Purpose |
|--------|---------|
| `.env` / `.env.example` | `VITE_API_BASE_URL` (e.g. `http://localhost:3001`) |
| `public/config.json` | Preferred runtime `apiBaseUrl` + theme |
| `src/config/runtime.ts` | Load order: config.json → env → localhost fallback |
| `src/config/api.ts` | `resolveApiBaseUrl()`, timeout 30s |

**No Firebase / reCAPTCHA env vars** in Admin Web.

---

## 14. Key files

| Path | Responsibility |
|------|----------------|
| `src/main.tsx` | App boot + runtime config |
| `src/App.tsx` | Routes + `hydrate()` |
| `src/pages/LoginPage.tsx` | Credentials + MFA UI |
| `src/pages/LoginPage.css` | Login styles |
| `src/components/RequireAuth.tsx` | Admin route gate |
| `src/store/authStore.ts` | Session + Super Admin state |
| `src/services/backendAuth.ts` | Login/MFA/logout + JWT storage |
| `src/services/api/apiClient.ts` | Fetch wrapper, Bearer + Super Admin header, 401 handling |
| `src/services/api/superAdminApi.ts` | Elevate / key update |
| `src/layouts/AdminShell.tsx` | Shell, nav, Super Admin UI, logout |
| `src/pages/AdminsPage.tsx` | Super-Admin-only admin management |
| `src/pages/ClientsPage.tsx` | Super-Admin-only clients |
| `src/i18n/locales/en.json` | Login / MFA / Super Admin copy |

---

## 15. Comparison vs Customer / Provider Web

| Concern | Admin Web | Customer / Provider Web |
|---------|-----------|-------------------------|
| Identity | Email + password | Phone number |
| Second factor | TOTP authenticator MFA | Firebase Phone Auth OTP (signup / forgot PIN) |
| Everyday sign-in | Email + password + MFA | Phone + 6-digit PIN |
| JWT storage key | `hs_admin_jwt` | Customer / provider JWT keys |
| Firebase | Not used | Used for OTP |
| Self-signup | No (created by Super Admin) | Yes (OTP registration) |
| Extra privilege | Super Admin 4-digit elevation | N/A |

---

## 16. Implementation notes / gaps

1. **By design:** no Firebase Phone Auth path for admins.
2. **`LoginPage` ignores `hydrated`** — possible brief login flash before session restore completes.
3. **No return-URL restore** after login (`state.from` unused).
4. Client still handles `kind: 'session'` from password login, but admins are normally forced through MFA by the backend.
5. `readStoredUser()` exists in auth helpers but hydrate always revalidates via `/api/users/me`.
6. Super Admin token is tab-scoped (`sessionStorage`); closing the tab drops elevation while JWT can remain.

---

## 17. How to manually verify

1. Open Admin Web login (`/login`).
2. Sign in with an admin email/password.
3. **First login (no MFA yet):** scan QR → enter 6-digit code → land on dashboard.
4. **Later logins:** enter 6-digit authenticator code → dashboard.
5. Confirm `localStorage` has `hs_admin_jwt` and `hs_admin_user`.
6. Optional: elevate Super Admin with 4-digit key → confirm Admins/Clients appear and `sessionStorage` has `hs_super_admin_token`.
7. Logout → storage cleared → redirected to `/login`.

---

## 18. Related: invitation onboarding (no email)

New admins are created as `PENDING` with a one-time activation link returned to Super Admin (no SMTP). See [ADMIN_ACTIVATION_ONBOARDING.md](./ADMIN_ACTIVATION_ONBOARDING.md).

Daily login for `ACTIVE` admins remains: email → password → TOTP → JWT.

---

## 19. Conclusion

`HomeServicesAdminWeb` login is a complete **email/password + TOTP MFA** flow with JWT session persistence and an optional **Super Admin elevation** layer. It is intentionally different from the Homora customer/provider **phone + PIN + Firebase OTP** model.
