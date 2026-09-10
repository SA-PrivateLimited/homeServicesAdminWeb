import {
  apiDelete,
  apiGet,
  apiGetPaginated,
  apiPatch,
  apiPost,
  apiUploadFormData,
  ApiError,
} from './apiClient';

export type EmployeeStatus = 'active' | 'on_leave' | 'inactive' | 'former';
export type EmploymentType =
  | 'full_time'
  | 'part_time'
  | 'contract'
  | 'intern'
  | 'other';
export type EmployeeDocumentType =
  | 'aadhaar'
  | 'pan'
  | 'address_proof'
  | 'joining_letter'
  | 'employment_agreement'
  | 'other';

export type EmployeeAccountStatus =
  | 'none'
  | 'invited'
  | 'activation_pending'
  | 'active'
  | 'suspended'
  | 'revoked';

export type EmployeeProfileAccess = 'view' | 'edit';

export interface EmployeeAddress {
  line1?: string;
  line2?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
}

export interface CompensationRecord {
  _id?: string;
  amount: number;
  currency?: string;
  salaryType?: string;
  effectiveFrom: string;
  reason?: string;
  createdAt?: string;
  createdBy?: string;
  createdByName?: string;
}

export interface EmployeeDocument {
  _id: string;
  type: EmployeeDocumentType;
  label?: string;
  fileUrl?: string;
  fileName?: string;
  contentType?: string;
  uploadedAt?: string;
  uploadedBy?: string;
  uploadedByName?: string;
}

export interface EmployeeActivity {
  _id?: string;
  type: string;
  summary: string;
  detail?: string;
  createdAt?: string;
  createdBy?: string;
  createdByName?: string;
}

export interface EmployeeBank {
  accountNumber?: string;
  accountNumberMasked?: string;
  ifsc?: string;
  accountHolderName?: string;
  uan?: string;
  esi?: string;
}

export interface Employee {
  _id: string;
  employeeCode: string;
  fullName: string;
  phone: string;
  email?: string;
  photoUrl?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: EmployeeAddress;
  profession?: string;
  designation?: string;
  department?: string;
  employmentType?: EmploymentType;
  joiningDate?: string;
  confirmationDate?: string;
  professionalExperienceYears?: number;
  workLocation?: string;
  reportingManagerId?: string | null;
  reportingManagerName?: string;
  reportingManagerCode?: string;
  status: EmployeeStatus;
  leavingDate?: string;
  leavingReason?: string;
  accountStatus?: EmployeeAccountStatus;
  profileAccess?: EmployeeProfileAccess;
  canRaiseRequest?: boolean;
  totpEnabled?: boolean;
  inviteSentAt?: string | null;
  inviteExpiresAt?: string | null;
  inviteAcceptedAt?: string | null;
  currentSalary?: CompensationRecord | null;
  compensationHistory?: CompensationRecord[];
  bank?: EmployeeBank;
  documents?: EmployeeDocument[];
  activity?: EmployeeActivity[];
  createdAt?: string;
  updatedAt?: string;
}

export interface EmployeeStats {
  total: number;
  active: number;
  onLeave: number;
  former: number;
  inactive: number;
}

export interface EmployeeMeta {
  departments: string[];
  designations: string[];
  professions: string[];
  lookups?: {
    department: EmployeeLookup[];
    designation: EmployeeLookup[];
    profession: EmployeeLookup[];
  };
  employmentTypes: EmploymentType[];
  statuses: EmployeeStatus[];
  documentTypes: EmployeeDocumentType[];
}

export interface EmployeeLookup {
  _id: string;
  kind: 'department' | 'designation' | 'profession';
  label: string;
}

export interface EmployeeIdCardPayload {
  employeeCode: string;
  fullName: string;
  profession: string;
  designation?: string;
  department?: string;
  employmentType?: string;
  photoUrl?: string;
  phone: string;
  email?: string;
  experienceYears: number;
  workLocation?: string;
  location: string;
  joiningDate?: string;
  reportingManager?: string;
  status: EmployeeStatus;
  verificationUrl: string;
  verify?: string;
  qrVerificationEnabled?: boolean;
  idCardStatus?: string;
  qrDataUrl: string;
  generatedAt: string;
}

export interface EmployeeListOptions {
  search?: string;
  status?: string;
  department?: string;
  profession?: string;
  employmentType?: string;
  limit?: number;
  offset?: number;
}

export type CreateEmployeeInput = {
  fullName: string;
  phone: string;
  email?: string;
  photoUrl?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: EmployeeAddress;
  profession?: string;
  designation?: string;
  department?: string;
  employmentType?: EmploymentType;
  joiningDate?: string;
  professionalExperienceYears?: number;
  workLocation?: string;
  reportingManagerId?: string | null;
  initialSalary?: number;
  salaryEffectiveFrom?: string;
  salaryReason?: string;
};

function toQuery(params: Record<string, string | number | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '' || v === 'all') continue;
    q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

export async function getEmployeeStats(): Promise<EmployeeStats> {
  return apiGet<EmployeeStats>('/api/admin/employees/stats', {
    cache: 'no-store',
  });
}

