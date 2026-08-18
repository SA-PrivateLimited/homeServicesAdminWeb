import {apiDelete, apiGet, apiGetPaginated, apiPost, apiPut} from './apiClient';

export interface UserLocation {
  address?: string;
  landmark?: string;
  city?: string;
  state?: string;
  district?: string;
  stateId?: string;
  districtId?: string;
  pincode?: string;
  country?: string;
}

export interface User {
  _id: string;
  name?: string;
  displayName?: string;
  email?: string;
  phone?: string;
  phoneNumber?: string;
  phoneVerified?: boolean;
  role?: string;
  loginPin?: string | null;
  hasPin?: boolean;
  location?: UserLocation;
  homeAddress?: UserLocation;
  isActive?: boolean;
  deactivatedAt?: string;
  deactivationReason?: string;
  totpEnabled?: boolean;
  adminStatus?: 'PENDING' | 'ACTIVE' | 'LOCKED' | 'DISABLED';
  permissions?: string[];
  hasPendingInvitation?: boolean;
  activationExpiresAt?: string | null;
  activationLink?: string;
  qrCodeDataUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  customerProfileEnabled?: boolean;
  customerAccessActive?: boolean;
  hasCustomerProfile?: boolean;
  hasPartnerProfile?: boolean;
  hasCustomerPin?: boolean;
  hasPartnerPin?: boolean;
  pinPurpose?: 'customer' | 'partner';
}

export interface CreateUserInput {
  name?: string;
  email?: string;
  phone?: string;
  role: 'customer' | 'provider' | 'admin';
  password?: string;
  permissions?: string[];
  serviceType?: string;
  serviceCategories?: string[];
  address?: string;
  landmark?: string;
  city?: string;
  state?: string;
  district?: string;
  stateId?: string;
  districtId?: string;
  pincode?: string;
  experience?: number;
  rating?: number;
  /** Provider only — default approved; use pending when converting from shared contact */
  approvalStatus?: 'pending' | 'approved';
}

export interface UserListOptions {
  role?: string;
  roles?: string[];
  limit?: number;
  offset?: number;
  includeInactive?: boolean;
  state?: string;
  district?: string;
  stateId?: string;
  districtId?: string;
}

const DEFAULT_PAGE_SIZE = 50;

export async function getUsersPage(
  options: UserListOptions = {},
): Promise<{items: User[]; total: number; limit: number; offset: number}> {
  const params = new URLSearchParams();
  if (options.role) params.set('role', options.role);
  if (options.roles?.length) params.set('roles', options.roles.join(','));
  if (options.includeInactive) params.set('includeInactive', 'true');
  if (options.state) params.set('state', options.state);
  if (options.district) params.set('district', options.district);
  if (options.stateId) params.set('stateId', options.stateId);
  if (options.districtId) params.set('districtId', options.districtId);
  params.set('limit', String(options.limit ?? DEFAULT_PAGE_SIZE));
  params.set('offset', String(options.offset ?? 0));
  const qs = params.toString();
  return apiGetPaginated<User>(`/api/users?${qs}`);
}

/** @deprecated Prefer getUsersPage for pagination + totals */
export async function getAllUsers(role?: string): Promise<User[]> {
  const page = await getUsersPage({
    role,
    limit: 100,
    offset: 0,
  });
  return page.items;
}

export async function createUser(input: CreateUserInput): Promise<User> {
  return apiPost<User>('/api/users', input);
}

export async function deleteUser(userId: string): Promise<{_id: string}> {
  return apiDelete<{_id: string}>(`/api/users/${userId}`);
}

export async function deactivateUser(
  userId: string,
  reason: string,
  scope: 'customer' | 'partner' | 'account' = 'account',
): Promise<User> {
  return apiPost<User>(`/api/users/${userId}/deactivate`, {reason, scope});
}

export async function restoreUser(
  userId: string,
  scope: 'customer' | 'partner' | 'account' = 'account',
): Promise<User> {
  return apiPost<User>(`/api/users/${userId}/restore`, {scope});
}

export async function updateUser(
  userId: string,
  updates: Partial<
    Pick<
      User,
      'name' | 'displayName' | 'email' | 'phone' | 'phoneNumber' | 'phoneVerified' | 'role'
    > & {
      address?: string;
      landmark?: string;
      city?: string;
      state?: string;
      district?: string;
      stateId?: string;
      districtId?: string;
      pincode?: string;
    }
  >,
): Promise<User> {
  return apiPut<User>(`/api/users/${userId}`, updates);
}

export async function updateUserRole(
  userId: string,
  role: 'customer' | 'provider' | 'admin',
): Promise<User> {
  return updateUser(userId, {role});
}

export async function setUserPassword(
  userId: string,
  password: string,
): Promise<{_id: string; email?: string}> {
  return apiPut<{_id: string; email?: string}>(
    `/api/users/${userId}/password`,
    {password},
  );
}

export type PinPurpose = 'customer' | 'partner';

export async function setUserPin(
  userId: string,
  pin?: string,
  purpose?: PinPurpose,
): Promise<{_id: string; loginPin: string; hasPin: boolean; purpose?: PinPurpose}> {
  return apiPut<{_id: string; loginPin: string; hasPin: boolean; purpose?: PinPurpose}>(
    `/api/users/${userId}/pin`,
    purpose ? {pin, purpose} : pin ? {pin} : {},
  );
}

export async function revealUserPin(
  userId: string,
  purpose?: PinPurpose,
): Promise<{
  _id: string;
  hasPin: boolean;
  loginPin: string | null;
  recoverable: boolean;
  purpose?: PinPurpose;
}> {
  const qs = purpose ? `?purpose=${purpose}` : '';
  return apiGet<{
    _id: string;
    hasPin: boolean;
    loginPin: string | null;
    recoverable: boolean;
    purpose?: PinPurpose;
  }>(`/api/users/${userId}/pin${qs}`);
}

/** Super Admin: clear admin MFA so they re-enroll on next login. */
export async function resetUserMfa(
  userId: string,
): Promise<{_id: string; totpEnabled: boolean; email?: string}> {
  return apiPost<{_id: string; totpEnabled: boolean; email?: string}>(
    `/api/users/${userId}/mfa/reset`,
    {},
  );
}
