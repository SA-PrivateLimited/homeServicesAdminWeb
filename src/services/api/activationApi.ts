import {apiGet, apiPost, apiPatch} from './apiClient';
import type {User} from './usersApi';

export type AdminStatus = 'PENDING' | 'ACTIVE' | 'LOCKED' | 'DISABLED';

export interface ActivationInviteResult {
  admin: User;
  activationLink: string;
  activationExpiresAt: string;
  qrCodeDataUrl: string;
}

export interface ActivationValidateResult {
  valid: boolean;
  email: string;
  name?: string | null;
  expiresAt: string;
}

export interface ActivationPasswordResult {
  email: string;
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
  activationMfaToken: string;
  message?: string;
}

/** Super Admin: create PENDING admin + one-time activation link (no email). */
export async function inviteAdmin(input: {
  name?: string;
  email: string;
  permissions?: string[];
}): Promise<ActivationInviteResult> {
  return apiPost<ActivationInviteResult>('/api/users/admins/invite', input);
}

export async function regenerateAdminActivation(
  userId: string,
): Promise<ActivationInviteResult> {
  return apiPost<ActivationInviteResult>(
    `/api/users/${userId}/activation/regenerate`,
    {},
  );
}

export async function cancelAdminInvitation(userId: string): Promise<User> {
  return apiPost<User>(`/api/users/${userId}/activation/cancel`, {});
}

export async function setAdminStatus(
  userId: string,
  status: AdminStatus,
  reason?: string,
): Promise<User> {
  return apiPost<User>(`/api/users/${userId}/admin-status`, {status, reason});
}

/** Super Admin: replace permissions (effective on target's next login). */
export async function updateAdminPermissions(
  userId: string,
  permissions: string[],
): Promise<User> {
  return apiPatch<User>(`/api/admins/${userId}/permissions`, {permissions});
}

/** Public — no JWT */
export async function validateActivationToken(
  token: string,
): Promise<ActivationValidateResult> {
  const qs = new URLSearchParams({token});
  return apiGet<ActivationValidateResult>(`/api/auth/activate?${qs}`, {
    skipAuth: true,
  });
}

export async function activationSetPassword(input: {
  token: string;
  password: string;
  confirmPassword: string;
}): Promise<ActivationPasswordResult> {
  return apiPost<ActivationPasswordResult>(
    '/api/auth/activate/password',
    input,
    {skipAuth: true},
  );
}

export async function activationVerifyMfa(input: {
  activationMfaToken: string;
  code: string;
}): Promise<User> {
  return apiPost<User>('/api/auth/activate/mfa', input, {skipAuth: true});
}
