import {ApiError} from '../services/api/apiClient';
import {invalidateGeographyListCache} from '../services/api/geographyApi';
import {createUser, setUserPin} from '../services/api/usersApi';
import {localTenDigits, toE164} from './phone';

export type BulkRowStatus = 'pending' | 'inserting' | 'success' | 'failed';

export interface ProviderBulkDraftRow {
  id: string;
  phone: string;
  name: string;
  service: string;
  address: string;
  experience: string;
  gender: string;
  city: string;
  pincode: string;
  status: BulkRowStatus;
  error?: string;
  createdUserId?: string;
  loginPin?: string;
}

export interface BulkGeoDefaults {
  stateId: string;
  districtId: string;
  city: string;
  pincode: string;
  stateName: string;
  districtName: string;
}

export interface ServiceOption {
  value: string;
  label: string;
}

export const BULK_DRAFT_STORAGE_KEY = 'admin-provider-bulk-draft-v1';

export const BULK_TEMPLATE_CSV =
  'Phone,Name,Service,Address,Experience,Gender,City,Pincode\n9876543210,Ramesh Kumar,Electrician,12 MG Road,5,Male,Bengaluru,560001';

type DraftField = keyof Pick<
  ProviderBulkDraftRow,
  'phone' | 'name' | 'service' | 'address' | 'experience' | 'gender' | 'city' | 'pincode'
>;

const HEADER_MAP: Record<string, DraftField> = {
  phone: 'phone',
  mobile: 'phone',
  number: 'phone',
  phonenumber: 'phone',
  mobilenumber: 'phone',
  name: 'name',
  servicetype: 'service',
  service: 'service',
  address: 'address',
  experience: 'experience',
  exp: 'experience',
  years: 'experience',
  gender: 'gender',
  sex: 'gender',
  city: 'city',
  pincode: 'pincode',
  pin: 'pincode',
  pincode6: 'pincode',
};

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function detectDelimiter(line: string): '\t' | ',' {
  return line.includes('\t') ? '\t' : ',';
}

function splitRow(line: string, delimiter: '\t' | ','): string[] {
  if (delimiter === '\t') {
    return line.split('\t').map((c) => c.trim());
  }
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

function isHeaderRow(cells: string[]): boolean {
  return cells.some((cell) => {
    const key = normalizeHeader(cell);
    return key in HEADER_MAP;
  });
}

function newDraftRow(
  partial: Partial<Omit<ProviderBulkDraftRow, 'id' | 'status'>>,
): ProviderBulkDraftRow {
  return {
    id: crypto.randomUUID(),
    phone: partial.phone || '',
    name: partial.name || '',
    service: partial.service || '',
    address: partial.address || '',
    experience: partial.experience || '',
    gender: partial.gender || '',
    city: partial.city || '',
    pincode: partial.pincode || '',
    status: 'pending',
  };
}

export function parseBulkPaste(text: string): ProviderBulkDraftRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const delimiter = detectDelimiter(lines[0]);
  const firstCells = splitRow(lines[0], delimiter);
  const hasHeader = isHeaderRow(firstCells);
  const dataLines = hasHeader ? lines.slice(1) : lines;

  let columnMap: Array<DraftField | null> = [];
  if (hasHeader) {
    columnMap = firstCells.map((cell) => HEADER_MAP[normalizeHeader(cell)] || null);
  } else {
    const defaults: DraftField[] = [
      'phone',
      'name',
      'service',
      'address',
      'experience',
      'gender',
      'city',
      'pincode',
    ];
    columnMap = defaults.map((field) => field);
  }

  const rows: ProviderBulkDraftRow[] = [];
  for (const line of dataLines) {
    const cells = splitRow(line, delimiter);
    if (!cells.some((c) => c.trim())) continue;

    const partial: Partial<Omit<ProviderBulkDraftRow, 'id' | 'status'>> = {};
    columnMap.forEach((field, index) => {
      if (!field) return;
      const value = (cells[index] || '').trim();
      if (value) partial[field] = value;
    });

    if (partial.phone) {
      partial.phone = localTenDigits(partial.phone);
    }

    rows.push(newDraftRow(partial));
  }

  return rows;
}