export async function getEmployeeMeta(): Promise<EmployeeMeta> {
  return apiGet<EmployeeMeta>('/api/admin/employees/meta', {
    cache: 'no-store',
  });
}

export async function listEmployeeLookups(
  kind?: 'department' | 'designation' | 'profession',
): Promise<EmployeeLookup[]> {
  const q = kind ? `?kind=${kind}` : '';
  return apiGet<EmployeeLookup[]>(`/api/admin/employees/lookups${q}`, {
    cache: 'no-store',
  });
}

export async function createEmployeeLookup(
  kind: 'department' | 'designation' | 'profession',
  label: string,
): Promise<EmployeeLookup> {
  return apiPost<EmployeeLookup>('/api/admin/employees/lookups', {
    kind,
    label,
  });
}

export async function deleteEmployeeLookup(id: string): Promise<void> {
  await apiDelete(`/api/admin/employees/lookups/${id}`);
}

export async function getEmployeesPage(options: EmployeeListOptions = {}) {
  const query = toQuery({
    search: options.search,
    status: options.status,
    department: options.department,
    profession: options.profession,
    employmentType: options.employmentType,
    limit: options.limit ?? 20,
    offset: options.offset ?? 0,
  });
  return apiGetPaginated<Employee>(`/api/admin/employees${query}`, {
    cache: 'no-store',
  });
}

export async function getEmployee(id: string): Promise<Employee> {
  return apiGet<Employee>(`/api/admin/employees/${id}`, {cache: 'no-store'});
}

export async function createEmployee(
  input: CreateEmployeeInput,
): Promise<Employee> {
  return apiPost<Employee>('/api/admin/employees', input);
}

export async function updateEmployee(
  id: string,
  input: Partial<CreateEmployeeInput> & {
    confirmationDate?: string;
    leavingDate?: string;
    leavingReason?: string;
    bank?: Partial<EmployeeBank>;
  },
): Promise<Employee> {
  return apiPatch<Employee>(`/api/admin/employees/${id}`, input);
}

export async function updateEmployeeStatus(
  id: string,
  status: EmployeeStatus,
  extras?: {leavingDate?: string; leavingReason?: string},
): Promise<Employee> {
  return apiPatch<Employee>(`/api/admin/employees/${id}/status`, {
    status,
    ...extras,
  });
}

export async function addEmployeeCompensation(
  id: string,
  input: {
    amount: number;
    effectiveFrom: string;
    reason?: string;
    salaryType?: string;
  },
): Promise<Employee> {
  return apiPost<Employee>(`/api/admin/employees/${id}/compensation`, input);
}

export async function uploadEmployeePhoto(
  id: string,
  file: File,
): Promise<{photoUrl: string; employee: Employee}> {
  const formData = new FormData();
  formData.append('file', file);
  return apiUploadFormData<{photoUrl: string; employee: Employee}>(
    `/api/admin/employees/${id}/photo`,
    formData,
  );
}

export async function uploadEmployeeDocument(
  id: string,
  file: File,
  type: EmployeeDocumentType,
  label?: string,
): Promise<Employee> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', type);
  if (label) formData.append('label', label);
  return apiUploadFormData<Employee>(
    `/api/admin/employees/${id}/documents`,
    formData,
  );
}

export async function deleteEmployeeDocument(
  id: string,
  documentId: string,
): Promise<Employee> {
  return apiDelete<Employee>(
    `/api/admin/employees/${id}/documents/${documentId}`,
  );
}

export async function generateEmployeeIdCard(
  id: string,
): Promise<EmployeeIdCardPayload> {
  return apiPost<EmployeeIdCardPayload>(
    `/api/admin/employees/${id}/id-card`,
  );
}

export async function deleteEmployee(id: string): Promise<void> {
  await apiDelete(`/api/admin/employees/${id}`);
}

export function employeeStatusLabel(status: EmployeeStatus): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'on_leave':
      return 'On Leave';
    case 'inactive':
      return 'Inactive';
    case 'former':
      return 'Former Employee';
    default:
      return status;
  }
}

export function employmentTypeLabel(type?: EmploymentType | string): string {
  switch (type) {
    case 'full_time':
      return 'Full Time';
    case 'part_time':
      return 'Part Time';
    case 'contract':
      return 'Contract';
    case 'intern':
      return 'Intern';
    case 'other':
      return 'Other';
    default:
      return type || '—';
  }
}

export function formatExperienceYears(years?: number): string {
  const n = Number(years) || 0;
  if (n === 1) return '1 Year';
  return `${n} Years`;
}

export function maskPhoneDisplay(phone?: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  const ten = digits.length >= 10 ? digits.slice(-10) : digits;
  if (ten.length < 5) return ten || '—';
  return `${ten.slice(0, 5)} XXXXX`;
}

