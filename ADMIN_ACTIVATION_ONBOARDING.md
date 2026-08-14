# Admin onboarding (invitation link — no email)

Enterprise admin activation without SMTP / Zoho / SendGrid. Super Admin creates a **PENDING** admin and receives a one-time activation link to share manually (WhatsApp, Slack, Teams, SMS).

Customer / provider Firebase Phone Auth is unchanged and separate.

## Architecture

```
Super Admin (elevated)
  → POST /api/users/admins/invite
  → adminActivationService.createPendingAdmin
  → returns activationLink + QR (token hashed in MongoDB)

Invitee
  → GET  /api/auth/activate?token=
  → POST /api/auth/activate/password
  → POST /api/auth/activate/mfa
  → adminStatus = ACTIVE

Daily login (unchanged shape)
  → POST /api/auth/login (email + password)
  → TOTP MFA
  → JWT
```

### Folder layout (backend)

```
homeServicesBackend/src/
  models/User.js                 # adminStatus, activationTokenHash, permissions
  services/adminActivationService.js
  controllers/adminActivationController.js
  controllers/authController.js  # assertCanLoginAsAdmin gate
  controllers/usersController.js # invite via create without password
  routes/auth.js                 # public activate routes
  routes/users.js                # invite / regenerate / cancel / status
```

### Folder layout (Admin Web)

```
HomeServicesAdminWeb/src/
  pages/ActivatePage.tsx         # public /activate?token=
  pages/AdminsPage.tsx           # invite + management
  services/api/activationApi.ts
  App.tsx                        # /activate route (outside RequireAuth)
```

## MongoDB schema (User)

| Field | Notes |
|-------|--------|
| `adminStatus` | `PENDING` \| `ACTIVE` \| `LOCKED` \| `DISABLED` (legacy missing → treat as `ACTIVE`) |
| `permissions` | `string[]` optional capability flags |
| `activationTokenHash` | SHA-256 of token (`select: false`); plaintext never stored |
| `activationExpiresAt` | typically now + 24h |
| `passwordHash` | bcrypt; `null` until activation |
| `totpSecretEncrypted` | AES via `TOKEN_ENCRYPTION_KEY`; set during activation |
| `totpEnabled` | `true` after first successful TOTP verify |

`isActive` stays synced: `DISABLED`/`LOCKED` → `false`; `ACTIVE`/`PENDING` → `true`.

## REST APIs

### Public (no JWT)

| Method | Path | Body / query |
|--------|------|----------------|
| GET | `/api/auth/activate?token=` | validate invitation |
| POST | `/api/auth/activate/password` | `{ token, password, confirmPassword }` → TOTP QR + `activationMfaToken` |
| POST | `/api/auth/activate/mfa` | `{ activationMfaToken, code }` → ACTIVE |

### Super Admin (`Authorization` + `X-Super-Admin-Token`)

| Method | Path | Notes |
|--------|------|--------|
| POST | `/api/users/admins/invite` | `{ name, email, permissions? }` → link + QR |
| POST | `/api/users` (role=admin, no password) | same invitation path |
| POST | `/api/users/:id/activation/regenerate` | new link; invalidates old |
| POST | `/api/users/:id/activation/cancel` | clear token → `DISABLED` |
| POST | `/api/users/:id/admin-status` | `{ status, reason? }` |
| PUT | `/api/users/:id/password` | reset password (ACTIVE) |
| POST | `/api/users/:id/mfa/reset` | clear TOTP |
| POST | `/api/users/:id/deactivate` / `restore` | soft disable / restore |
| DELETE | `/api/users/:id` | delete |

## Security

- Cryptographically secure activation token (`crypto.randomBytes` → base64url); **only SHA-256 hash** stored.
- 24h expiry; token cleared on successful activation (one-time).
- Regenerate invalidates previous link and clears partial password/TOTP progress.
- Passwords: bcrypt (12 rounds). TOTP secrets: encrypted at rest.
- PENDING / LOCKED / DISABLED cannot obtain JWTs via `/api/auth/login`.
- Existing ACTIVE admins with MFA continue to work; no email/SMTP dependency.
- Set `ADMIN_WEB_BASE_URL` (e.g. `https://admin.homora.in`) so links point at the Admin Web origin.

## UI flows

1. **Admins** (Super Admin elevated): Invite → success modal with Copy link / QR / Regenerate / Cancel.
2. **Activate** (`/activate?token=`): password → authenticator QR → 6-digit code → sign-in.
3. **Login**: email → password → TOTP → dashboard (unchanged).

## Env

```bash
# backend
ADMIN_WEB_BASE_URL=https://admin.homora.in
TOKEN_ENCRYPTION_KEY=...   # required for TOTP secret encryption
JWT_SECRET=...
```

## Dynamic RBAC (permissions)

- Constants: `homeServicesBackend/src/constants/permissions.js` and `HomeServicesAdminWeb/src/constants/permissions.ts`
- Invite defaults to **all** permissions; Super Admin can uncheck modules before create
- Edit anytime: Super Admin → Admins → **Permissions** → Save → `PATCH /api/admins/:id/permissions`
- JWT includes `permissions[]` at login (**Option 1**: changes apply on the target admin’s **next login**)
- API: `requirePermission('providers.view')` etc. after `requireRole('admin')`
- Super Admin elevation (`X-Super-Admin-Token`) **bypasses** all permission checks
- Frontend: `usePermissions().hasPermission` / `canAccess` drives sidebar, `RequirePermission` routes, and actions