export function matchServiceValue(
  raw: string,
  options: ServiceOption[],
): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const exact = options.find(
    (o) => o.value === trimmed || o.label === trimmed,
  );
  if (exact) return exact.value;
  const lower = trimmed.toLowerCase();
  const ci = options.find(
    (o) =>
      o.value.toLowerCase() === lower || o.label.toLowerCase() === lower,
  );
  return ci?.value ?? null;
}

export function partnerPinFromPhone(phone: string): string {
  return localTenDigits(phone).slice(-6);
}

export function validateBulkRow(
  row: ProviderBulkDraftRow,
  geo: BulkGeoDefaults,
  serviceOptions: ServiceOption[],
): {ok: true} | {ok: false; message: string} {
  const ten = localTenDigits(row.phone);
  if (ten.length !== 10) {
    return {ok: false, message: 'phoneTenDigits'};
  }
  if (!geo.stateId) {
    return {ok: false, message: 'geoStateRequired'};
  }
  if (!geo.districtId) {
    return {ok: false, message: 'geoDistrictRequired'};
  }
  if (!row.service.trim()) {
    return {ok: false, message: 'serviceRequired'};
  }
  const matched = matchServiceValue(row.service, serviceOptions);
  if (!matched) {
    return {ok: false, message: 'bulkPartnersServiceUnknown'};
  }
  if (row.experience.trim()) {
    const exp = Number(row.experience);
    if (!Number.isFinite(exp) || exp < 0) {
      return {ok: false, message: 'bulkPartnersExperienceInvalid'};
    }
  }
  return {ok: true};
}

export function isAlreadyExistsError(err: unknown): boolean {
  if (err instanceof ApiError) {
    return err.status === 409;
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return msg.includes('already exists') || msg === 'already_exists';
  }
  return false;
}

export async function insertBulkPartnerRow(
  row: ProviderBulkDraftRow,
  geo: BulkGeoDefaults,
  serviceOptions: ServiceOption[],
): Promise<{userId: string; loginPin: string}> {
  const validation = validateBulkRow(row, geo, serviceOptions);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const ten = localTenDigits(row.phone);
  const service =
    matchServiceValue(row.service, serviceOptions) || row.service.trim();
  const experience =
    row.experience.trim() === '' ? undefined : Number(row.experience);
  const cityName = row.city.trim() || geo.city.trim() || geo.districtName;
  const pincode = row.pincode.trim() || geo.pincode.trim() || undefined;
  const pin = partnerPinFromPhone(ten);

  try {
    const created = await createUser({
      name: row.name.trim() || undefined,
      phone: toE164(ten),
      role: 'provider',
      serviceType: service,
      serviceCategories: [service],
      address: row.address.trim() || undefined,
      city: cityName || undefined,
      state: geo.stateName || undefined,
      district: geo.districtName || undefined,
      stateId: geo.stateId || undefined,
      districtId: geo.districtId || undefined,
      pincode,
      experience: Number.isFinite(experience) ? experience : undefined,
    });

    invalidateGeographyListCache({
      districtId: geo.districtId,
      stateId: geo.stateId,
    });

    const pinResult = await setUserPin(created._id, pin, 'partner');
    return {userId: created._id, loginPin: pinResult.loginPin};
  } catch (err) {
    if (isAlreadyExistsError(err)) {
      throw new Error('bulkPartnersAlreadyExists');
    }
    throw err;
  }
}

export interface BulkDraftStorage {
  rows: ProviderBulkDraftRow[];
  pasteText: string;
  stateId: string;
  districtId: string;
  city: string;
  pincode: string;
  expanded?: boolean;
}

export function loadBulkDraftFromStorage(): BulkDraftStorage | null {
  try {
    const raw = localStorage.getItem(BULK_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BulkDraftStorage;
    if (!Array.isArray(parsed.rows)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveBulkDraftToStorage(draft: BulkDraftStorage): void {
  try {
    localStorage.setItem(BULK_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // ignore quota errors
  }
}

export function clearBulkDraftStorage(): void {
  localStorage.removeItem(BULK_DRAFT_STORAGE_KEY);
}

export function downloadBulkTemplate(): void {
  const blob = new Blob([BULK_TEMPLATE_CSV], {type: 'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'partner-bulk-onboarding-template.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}
