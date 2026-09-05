import {
  apiDelete,
  apiGet,
  apiGetPaginated,
  apiPatch,
  apiPost,
  apiUploadFormData,
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
  fileUrl: string;
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
  professions: string[];
  employmentTypes: EmploymentType[];
  statuses: EmployeeStatus[];
  documentTypes: EmployeeDocumentType[];
}

export interface EmployeeIdCardPayload {
  employeeCode: string;
  fullName: string;
  profession: string;
  designation?: string;
  photoUrl?: string;
  phone: string;
  experienceYears: number;
  location: string;
  status: EmployeeStatus;
  verificationUrl: string;
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