export function employeeAccountLabel(status?: EmployeeAccountStatus | string): string {
  switch (status) {
    case 'none':
      return 'Not invited';
    case 'invited':
      return 'Invitation sent';
    case 'activation_pending':
      return 'Activation pending';
    case 'active':
      return 'Active';
    case 'suspended':
      return 'Suspended';
    case 'revoked':
      return 'Revoked';
    default:
      return 'Not invited';
  }
}

export interface EmployeeInviteResult {
  employee: Employee;
  activationLink: string;
  expiresAt: string;
  whatsappUrl: string;
  inviteMessage: string;
}

function currentAdminWebOrigin(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.location.origin;
}

export async function inviteEmployee(
  id: string,
): Promise<EmployeeInviteResult> {
  return apiPost<EmployeeInviteResult>(
    `/api/admin/employees/${id}/invitation`,
    {adminWebOrigin: currentAdminWebOrigin()},
  );
}

export async function revokeEmployeeInvitation(id: string): Promise<Employee> {
  return apiPost<Employee>(`/api/admin/employees/${id}/invitation/revoke`, {});
}

export async function updateEmployeeAccess(
  id: string,
  input: {
    profileAccess?: EmployeeProfileAccess;
    canRaiseRequest?: boolean;
  },
): Promise<Employee> {
  return apiPatch<Employee>(`/api/admin/employees/${id}/access`, input);
}

/** Public employee activation (TOTP) — not Admin activate. */
export async function validateEmployeeActivationToken(token: string): Promise<{
  email: string;
  displayName: string;
  employeeCode: string;
}> {
  return apiGet(
    `/api/auth/employee/activate?token=${encodeURIComponent(token)}`,
    {skipAuth: true},
  );
}

export async function employeeActivationSetPassword(
  token: string,
  password: string,
): Promise<{
  email: string;
  displayName: string;
  secret: string;
  qrCodeDataUrl: string;
  activationMfaToken: string;
}> {
  return apiPost(
    '/api/auth/employee/activate/password',
    {token, password},
    {skipAuth: true},
  );
}

export async function employeeActivationVerifyMfa(
  activationMfaToken: string,
  code: string,
): Promise<{employee: Employee; message: string}> {
  return apiPost(
    '/api/auth/employee/activate/mfa',
    {activationMfaToken, code},
    {skipAuth: true},
  );
}

export async function employeeLogin(
  email: string,
  password: string,
): Promise<{requiresMfa: boolean; mfaToken: string; email: string; displayName: string}> {
  return apiPost(
    '/api/auth/employee/login',
    {email, password},
    {skipAuth: true},
  );
}

export async function employeeLoginMfa(
  mfaToken: string,
  code: string,
): Promise<{accessToken: string; employee: Employee}> {
  return apiPost(
    '/api/auth/employee/login/mfa',
    {mfaToken, code},
    {skipAuth: true},
  );
}

function employeeAuthHeaders(): Record<string, string> {
  const token =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('hs_employee_jwt')
      : null;
  if (!token) return {};
  return {Authorization: `Bearer ${token}`};
}

export interface EmployeePortalProfile {
  employee: Employee;
  currentCompensation: {
    amount: number;
    currency?: string;
    salaryType?: string;
    effectiveFrom?: string;
  } | null;
  capabilities: {
    profileAccess: EmployeeProfileAccess;
    canRaiseRequest: boolean;
    canViewCompensation: boolean;
    canViewDocuments: boolean;
    canViewIdCard: boolean;
  };
  supportEmail: string;
}

export async function fetchEmployeePortalMe(): Promise<EmployeePortalProfile> {
  return apiGet('/api/employee/me', {
    skipAuth: true,
    skipUnauthorizedRedirect: true,
    headers: employeeAuthHeaders(),
  });
}

export async function fetchEmployeeDocumentAccess(
  documentId: string,
): Promise<{
  url: string;
  contentType: string;
  fileName: string;
  expiresIn: number;
}> {
  return apiGet(`/api/employee/me/documents/${documentId}/access`, {
    skipAuth: true,
    skipUnauthorizedRedirect: true,
    headers: employeeAuthHeaders(),
  });
}

export type EmployeeVerificationState =
  | 'valid'
  | 'invalid'
  | 'revoked'
  | 'expired'
  | 'former'
  | 'inactive';

export interface EmployeePublicVerification {
  verified: boolean;
  verificationState: EmployeeVerificationState;
  message: string;
  organization?: string;
  employee?: {
    name: string;
    employeeId: string;
    designation: string;
    department: string;
    workLocation: string;
    photoUrl: string;
  };
  employmentStatus?: EmployeeStatus;
  idCardStatus?: string;
  verifiedAt?: string;
  supportEmail: string;
}

export async function fetchEmployeePublicVerification(
  token: string,
): Promise<EmployeePublicVerification> {
  try {
    return await apiGet(
      `/api/employees/verify/${encodeURIComponent(token)}`,
      {skipAuth: true, skipUnauthorizedRedirect: true},
    );
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) {
      return {
        verified: false,
        verificationState: 'invalid',
        message: 'This ID card could not be verified.',
        supportEmail: 'support@akansho.com',
      };
    }
    throw err;
  }
}
